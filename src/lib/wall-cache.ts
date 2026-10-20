import redis from "./redis-client";
import config from "../config";

const VERSION_KEY = "wall:posts:version";

async function currentVersion(): Promise<number> {
  const value = await redis.get(VERSION_KEY);
  return value ? Number(value) : 0;
}

class WallCache {
  public static async get<T>(key: string): Promise<T | null> {
    const version = await currentVersion();
    const raw = await redis.get(`wall:posts:v${version}:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  public static async set<T>(key: string, value: T): Promise<void> {
    const version = await currentVersion();
    await redis.set(`wall:posts:v${version}:${key}`, JSON.stringify(value), "EX", config.redis.cacheTtlSeconds);
  }

  public static async invalidateAll(): Promise<void> {
    await redis.incr(VERSION_KEY);
  }
}

export default WallCache;
