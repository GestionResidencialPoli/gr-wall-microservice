import { describe, expect, it, vi } from "vitest";
import { graphql } from "graphql";

const postService = vi.hoisted(() => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
}));

const userServiceClient = vi.hoisted(() => ({ fetchAuthorName: vi.fn() }));

vi.mock("../services/post-service", () => ({ default: postService }));
vi.mock("../lib/user-service-client", () => ({ default: userServiceClient }));

import { graphQLRoot, graphQLSchema, type GraphQLContext } from "./schema";

const resident: GraphQLContext = {
  auth: { sub: "resident@example.com", uid: 7, roles: ["RESIDENTE"] },
};
const administrator: GraphQLContext = {
  auth: { sub: "admin@example.com", uid: 1, roles: ["ADMINISTRACION"] },
};

const publication = {
  id: 10,
  autorUserId: 1,
  autorNombre: "Administracion",
  titulo: "Corte de agua",
  cuerpo: "El corte sera el sabado.",
  categoria: "AVISO",
  fijada: false,
  vigenciaHasta: null,
  editada: false,
  createdAt: "2030-01-01T10:00:00.000Z",
  updatedAt: "2030-01-01T10:00:00.000Z",
};

describe("GraphQL del muro", () => {
  it("permite consultar publicaciones a usuarios autenticados", async () => {
    postService.list.mockResolvedValue({
      content: [{ id: 10, autorNombre: "Administracion", titulo: "Corte de agua", extracto: "El corte sera el sabado.", categoria: "AVISO", fijada: false, createdAt: publication.createdAt }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    });

    const result = await graphql({
      schema: graphQLSchema,
      source: "query { publicaciones { content { id titulo categoria } totalElements } }",
      rootValue: graphQLRoot,
      contextValue: resident,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.publicaciones).toEqual({
      content: [{ id: "10", titulo: "Corte de agua", categoria: "AVISO" }],
      totalElements: 1,
    });
  });

  it("rechaza mutaciones de usuarios que no son administradores", async () => {
    const result = await graphql({
      schema: graphQLSchema,
      source: 'mutation { eliminarPublicacion(id: "10") }',
      rootValue: graphQLRoot,
      contextValue: resident,
    });

    expect(result.errors?.[0]?.extensions.code).toBe("FORBIDDEN");
    expect(postService.remove).not.toHaveBeenCalled();
  });

  it("ejecuta el CRUD de publicaciones para administracion", async () => {
    userServiceClient.fetchAuthorName.mockResolvedValue("Administracion");
    postService.create.mockResolvedValue(publication);
    postService.update.mockResolvedValue({ ...publication, titulo: "Corte actualizado" });
    postService.remove.mockResolvedValue(true);

    const createResult = await graphql({
      schema: graphQLSchema,
      source: 'mutation { crearPublicacion(input: { titulo: "Corte de agua", cuerpo: "El corte sera el sabado.", categoria: AVISO }) { id titulo } }',
      rootValue: graphQLRoot,
      contextValue: administrator,
    });
    const updateResult = await graphql({
      schema: graphQLSchema,
      source: 'mutation { actualizarPublicacion(id: "10", input: { titulo: "Corte actualizado", cuerpo: "Nuevo horario.", categoria: AVISO }) { id titulo } }',
      rootValue: graphQLRoot,
      contextValue: administrator,
    });
    const deleteResult = await graphql({
      schema: graphQLSchema,
      source: 'mutation { eliminarPublicacion(id: "10") }',
      rootValue: graphQLRoot,
      contextValue: administrator,
    });

    expect(createResult.errors).toBeUndefined();
    expect(createResult.data?.crearPublicacion).toEqual({ id: "10", titulo: "Corte de agua" });
    expect(updateResult.errors).toBeUndefined();
    expect(updateResult.data?.actualizarPublicacion).toEqual({ id: "10", titulo: "Corte actualizado" });
    expect(deleteResult.errors).toBeUndefined();
    expect(deleteResult.data?.eliminarPublicacion).toBe(true);
  });
});
