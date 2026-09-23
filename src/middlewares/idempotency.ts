import type { NextFunction, Request, Response } from "express";
import redis from "../lib/redis-client";

const IDEMPOTENCY_HEADER = "idempotency-key";
const TTL_SECONDS = 60 * 60 * 24;

interface StoredResponse {
  statusCode: number;
  body: unknown;
}

async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers[IDEMPOTENCY_HEADER];
  if (typeof key !== "string" || key.length === 0) {
    next();
    return;
  }

  const redisKey = `idempotency:${req.method}:${req.originalUrl}:${key}`;
  const cached = await redis.get(redisKey);

  if (cached) {
    const stored = JSON.parse(cached) as StoredResponse;
    res.status(stored.statusCode).json(stored.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 500) {
      const stored: StoredResponse = { statusCode: res.statusCode, body };
      redis.set(redisKey, JSON.stringify(stored), "EX", TTL_SECONDS).catch(() => undefined);
    }
    return originalJson(body);
  }) as Response["json"];

  next();
}

export default idempotency;
