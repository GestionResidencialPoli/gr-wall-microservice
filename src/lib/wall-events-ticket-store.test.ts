import { beforeEach, describe, expect, it, vi } from "vitest";
import WallEventsTicketStore from "./wall-events-ticket-store";

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("./redis-client", () => ({
  default: {
    set: vi.fn((key: string, value: string, _ex: string, _ttl: number, mode: string) => {
      if (mode === "NX" && store.has(key)) return Promise.resolve(null);
      store.set(key, value);
      return Promise.resolve("OK");
    }),
  },
}));

describe("WallEventsTicketStore", () => {
  beforeEach(() => {
    store.clear();
  });

  it("acepta un ticket la primera vez y lo rechaza si se reutiliza", async () => {
    await expect(WallEventsTicketStore.consume("jti-1")).resolves.toBe(true);
    await expect(WallEventsTicketStore.consume("jti-1")).resolves.toBe(false);
  });

  it("cada ticket se consume de forma independiente", async () => {
    await expect(WallEventsTicketStore.consume("jti-1")).resolves.toBe(true);
    await expect(WallEventsTicketStore.consume("jti-2")).resolves.toBe(true);
  });
});
