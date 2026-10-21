import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import Logger from "../lib/logger";
import DomainError from "../lib/domain-error";

function handleError(error: Error, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "La solicitud no es valida.",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  Logger.error(error, { url: req.originalUrl, method: req.method });
  res.status(500).json({ error: { message: "Error interno del servicio." } });
}

export default handleError;
