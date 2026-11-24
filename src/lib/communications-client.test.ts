import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

const settings = vi.hoisted(() => ({
  internalServiceToken: "token-interno",
  communications: { url: "", timeoutMs: 200, silenceLimitMs: 5_000 },
}));

vi.mock("../config", () => ({ default: settings }));

import CommunicationsClient from "./communications-client";
import UserServiceClient from "./user-service-client";

type Reply = (frame: { id: string; action: string; target: string; payload: unknown }, socket: WebSocket) => void;

let hub: WebSocketServer;
let reply: Reply;
let headers: Record<string, unknown>;

describe("CommunicationsClient", () => {
  beforeEach(async () => {
    hub = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise((resolve) => hub.once("listening", resolve));
    settings.communications.url = `ws://127.0.0.1:${(hub.address() as AddressInfo).port}/internal/ws`;
    hub.on("connection", (socket, request) => {
      headers = request.headers;
      socket.on("message", (data) => reply(JSON.parse(data.toString()), socket));
    });
  });

  afterEach(async () => {
    CommunicationsClient.stop();
    hub.clients.forEach((client) => client.terminate());
    await new Promise((resolve) => hub.close(resolve));
  });

  it("consulta el nombre del autor por el hub", async () => {
    const frames: unknown[] = [];
    reply = (frame, socket) => {
      frames.push(frame);
      const payload = { id: 7, firstName: "Ana", lastName: "Ruiz" };
      socket.send(JSON.stringify({ type: "response", id: frame.id, ok: true, payload }));
    };

    expect(await UserServiceClient.fetchAuthorName(7)).toBe("Ana Ruiz");
    expect(frames[0]).toMatchObject({ target: "user-microservice", action: "users.get", payload: { id: 7 } });
    expect(headers).toMatchObject({ "x-internal-token": "token-interno", "x-service-name": "wall-microservice" });
  });

  it("responde 401 cuando el autor no existe", async () => {
    reply = (frame, socket) =>
      socket.send(
        JSON.stringify({ type: "response", id: frame.id, ok: false, error: { code: "NO_ENCONTRADO", message: "x" } }),
      );
    await expect(UserServiceClient.fetchAuthorName(7)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("responde 502 cuando no hay respuesta a tiempo", async () => {
    reply = () => undefined;
    await expect(UserServiceClient.fetchAuthorName(7)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("responde 502 cuando el hub se desconecta con una peticion pendiente", async () => {
    reply = (_frame, socket) => socket.terminate();
    await expect(UserServiceClient.fetchAuthorName(7)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("responde 502 cuando el hub no esta disponible", async () => {
    settings.communications.url = "ws://127.0.0.1:1/internal/ws";
    await expect(UserServiceClient.fetchAuthorName(7)).rejects.toMatchObject({ statusCode: 502 });
  });
});
