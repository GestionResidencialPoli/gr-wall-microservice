import type { Request, Response } from "express";
import {
  GraphQLError,
  execute,
  parse,
  specifiedRules,
  validate,
  type DocumentNode,
  type ExecutionResult,
  type GraphQLFormattedError,
} from "graphql";
import Logger from "../lib/logger";
import { MAX_TOKENS, rootFieldsLimit } from "./operation-limits";
import { graphQLRoot, graphQLSchema, type GraphQLContext } from "./schema";

const RULES = [...specifiedRules, rootFieldsLimit];

interface GraphQLRequestBody {
  query?: unknown;
  variables?: unknown;
  operationName?: unknown;
}

function isVariables(value: unknown): value is Record<string, unknown> | null | undefined {
  return value === undefined || value === null || (typeof value === "object" && !Array.isArray(value));
}

function isOperationName(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isInternal(error: GraphQLError): boolean {
  return Boolean(error.originalError) && !(error.originalError instanceof GraphQLError);
}

function toPublicError(error: GraphQLError): GraphQLFormattedError {
  if (!isInternal(error)) return error.toJSON();

  Logger.error(error.originalError as Error, { source: "graphql", path: error.path?.join(".") });
  return {
    message: "Error interno del servicio.",
    path: error.path,
    extensions: { code: "INTERNAL_SERVER_ERROR" },
  };
}

function statusFor(result: ExecutionResult): number {
  if (!result.errors || result.data) return 200;
  return result.errors.some(isInternal) ? 500 : 400;
}

function parseDocument(source: string): DocumentNode | GraphQLError {
  try {
    return parse(source, { maxTokens: MAX_TOKENS });
  } catch (error) {
    if (error instanceof GraphQLError) return error;
    throw error;
  }
}

export async function handleGraphQL(req: Request, res: Response): Promise<void> {
  const { query, variables, operationName } = (req.body ?? {}) as GraphQLRequestBody;

  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ errors: [{ message: "La propiedad query es obligatoria." }] });
    return;
  }
  if (!isVariables(variables) || !isOperationName(operationName)) {
    res.status(400).json({ errors: [{ message: "Las variables o el nombre de la operacion no son validos." }] });
    return;
  }

  const document = parseDocument(query);
  if (document instanceof GraphQLError) {
    res.status(400).json({ errors: [document.toJSON()] });
    return;
  }

  const validationErrors = validate(graphQLSchema, document, RULES);
  if (validationErrors.length > 0) {
    res.status(400).json({ errors: validationErrors.map((error) => error.toJSON()) });
    return;
  }

  const result = await execute({
    schema: graphQLSchema,
    document,
    rootValue: graphQLRoot,
    contextValue: { auth: req.auth ?? null } satisfies GraphQLContext,
    variableValues: variables ?? undefined,
    operationName: operationName ?? undefined,
  });

  res.status(statusFor(result)).json({ ...result, errors: result.errors?.map(toPublicError) });
}
