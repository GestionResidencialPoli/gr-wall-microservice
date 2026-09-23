import { Router } from "express";
import redis from "../lib/redis-client";
import config from "../config";
import Logger from "../lib/logger";

function eventsRouter(): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    const subscriber = redis.duplicate();

    subscriber.subscribe(config.redis.eventsChannel).catch((error: Error) => {
      Logger.error(error, { source: "sse-subscribe" });
    });

    subscriber.on("message", (_channel, message) => {
      res.write(`data: ${message}\n\n`);
    });

    req.on("close", () => {
      subscriber.unsubscribe().catch(() => undefined);
      subscriber.quit().catch(() => undefined);
    });
  });

  return router;
}

export default eventsRouter;
