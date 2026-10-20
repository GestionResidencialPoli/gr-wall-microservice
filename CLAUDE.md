# gr-wall-microservice — contexto para agentes

Microservicio del muro de comunicaciones de Gestion Residencial (Modulo 2 / epica `GR-13` en Jira). Node +
Express + TypeScript, deliberadamente distinto del stack de `gr-user-microservice` (Java/Spring Boot): es CRUD
simple sin reglas de negocio pesadas, y Node reduce la complejidad de despliegue en un servidor de pocos
recursos. No asumas que todo el backend de GR es Java — cada microservicio elige el stack que le convenga.

## Arquitectura y patrones

Sigue el mismo patron que `gr-api-gateway` y su referencia (`beunik-api`, un repo externo del autor, usado solo
como guia de estilo): capas separadas, clases con **solo metodos estaticos** (nunca instancias, nunca `this`),
sin comentarios salvo que expliquen un porque no obvio.

```
index.ts                  # entrypoint: levanta el httpServer
src/
  server.ts               # clase Server: middlewares + rutas (sin logica de negocio)
  config/                 # lectura y validacion de variables de entorno
  db/knex.ts              # conexion Knex (Postgres)
  lib/                    # utilidades sin estado: TokenService, Logger, WallCache, WallEventsPublisher,
                           # UserServiceClient, DomainError
  middlewares/             # authenticate, require-authentication, require-roles, handle-error
  validators/              # esquemas Zod (DTOs de entrada)
  repositories/            # queries Knex, sin logica de negocio
  services/                 # reglas de negocio (limite de fijadas, mapeo row -> DTO, cache, eventos)
  controllers/              # delgados: parsean el request, llaman al service, formatean la respuesta
  routers/                  # montan rutas + middlewares de autorizacion por rol
  types/                    # DTOs, enums, Express augmentation (req.auth)
migrations/                # migraciones Knex (no Flyway: este microservicio es Node)
```

## Autenticacion — igual contrato que gr-api-gateway

Lee el JWT de la cookie `access_token` y lo verifica **localmente** con el mismo secreto HMAC-SHA256
(`JWT_SECRET`) que usa `gr-user-microservice`. No hay sesion compartida ni llamada a otro servicio para
autenticar — cada microservicio detras del gateway valida el token por su cuenta (`src/lib/token-service.ts`,
copia deliberada del de `gr-api-gateway`, no una dependencia compartida). Roles reales en el JWT:
`ADMINISTRACION`, `VIGILANTE`, `RESIDENTE` (no "ADMIN" ni otras variantes).

## Base de datos: microservicio de verdad, no monolito con carpetas

Usa el **mismo contenedor Postgres** que `gr-user-microservice` (no hay contenedor nuevo), pero una **base de
datos logica separada** (`gr_wall_db` vs `gr_user_db`). Por eso `publicaciones.autor_user_id` es una referencia
logica, **sin FK real** (no se puede tener una foreign key entre bases de datos distintas). El nombre del autor
se resuelve en el momento de publicar con una llamada HTTP a `gr-user-microservice`
(`GET /api/v1/auth/me`, ver `UserServiceClient`) y se denormaliza en la fila — no se llama a ese endpoint en cada
lectura del muro, solo al crear/editar.

**Gotcha real:** `pg` devuelve las columnas `bigint` como `string`, no `number`, para no perder precision fuera
del rango seguro de JS. Los repositorios devuelven las filas crudas; la conversion a `number` pasa explicitamente
en la capa de `services/` (`Number(row.id)`), nunca asumas que un id de una fila de Postgres ya es un `number`.

## Cache y pub/sub (Redis, ya corriendo en el homelab, no se crea un Redis nuevo)

- **Cache**: `GET /api/v1/publicaciones` (mayor volumen de lectura) se cachea con TTL corto e invalidacion por
  version — cualquier escritura incrementa un contador (`wall:posts:version`), lo que invalida todas las paginas
  cacheadas de una vez sin `SCAN`/borrado por patron.
- **Pub/Sub**: publica `post.created` / `post.updated` / `post.retired` en el canal `gr:wall:events`. Hoy nadie
  lo consume — es la base para la decision de `SPIKE-2.1` (notificacion en tiempo real), no un feature terminado.
  No asumas que hay un consumidor: si agregas uno, documentalo aqui.

## Reglas de negocio no obvias (vienen de los criterios de aceptacion en Jira, no las reinventes)

- Categorias fijas como texto con `CHECK`, no como ordinal (agregar una categoria nueva no debe reinterpretar
  datos existentes).
- Maximo 3 publicaciones fijadas simultaneas — limite validado en el servidor, **sin lock**: la carrera entre dos
  administradores fijando a la vez se acepta a proposito por su baja frecuencia (contraste deliberado con
  reservas o aforo de parqueadero, donde si hay que resolver la concurrencia).
- La vigencia se resuelve **filtrando en la consulta** (`vigencia_hasta IS NULL OR vigencia_hasta >= hoy`), nunca
  con un job programado — evita coordinar una tarea periodica entre replicas de Kubernetes.
- Eliminacion logica (`eliminado_en`): el registro se conserva, nunca se borra fisicamente.

## Flujo de trabajo obligatorio (aplica desde ahora, ver el documento de proceso del equipo en Jira/Confluence)

- Rama por work item: `feature/GR-000-descripcion-breve` (o `fix/`, `refactor/`, `hotfix/` segun el tipo), creada
  desde `develop` (o `main` solo para `hotfix/`).
- Commits: `tipo(scope): GR-000 descripcion breve`.
- Todo cambio entra por PR. Ramas de trabajo se fusionan con squash a `develop`. Entre ramas permanentes
  (`develop -> qa -> release/* -> main`) siempre merge commit, nunca squash ni rebase.
- No se crean ramas a partir de otra rama de trabajo sin fusionar — nace de `develop` o de `main`, nunca de otra
  `feature/*`.
- Revisión requerida en los rulesets: temporalmente 1 aprobación (normalmente son 2) mientras el equipo es
  pequeño. No autoaprobar el propio PR.
