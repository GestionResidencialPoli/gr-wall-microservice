import type { NextFunction, Request, Response } from "express";
import BaseController from "./base-controller";
import PostService from "../services/post-service";
import PostValidator from "../validators/post-validator";
import UserServiceClient from "../lib/user-service-client";
import HttpStatus from "../types/enums/http-status";

class PostController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = PostValidator.listQuery(req.query);
      const result = await PostService.list(query);

      BaseController.handleSuccess(res, { payload: result });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const publicacion = await PostService.getDetail(id);

      if (!publicacion) {
        res.status(HttpStatus.NotFound).json({ error: { message: "Publicacion no encontrada." } });
        return;
      }

      BaseController.handleSuccess(res, { payload: publicacion });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = PostValidator.create(req.body);
      const autorNombre = await UserServiceClient.fetchAuthorName(req.auth!.uid);
      const publicacion = await PostService.create(req.auth!.uid, autorNombre, input);

      BaseController.handleSuccess(res, { statusCode: HttpStatus.Created, payload: publicacion });
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const input = PostValidator.update(req.body);
      const publicacion = await PostService.update(id, input);

      if (!publicacion) {
        res.status(HttpStatus.NotFound).json({ error: { message: "Publicacion no encontrada." } });
        return;
      }

      BaseController.handleSuccess(res, { payload: publicacion });
    } catch (error) {
      next(error);
    }
  }

  public static async pin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const publicacion = await PostService.pin(id);

      if (!publicacion) {
        res.status(HttpStatus.NotFound).json({ error: { message: "Publicacion no encontrada." } });
        return;
      }

      BaseController.handleSuccess(res, { payload: publicacion });
    } catch (error) {
      next(error);
    }
  }

  public static async unpin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const publicacion = await PostService.unpin(id);

      if (!publicacion) {
        res.status(HttpStatus.NotFound).json({ error: { message: "Publicacion no encontrada." } });
        return;
      }

      BaseController.handleSuccess(res, { payload: publicacion });
    } catch (error) {
      next(error);
    }
  }

  public static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const removed = await PostService.remove(id);

      if (!removed) {
        res.status(HttpStatus.NotFound).json({ error: { message: "Publicacion no encontrada." } });
        return;
      }

      res.status(HttpStatus.NoContent).send();
    } catch (error) {
      next(error);
    }
  }
}

export default PostController;
