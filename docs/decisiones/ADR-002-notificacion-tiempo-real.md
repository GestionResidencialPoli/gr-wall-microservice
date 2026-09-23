# ADR-002 · Notificación en tiempo real del muro

## Estado

Aceptado.

## Pregunta

Cuando administración publica un aviso urgente, ¿cómo se entera un residente que ya tiene el muro abierto? ¿Qué
implica cada alternativa cuando el backend corre con varias réplicas en Kubernetes?

## Por qué importa la cantidad de réplicas

Con una sola instancia, mantener las conexiones de los clientes abiertas en memoria y notificarlas directamente
funciona. Con varias réplicas (el caso real en k3s), el residente está conectado a una réplica y
administración publica contra otra: si el mecanismo de notificación vive solo en la memoria de un proceso, el
evento nunca llega. Cualquier solución que no resuelva esto explícitamente no sirve en producción, aunque
funcione perfecto en el portátil del desarrollador con una sola instancia corriendo.

## Alternativas evaluadas

| Alternativa | Multi-réplica | Complejidad | Latencia | Recursos |
|---|---|---|---|---|
| Consulta periódica (polling) | Sin problema (sin estado) | Muy baja | Ligada al intervalo | Desperdicia ancho de banda con clientes inactivos |
| SSE puro (sin pub/sub) | Roto: solo notifica clientes de su propia réplica | Baja | Inmediata | Conexión abierta por cliente |
| WebSocket + STOMP | Roto igual que SSE sin un canal compartido | Alta (bidireccional, no lo necesitamos) | Inmediata | Conexión abierta por cliente, más pesada que SSE |
| SSE + Redis pub/sub | Resuelto: cualquier réplica reenvía a sus clientes locales | Baja (el pub/sub ya existe, construido para los eventos de dominio) | Inmediata | Una conexión Redis adicional por réplica, no por cliente |

## Decisión

**SSE + Redis pub/sub.**

El muro solo necesita empujar datos en una dirección (servidor → residente); no hay ningún caso de uso que
requiera que el cliente hable de vuelta por ese canal, así que WebSocket + STOMP es más poder del que hace
falta. SSE es el mecanismo más simple que resuelve exactamente el problema.

El pub/sub de Redis ya existe en el repositorio (`WallEventsPublisher`, construido para GR-59: publica
`post.created` / `post.updated` / `post.retired` en el canal `gr:wall:events` en cada escritura). Agregar un
suscriptor SSE no es infraestructura nueva, es un consumidor más de algo que ya está corriendo — de ahí que sea
la opción de menor complejidad relativa a lo que ya existe, no en abstracto.

## Cómo resuelve el problema de varias réplicas

Cada réplica del microservicio abre su propia conexión de suscripción al canal `gr:wall:events`. Cuando
cualquier réplica publica un evento (porque atendió un `POST`/`PUT`/`PATCH`/`DELETE`), Redis lo entrega a
**todas** las réplicas suscritas, sin importar cuál de ellas originó la escritura. Cada réplica reenvía el
evento únicamente a los clientes SSE conectados a ella misma. El residente nunca necesita saber ni le importa
a qué réplica está conectado.

## Evidencia del prototipo con dos réplicas

Prototipo en `src/routers/events-router.ts`: `GET /api/v1/publicaciones/eventos` abre un stream SSE y suscribe
una conexión Redis dedicada (`redis.duplicate()`, requisito de ioredis: una conexión en modo `SUBSCRIBE` no
puede ejecutar otros comandos) al canal configurado.

Prueba real, dos instancias del mismo servicio corriendo contra el mismo Redis:

```
# Replica A en :4100, Replica B en :4101, mismo REDIS_URL

# Cliente SSE conectado a la Replica A
curl -N http://localhost:4100/api/v1/publicaciones/eventos

# Evento publicado directamente en Redis (simula una escritura atendida por la Replica B,
# o por cualquier otra replica que no sea la A)
docker exec redis redis-cli PUBLISH gr:wall:events \
  '{"type":"post.created","postId":42,"categoria":"URGENTE","fijada":false}'
# -> (integer) 2   # dos suscriptores activos: replica A y replica B

# Lo que recibio el cliente SSE conectado a la Replica A:
data: {"type":"post.created","postId":42,"categoria":"URGENTE","fijada":false}
```

El evento llegó a la réplica A aunque se publicó como si viniera de otra instancia. Es la prueba concreta de
que el mecanismo no depende de en qué réplica esté conectado cada residente.

## Qué falta para producción (fuera del alcance de este spike)

- Autenticación del endpoint SSE (el prototipo lo deja abierto a propósito; la versión real reutiliza el mismo
  `authenticate`/`requireAuthentication` que ya usa el resto de la API).
- Filtrar qué eventos le importan a cada cliente (por ejemplo, no reenviar `post.retired` de una publicación que
  el cliente nunca llegó a ver).
- Reconexión y *heartbeat* del lado del cliente (SSE lo soporta nativo vía `EventSource`, pero conviene
  documentarlo explícitamente para quien construya TEC-2.3).
- Confirmar el comportamiento del Ingress/Traefik de k3s con conexiones HTTP de larga duración (timeouts por
  defecto que corten el stream).

## Criterio de terminado

Documento aprobado. Se decide implementar: la historia correspondiente para la versión de producción se crea en
el backlog de la etapa 2 cuando se planifique TEC-2.3 (interfaz Next.js), ya que el consumidor real de este
endpoint es el frontend del residente.

## Addendum · Transporte del evento: de Redis pub/sub a RabbitMQ

Al llevar el prototipo a producción (GR-145) se cambió el transporte de **Redis pub/sub** a un **exchange
`fanout` durable de RabbitMQ** (`gr.wall.events`). La decisión de multi-réplica de este ADR (algo compartido
entre réplicas para que el evento llegue sin importar cuál atendió la escritura) no cambia; lo que cambia es la
pieza concreta que lo implementa.

Motivo: Redis pub/sub entrega el mensaje únicamente a los suscriptores conectados en el instante exacto de la
publicación — si una réplica está reiniciando o momentáneamente caída, ese evento se pierde para ella sin
ningún aviso. RabbitMQ resuelve esto con colas: un consumidor con una cola declarada (durable o exclusiva)
recibe los mensajes acumulados en cuanto se reconecta, en vez de perderlos. Para el caso de uso actual (SSE de
clientes efímeros) esa garantía no importa demasiado — la cola es exclusiva y se descarta con la conexión del
navegador — pero sí importa para cualquier futuro consumidor de tipo servicio (por ejemplo, un servicio de
notificaciones push) que necesite no perder eventos mientras está caído, que es exactamente el escenario que
Redis pub/sub no cubre.

Redis se mantiene en el repositorio, pero exclusivamente para el cache de `GET /api/v1/publicaciones`.

También se implementó, junto con este cambio, el punto pendiente de autenticación del endpoint SSE señalado
arriba: `GET /api/v1/publicaciones/eventos` ahora exige el mismo `authenticate`/`requireAuthentication` que el
resto de la API.
