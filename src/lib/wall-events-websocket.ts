import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Channel } from "amqplib";
import RabbitMqClient from "./rabbitmq-client";
import config from "../config";
import Logger from "./logger";
import TokenService from "./token-service";

const WS_PATH = "/api/v1/publicaciones/eventos/ws";
const CLOSE_UNAUTHORIZED = 4401;

function queryTicket(request: IncomingMessage): string | null {
  const url = new URL(request.url ?? "/", "http://localhost");
  return url.searchParams.get("ticket");
}

function cookieToken(request: IncomingMessage): string | null {
  const cookieHeader = request.headers.cookie ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${config.accessTokenCookieName}=`));
  return cookie ? decodeURIComponent(cookie.slice(config.accessTokenCookieName.length + 1)) : null;
}

function authorize(request: IncomingMessage) {
  const ticket = queryTicket(request);
  if (ticket) return TokenService.verifyWallEventsTicket(ticket);
  const token = cookieToken(request);
  return token ? TokenService.verifyAccessToken(token) : null;
}

class WallEventsWebSocket {
  private readonly server = new WebSocketServer({ noServer: true });

  public attach(httpServer: HttpServer): void {
    httpServer.on("upgrade", (request, socket, head) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (path !== WS_PATH) return;

      if (!authorize(request)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      this.server.handleUpgrade(request, socket, head, (webSocket) => {
        this.server.emit("connection", webSocket, request);
      });
    });

    this.server.on("connection", (webSocket: WebSocket) => {
      void this.subscribe(webSocket);
    });
  }

  private async subscribe(webSocket: WebSocket): Promise<void> {
    let channel: Channel | undefined;

    try {
      const connection = await RabbitMqClient.getConnection();
      channel = await connection.createChannel();
      await channel.assertExchange(config.rabbitmq.eventsExchange, "fanout", { durable: true });
      const { queue } = await channel.assertQueue("", { exclusive: true, autoDelete: true });
      await channel.bindQueue(queue, config.rabbitmq.eventsExchange, "");
      await channel.consume(queue, (message) => {
        if (!message || webSocket.readyState !== webSocket.OPEN) return;
        webSocket.send(message.content.toString());
      }, { noAck: true });

      webSocket.once("close", () => {
        channel?.close().catch(() => undefined);
      });
    } catch (error) {
      Logger.error(error as Error, { source: "websocket-subscribe" });
      if (webSocket.readyState === webSocket.OPEN) webSocket.close(CLOSE_UNAUTHORIZED, "No se pudo abrir el canal de eventos");
      channel?.close().catch(() => undefined);
    }
  }
}

export default new WallEventsWebSocket();
