# gr-wall-microservice

Microservicio del muro de comunicaciones de Gestion Residencial (Modulo 2 del backlog: `GR-13`). Publica,
edita, retira, fija y filtra los comunicados que administracion dirige a los residentes.

## Por que Node/Express y no Spring Boot

Es una decision deliberada, distinta a `gr-user-microservice` (Java): este servicio es CRUD simple sin reglas de
negocio pesadas, así que Node reduce la complejidad de despliegue en un servidor de pocos recursos (menor uso de
memoria, arranque en frio mas rapido). Cada microservicio de GR puede usar el stack que mejor le quede; no hay
obligacion de que todos sean Java.

## Base de datos

Usa el **mismo contenedor Postgres** que ya corre para `gr-user-microservice` (no se crea un contenedor nuevo),
pero en una **base de datos logica separada** (`gr_wall_db` vs `gr_user_db`). Son microservicios de verdad:
bases de datos distintas, sin llaves foraneas cruzadas entre ellas. Por eso `publicaciones.autor_user_id` es una
referencia logica al usuario (no hay FK real posible entre bases de datos distintas) y `autor_nombre` se
denormaliza al momento de publicar, resolviendolo con una llamada a `gr-user-microservice` (`GET /api/v1/auth/me`)
en vez de duplicar toda la tabla de usuarios.

```bash
pnpm db:ensure       # crea gr_wall_db en el contenedor si no existe
pnpm migrate:latest  # aplica las migraciones
```

## Cache (Redis) y eventos en tiempo real (RabbitMQ)

- **Cache** en Redis (el mismo contenedor ya existente en el homelab) de `GET /api/v1/publicaciones` (el
  endpoint de mayor volumen de lectura): TTL corto + invalidacion por version (cualquier escritura incrementa un
  contador, lo que invalida todas las paginas cacheadas de una vez, sin necesidad de borrar claves por patron).
- **Eventos** (`post.created` / `post.updated` / `post.retired`) se publican en un exchange `fanout` durable de
  RabbitMQ (`gr.wall.events`), no en Redis: a diferencia de Redis pub/sub, una cola de RabbitMQ retiene los
  mensajes para un consumidor que se reconecta, en vez de perderlos si nadie estaba escuchando en el instante de
  la publicacion. `GET /api/v1/publicaciones/eventos` (SSE) es hoy el unico consumidor: cada conexion declara su
  propia cola exclusiva y auto-eliminable enlazada al exchange (vive solo mientras dura la conexion del
  cliente); ver `docs/decisiones/ADR-002-notificacion-tiempo-real.md`.

## Autenticacion

Igual que `gr-api-gateway`: lee el JWT de la cookie `access_token` y lo verifica localmente con el mismo secreto
HMAC-SHA256 que usa `gr-user-microservice` (`JWT_SECRET`). No hay sesion compartida ni llamada a otro servicio
para autenticar — cada microservicio detras del gateway valida el token por su cuenta, incluyendo el endpoint
SSE de eventos.

## Reglas de negocio relevantes

- Categorias fijas: `AVISO`, `NOTICIA`, `URGENTE`, `MANTENIMIENTO` (almacenadas como texto, no como ordinal).
- Maximo 3 publicaciones fijadas simultaneas.
- La vigencia se resuelve filtrando en la consulta (`vigencia_hasta IS NULL OR vigencia_hasta >= hoy`), no con un
  job programado — evita coordinar una tarea periodica entre replicas.
- Eliminacion logica (`eliminado_en`): el registro se conserva para trazabilidad.

## Variables de entorno

Ver `.env.example`.

## Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm db:ensure
pnpm migrate:latest
pnpm dev
```

Documentacion OpenAPI disponible en `/api-docs` fuera de produccion.

## Scripts

- `pnpm dev` — desarrollo con recarga automatica
- `pnpm build` / `pnpm start` — build y ejecucion de produccion
- `pnpm lint` / `pnpm lint:fix`
- `pnpm typecheck`
- `pnpm migrate:make|latest|rollback|list`

