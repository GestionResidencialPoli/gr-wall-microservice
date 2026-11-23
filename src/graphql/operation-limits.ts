import { GraphQLError, type ASTVisitor, type ValidationContext } from "graphql";

const MAX_CAMPOS_RAIZ = 5;
const TIPOS_RAIZ = new Set(["Query", "Mutation"]);

export const MAX_TOKENS = 1000;

export function rootFieldsLimit(context: ValidationContext): ASTVisitor {
  let total = 0;

  return {
    Field(node) {
      if (!TIPOS_RAIZ.has(context.getParentType()?.name ?? "")) return;

      total += 1;
      if (total === MAX_CAMPOS_RAIZ + 1) {
        context.reportError(
          new GraphQLError(`La solicitud supera el limite de ${MAX_CAMPOS_RAIZ} operaciones.`, {
            nodes: [node],
            extensions: { code: "BAD_USER_INPUT" },
          }),
        );
      }
    },
  };
}
