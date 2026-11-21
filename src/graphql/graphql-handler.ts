import type { Request, Response } from "express";
import { graphql } from "graphql";
import { graphQLRoot, graphQLSchema, type GraphQLContext } from "./schema";

interface GraphQLRequestBody {
  query?: unknown;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

export async function handleGraphQL(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as GraphQLRequestBody;
  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    res.status(400).json({ errors: [{ message: "La propiedad query es obligatoria." }] });
    return;
  }

  const result = await graphql({
    schema: graphQLSchema,
    source: body.query,
    rootValue: graphQLRoot,
    contextValue: { auth: req.auth ?? null } satisfies GraphQLContext,
    variableValues: body.variables ?? undefined,
    operationName: body.operationName ?? undefined,
  });

  const hasOnlyRequestErrors = result.errors && !result.data;
  res.status(hasOnlyRequestErrors ? 400 : 200).json(result);
}
