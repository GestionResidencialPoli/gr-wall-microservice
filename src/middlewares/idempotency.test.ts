import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import idempotency from "./idempotency";

const { get, set } = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("../lib/redis-client", () => ({
  default: { get, set },
}));

function mockRequest(headers: Record<string, string> = {}): Request {
  return { headers, method: "POST", originalUrl: "/api/v1/publicaciones" } as unknown as Request;
}

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn(), statusCode: 201 } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("idempotency", () => {
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
  });

  it("deja pasar la request sin tocar redis cuando no hay header idempotency-key", async () => {
    const next = vi.fn();

    await idempotency(mockRequest(), mockResponse(), next);

    expect(get).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("responde con la respuesta guardada cuando la idempotency-key ya se proceso, sin llamar a next", async () => {
    get.mockResolvedValue(JSON.stringify({ statusCode: 201, body: { id: 1 } }));
    const res = mockResponse();
    const next = vi.fn();

    await idempotency(mockRequest({ "idempotency-key": "abc" }), res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
    expect(next).not.toHaveBeenCalled();
  });

  it("guarda la respuesta en redis la primera vez que se usa una idempotency-key nueva", async () => {
    get.mockResolvedValue(null);
    set.mockResolvedValue("OK");
    const res = mockResponse();
    const next = vi.fn();

    await idempotency(mockRequest({ "idempotency-key": "nueva" }), res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.json({ id: 2 });

    expect(set).toHaveBeenCalledWith(expect.stringContaining("idempotency:POST:/api/v1/publicaciones:nueva"), expect.any(String), "EX", expect.any(Number));
  });
});
