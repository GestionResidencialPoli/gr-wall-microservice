import Redis from "ioredis";
import config from "../config";
import Logger from "./logger";

const redis = new Redis(config.redis.url, { lazyConnect: false });

redis.on("error", (error: Error) => {
  Logger.error(error, { source: "redis" });
});

export default redis;
