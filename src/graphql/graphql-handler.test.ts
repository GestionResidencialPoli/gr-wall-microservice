import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const postService = vi.hoisted(() => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
}));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));

vi.mock("../services/post-service", () => ({ default: postService }));
vi.mock("../lib/user-service-client", () => ({ default: { fetchAuthorName: vi.fn() } }));
vi.mock("../lib/logger", () => ({ default: logger }));

import { handleGraphQL } from "./graphql-handler";

const administrator = { sub: "admin@example.com", uid: 1, roles: ["ADMINISTRACION"] };

async function send(body: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handleGraphQL({ body, auth: administrator } as unknown as Request, res as unknown as Response);
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
}

const aliases = (total: number) =>
  Array.from({ length: total }, (_, index) => `a${index}: eliminarPublicacion(id: "${index + 1}")`).join(" ");

describe("handleGraphQL", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("oculta el detalle de los errores internos y los registra", async () => {
    postService.list.mockRejectedValue(new Error("connect ECONNREFUSED db-host:5432"));

    const response = await send({ query: "{ publicaciones { totalElements } }" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("db-host");
    expect(response.body.errors[0].extensions.code).toBe("INTERNAL_SERVER_ERROR");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("conserva el mensaje de los errores de dominio", async () => {
    postService.getDetail.mockResolvedValue(null);

    const response = await send({ query: '{ publicacion(id: "9") { id } }' });

    expect(response.body.errors[0].message).toBe("Publicacion no encontrada.");
    expect(response.body.errors[0].extensions.code).toBe("NOT_FOUND");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("consulta una publicacion por id", async () => {
    postService.getDetail.mockResolvedValue({ id: 9, titulo: "Corte de agua" });

    const response = await send({ query: '{ publicacion(id: "9") { id titulo } }' });

    expect(response.status).toBe(200);
    expect(response.body.data.publicacion).toEqual({ id: "9", titulo: "Corte de agua" });
  });

  it("admite hasta cinco operaciones por solicitud", async () => {
    postService.remove.mockResolvedValue(true);

    const response = await send({ query: `mutation { ${aliases(5)} }` });

    expect(response.status).toBe(200);
    expect(postService.remove).toHaveBeenCalledTimes(5);
  });

  it("rechaza mas de cinco operaciones sin ejecutar ninguna", async () => {
    const response = await send({ query: `mutation { ${aliases(6)} }` });

    expect(response.status).toBe(400);
    expect(postService.remove).not.toHaveBeenCalled();
  });

  it("cuenta tambien las operaciones declaradas en fragmentos", async () => {
    const response = await send({ query: `mutation { ...F } fragment F on Mutation { ${aliases(6)} }` });

    expect(response.status).toBe(400);
    expect(postService.remove).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ query: "   " }],
    [{ query: "{ publicaciones" }],
    [{ query: "{ inexistente }" }],
    [{ query: "{ publicaciones { page } }", variables: [1] }],
    [{ query: "{ publicaciones { page } }", operationName: 3 }],
  ])("responde 400 ante una solicitud invalida %#", async (body) => {
    expect((await send(body)).status).toBe(400);
  });
});
