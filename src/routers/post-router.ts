import { Router } from "express";
import PostController from "../controllers/post-controller";
import requireAuthentication from "../middlewares/require-authentication";
import requireRoles from "../middlewares/require-roles";
import idempotency from "../middlewares/idempotency";

function postRouter(): Router {
  const router = Router();
  const requireAdmin = requireRoles("ADMINISTRACION");

  router.get("/", requireAuthentication, PostController.list);
  router.get("/:id", requireAuthentication, PostController.getById);
  router.post("/", requireAuthentication, requireAdmin, idempotency, PostController.create);
  router.put("/:id", requireAuthentication, requireAdmin, PostController.update);
  router.patch("/:id/fijar", requireAuthentication, requireAdmin, PostController.pin);
  router.patch("/:id/desfijar", requireAuthentication, requireAdmin, PostController.unpin);
  router.delete("/:id", requireAuthentication, requireAdmin, PostController.remove);

  return router;
}

export default postRouter;
