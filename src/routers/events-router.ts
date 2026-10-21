import { Router } from "express";
import type { Channel } from "amqplib";
import RabbitMqClient from "../lib/rabbitmq-client";
import config from "../config";
import Logger from "../lib/logger";
import requireAuthentication from "../middlewares/require-authentication";

const HEARTBEAT_INTERVAL_MS = 20_000;

function eventsRouter(): Router {
  const router = Router();

  router.get("/", requireAuthentication, async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    let channel: Channel | undefined;

    try {
      const connection = await RabbitMqClient.getConnection();
      channel = await connection.createChannel();
      await channel.assertExchange(config.rabbitmq.eventsExchange, "fanout", { durable: true });

      const { queue } = await channel.assertQueue("", { exclusive: true, autoDelete: true });
      await channel.bindQueue(queue, config.rabbitmq.eventsExchange, "");

      await channel.consume(
        queue,
        (message) => {
          if (!message) return;
          res.write(`data: ${message.content.toString()}\n\n`);
        },
        { noAck: true },
      );
    } catch (error) {
      Logger.error(error as Error, { source: "sse-subscribe" });
      res.end();
      return;
    }

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, HEARTBEAT_INTERVAL_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      channel?.close().catch(() => undefined);
    });
  });

  return router;
}

export default eventsRouter;
