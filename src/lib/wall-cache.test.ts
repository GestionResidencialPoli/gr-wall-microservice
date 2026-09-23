import { beforeEach, describe, expect, it, vi } from "vitest";
import WallCache from "./wall-cache";

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("./redis-client", () => ({
  default: {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    incr: vi.fn((key: string) => {
      const next = Number(store.get(key) ?? "0") + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
  },
}));

describe("WallCache", () => {
  beforeEach(() => {
    store.clear();
  });

  it("devuelve null cuando la clave no esta en cache", async () => {
    await expect(WallCache.get("page=0")).resolves.toBeNull();
  });

  it("devuelve el valor guardado", async () => {
    await WallCache.set("page=0", { content: ["a"] });
    await expect(WallCache.get<{ content: string[] }>("page=0")).resolves.toEqual({ content: ["a"] });
  });

  it("invalida todo el cache al incrementar la version, sin borrar claves una por una", async () => {
    await WallCache.set("page=0", { content: ["a"] });
    await WallCache.invalidateAll();

    await expect(WallCache.get("page=0")).resolves.toBeNull();
  });
});
