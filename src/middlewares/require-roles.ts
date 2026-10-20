import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../lib/token-service";

function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roles = req.auth?.roles ?? [];
    const isAllowed = roles.some((role) => allowedRoles.includes(role));

    if (!isAllowed) {
      res.status(403).json({ error: { message: "No tienes permisos para acceder a este recurso." } });
      return;
    }

    next();
  };
}

export default requireRoles;
