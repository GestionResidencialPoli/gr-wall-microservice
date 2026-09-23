import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import handleError from "./handle-error";
import DomainError from "../lib/domain-error";

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

const req = { originalUrl: "/api/v1/publicaciones", method: "POST" } as Request;

describe("handleError", () => {
  it("mapea un ZodError a 400 con el detalle de cada issue", () => {
    const res = mockResponse();
    const result = z.object({ titulo: z.string().min(1) }).safeParse({ titulo: "" });

    handleError(result.error!, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.details).toHaveLength(1);
  });

  it("mapea un DomainError a su statusCode propio", () => {
    const res = mockResponse();

    handleError(new DomainError(409, "Ya hay tres publicaciones fijadas."), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("mapea cualquier otro error a 500 sin filtrar el mensaje interno", () => {
    const res = mockResponse();

    handleError(new Error("boom en la base de datos"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.error.message).not.toContain("boom");
  });
});
