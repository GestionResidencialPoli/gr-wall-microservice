import { GraphQLError, buildSchema } from "graphql";
import { ZodError } from "zod";
import DomainError from "../lib/domain-error";
import UserServiceClient from "../lib/user-service-client";
import PostService from "../services/post-service";
import PostValidator from "../validators/post-validator";
import type { AccessTokenClaims } from "../lib/token-service";

export interface GraphQLContext {
  auth: AccessTokenClaims | null;
}

const typeDefinitions = /* GraphQL */ `
  enum CategoriaPublicacion {
    AVISO
    NOTICIA
    URGENTE
    MANTENIMIENTO
  }

  input PublicacionInput {
    titulo: String!
    cuerpo: String!
    categoria: CategoriaPublicacion!
    vigenciaHasta: String
  }

  type Publicacion {
    id: ID!
    autorUserId: Int!
    autorNombre: String!
    titulo: String!
    cuerpo: String!
    categoria: CategoriaPublicacion!
    fijada: Boolean!
    vigenciaHasta: String
    editada: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type PublicacionResumen {
    id: ID!
    autorNombre: String!
    titulo: String!
    extracto: String!
    categoria: CategoriaPublicacion!
    fijada: Boolean!
    createdAt: String!
  }

  type PublicacionesPage {
    content: [PublicacionResumen!]!
    page: Int!
    size: Int!
    totalElements: Int!
    totalPages: Int!
  }

  type Query {
    publicaciones(page: Int = 0, size: Int = 10, categoria: CategoriaPublicacion): PublicacionesPage!
    publicacion(id: ID!): Publicacion
  }

  type Mutation {
    crearPublicacion(input: PublicacionInput!): Publicacion!
    actualizarPublicacion(id: ID!, input: PublicacionInput!): Publicacion!
    eliminarPublicacion(id: ID!): Boolean!
    fijarPublicacion(id: ID!): Publicacion!
    desfijarPublicacion(id: ID!): Publicacion!
  }
`;

export const graphQLSchema = buildSchema(typeDefinitions);

function requireAuthentication(context: GraphQLContext): AccessTokenClaims {
  if (!context.auth) {
    throw new GraphQLError("Se requiere autenticacion para acceder a este recurso.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  return context.auth;
}

function requireAdministrator(context: GraphQLContext): AccessTokenClaims {
  const auth = requireAuthentication(context);
  if (!auth.roles.includes("ADMINISTRACION")) {
    throw new GraphQLError("Solo la administracion puede modificar el tablero.", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  return auth;
}

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new GraphQLError("El id de la publicacion debe ser un entero positivo.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  return id;
}

function mapResolverError(error: unknown): never {
  if (error instanceof GraphQLError) throw error;

  if (error instanceof ZodError) {
    throw new GraphQLError(error.issues[0]?.message ?? "La entrada no es valida.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (error instanceof DomainError) {
    const code = error.statusCode === 409 ? "CONFLICT" : "BAD_REQUEST";
    throw new GraphQLError(error.message, { extensions: { code } });
  }

  throw error;
}

function resolver<T>(operation: () => Promise<T>): Promise<T> {
  return operation().catch(mapResolverError);
}

export const graphQLRoot = {
  publicaciones: (_args: unknown, context: GraphQLContext) =>
    resolver(async () => {
      requireAuthentication(context);
      return PostService.list(PostValidator.listQuery(_args));
    }),

  publicacion: (args: { id: string }, context: GraphQLContext) =>
    resolver(async () => {
      requireAuthentication(context);
      const publicacion = await PostService.getDetail(parseId(args.id));
      if (!publicacion) {
        throw new GraphQLError("Publicacion no encontrada.", { extensions: { code: "NOT_FOUND" } });
      }
      return publicacion;
    }),

  crearPublicacion: (args: { input: unknown }, context: GraphQLContext) =>
    resolver(async () => {
      const auth = requireAdministrator(context);
      const input = PostValidator.create(args.input);
      const autorNombre = await UserServiceClient.fetchAuthorName(auth.uid);
      return PostService.create(auth.uid, autorNombre, input);
    }),

  actualizarPublicacion: (args: { id: string; input: unknown }, context: GraphQLContext) =>
    resolver(async () => {
      requireAdministrator(context);
      const publicacion = await PostService.update(parseId(args.id), PostValidator.update(args.input));
      if (!publicacion) {
        throw new GraphQLError("Publicacion no encontrada.", { extensions: { code: "NOT_FOUND" } });
      }
      return publicacion;
    }),

  eliminarPublicacion: (args: { id: string }, context: GraphQLContext) =>
    resolver(async () => {
      requireAdministrator(context);
      const removed = await PostService.remove(parseId(args.id));
      if (!removed) {
        throw new GraphQLError("Publicacion no encontrada.", { extensions: { code: "NOT_FOUND" } });
      }
      return true;
    }),

  fijarPublicacion: (args: { id: string }, context: GraphQLContext) =>
    resolver(async () => {
      requireAdministrator(context);
      const publicacion = await PostService.pin(parseId(args.id));
      if (!publicacion) {
        throw new GraphQLError("Publicacion no encontrada.", { extensions: { code: "NOT_FOUND" } });
      }
      return publicacion;
    }),

  desfijarPublicacion: (args: { id: string }, context: GraphQLContext) =>
    resolver(async () => {
      requireAdministrator(context);
      const publicacion = await PostService.unpin(parseId(args.id));
      if (!publicacion) {
        throw new GraphQLError("Publicacion no encontrada.", { extensions: { code: "NOT_FOUND" } });
      }
      return publicacion;
    }),
};
