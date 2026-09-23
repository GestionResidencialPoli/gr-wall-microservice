import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import requireAuthentication from "./require-authentication";

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe("requireAuthentication", () => {
  it("responde 401 cuando no hay auth en la request", () => {
    const req = { auth: null } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireAuthentication(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("llama a next cuando hay auth valido", () => {
    const req = { auth: { sub: "1", uid: 1, roles: ["RESIDENTE"] } } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireAuthentication(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
