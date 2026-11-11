import { createHmac, randomUUID } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../config";
import { decryptNestedJwt, encryptNestedJwt } from "./jwe";

export type UserRole = "ADMINISTRACION" | "VIGILANTE" | "RESIDENTE";

export interface AccessTokenClaims {
  sub: string;
  uid: number;
  roles: UserRole[];
  tipoResidente?: string;
}

export interface WallEventsTicket {
  claims: AccessTokenClaims;
  jti: string;
}

const WALL_EVENTS_SCOPE = "wall-events";
const WALL_EVENTS_TICKET_TTL_SECONDS = 60;
const wallEventsTicketSecret = createHmac("sha256", config.jwtSecret).update("wall-events-ticket").digest();

function isAccessTokenClaims(payload: JwtPayload): payload is JwtPayload & AccessTokenClaims {
  return (
    typeof payload.sub === "string" &&
    typeof payload.uid === "number" &&
    Array.isArray(payload.roles) &&
    payload.roles.every((role: unknown) => typeof role === "string")
  );
}

function toClaims(payload: JwtPayload & AccessTokenClaims): AccessTokenClaims {
  return {
    sub: payload.sub,
    uid: payload.uid,
    roles: payload.roles,
    tipoResidente: payload.tipoResidente,
  };
}

function verifyNested(token: string, secret: jwt.Secret): JwtPayload | null {
  const signedToken = decryptNestedJwt(token, config.jwtEncryptionKey);
  if (!signedToken) return null;

  try {
    const payload = jwt.verify(signedToken, secret, { algorithms: ["HS256"] });
    return typeof payload === "string" ? null : payload;
  } catch {
    return null;
  }
}

class TokenService {
  public static readonly wallEventsTicketTtlSeconds = WALL_EVENTS_TICKET_TTL_SECONDS;

  public static verifyAccessToken(token: string): AccessTokenClaims | null {
    const payload = verifyNested(token, config.jwtSecret);
    if (!payload || payload.scope !== undefined || !isAccessTokenClaims(payload)) return null;
    return toClaims(payload);
  }

  public static createWallEventsTicket(claims: AccessTokenClaims): string {
    const signedTicket = jwt.sign(
      { sub: claims.sub, uid: claims.uid, roles: claims.roles, scope: WALL_EVENTS_SCOPE },
      wallEventsTicketSecret,
      { algorithm: "HS256", expiresIn: WALL_EVENTS_TICKET_TTL_SECONDS, jwtid: randomUUID() },
    );
    return encryptNestedJwt(signedTicket, config.jwtEncryptionKey);
  }

  public static verifyWallEventsTicket(token: string): WallEventsTicket | null {
    const payload = verifyNested(token, wallEventsTicketSecret);
    if (
      !payload ||
      payload.scope !== WALL_EVENTS_SCOPE ||
      typeof payload.jti !== "string" ||
      !isAccessTokenClaims(payload)
    ) {
      return null;
    }
    return { claims: toClaims(payload), jti: payload.jti };
  }
}

export default TokenService;
