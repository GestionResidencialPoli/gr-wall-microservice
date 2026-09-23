import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

const jwtSecret = required("JWT_SECRET");

if (jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 caracteres: debe coincidir con el mismo secreto HMAC-SHA256 del user-microservice",
  );
}

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4100),
  jwtSecret,
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME ?? "access_token",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: required("DB_USERNAME"),
    password: required("DB_PASSWORD"),
    database: process.env.DB_NAME ?? "gr_wall_db",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    cacheTtlSeconds: Number(process.env.WALL_CACHE_TTL_SECONDS ?? 30),
    eventsChannel: process.env.WALL_EVENTS_CHANNEL ?? "gr:wall:events",
  },
  userServiceUrl: process.env.USER_SERVICE_URL ?? "http://localhost:8080",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
} as const;

export default config;
