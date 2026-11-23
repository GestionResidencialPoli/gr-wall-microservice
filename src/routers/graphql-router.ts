import { Router } from "express";
import { handleGraphQL } from "../graphql/graphql-handler";
import idempotency from "../middlewares/idempotency";
import requireAuthentication from "../middlewares/require-authentication";

function graphqlRouter(): Router {
  const router = Router();
  router.post("/", requireAuthentication, idempotency, handleGraphQL);
  return router;
}

export default graphqlRouter;
