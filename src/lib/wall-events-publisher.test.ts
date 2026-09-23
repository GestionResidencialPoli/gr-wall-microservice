import { describe, expect, it, vi, beforeEach } from "vitest";
import WallEventsPublisher from "./wall-events-publisher";

const { publish, getChannel } = vi.hoisted(() => ({ publish: vi.fn(), getChannel: vi.fn() }));

vi.mock("./rabbitmq-client", () => ({
  default: { getChannel },
}));

describe("WallEventsPublisher", () => {
  beforeEach(() => {
    publish.mockReset();
    getChannel.mockReset();
  });

  it("publica el evento en el exchange como mensaje persistente", async () => {
    getChannel.mockResolvedValue({ publish });

    await WallEventsPublisher.publish({ type: "post.created", postId: 1, categoria: "AVISO", fijada: false });

    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, content, options] = publish.mock.calls[0] as [string, string, Buffer, { persistent: boolean }];
    expect(exchange).toBe("gr.wall.events");
    expect(routingKey).toBe("");
    expect(JSON.parse(content.toString())).toEqual({ type: "post.created", postId: 1, categoria: "AVISO", fijada: false });
    expect(options.persistent).toBe(true);
  });

  it("no lanza si RabbitMQ no esta disponible, solo lo registra", async () => {
    getChannel.mockRejectedValue(new Error("connection refused"));

    await expect(
      WallEventsPublisher.publish({ type: "post.retired", postId: 2, categoria: "URGENTE", fijada: false }),
    ).resolves.toBeUndefined();
  });
});
