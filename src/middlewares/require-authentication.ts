import type { NextFunction, Request, Response } from "express";

function requireAuthentication(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: { message: "Se requiere autenticacion para acceder a este recurso." } });
    return;
  }

  next();
}

export default requireAuthentication;
