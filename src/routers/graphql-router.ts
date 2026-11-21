import { Router } from "express";
import { handleGraphQL } from "../graphql/graphql-handler";

function graphqlRouter(): Router {
  const router = Router();
  router.post("/", handleGraphQL);
  return router;
}

export default graphqlRouter;
