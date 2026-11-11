import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import config from "../config";
import TokenService from "./token-service";
import { decryptNestedJwt, encryptNestedJwt } from "./jwe";

const payload = { sub: "residente@gr.test", uid: 7, roles: ["RESIDENTE"] };

function accessToken(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return encryptNestedJwt(
    jwt.sign({ ...payload, ...overrides }, config.jwtSecret, { algorithm: "HS256", ...options }),
    config.jwtEncryptionKey,
  );
}

describe("TokenService.verifyAccessToken", () => {
  it("devuelve los claims de un token cifrado y firmado valido", () => {
    expect(TokenService.verifyAccessToken(accessToken())).toEqual({ ...payload, tipoResidente: undefined });
  });

  it("rechaza un JWT firmado pero no cifrado", () => {
    expect(TokenService.verifyAccessToken(jwt.sign(payload, config.jwtSecret, { algorithm: "HS256" }))).toBeNull();
  });

  it("rechaza un token expirado", () => {
    expect(TokenService.verifyAccessToken(accessToken({}, { expiresIn: -10 }))).toBeNull();
  });

  it("rechaza un token con scope aunque este firmado con JWT_SECRET", () => {
    expect(TokenService.verifyAccessToken(accessToken({ scope: "wall-events" }))).toBeNull();
  });
});

describe("ticket de eventos del muro", () => {
  it("se emite cifrado y se verifica con su propio jti", () => {
    const ticket = TokenService.createWallEventsTicket({ ...payload, roles: ["RESIDENTE"] });
    const verified = TokenService.verifyWallEventsTicket(ticket);

    expect(ticket.split(".")).toHaveLength(5);
    expect(verified?.claims).toEqual({ ...payload, tipoResidente: undefined });
    expect(verified?.jti).toEqual(expect.any(String));
  });

  it("no sirve como access token", () => {
    const ticket = TokenService.createWallEventsTicket({ ...payload, roles: ["RESIDENTE"] });

    expect(TokenService.verifyAccessToken(ticket)).toBeNull();
  });

  it("no esta firmado con JWT_SECRET, asi que ningun otro servicio puede validarlo", () => {
    const ticket = TokenService.createWallEventsTicket({ ...payload, roles: ["RESIDENTE"] });
    const signedTicket = decryptNestedJwt(ticket, config.jwtEncryptionKey) ?? "";

    expect(() => jwt.verify(signedTicket, config.jwtSecret, { algorithms: ["HS256"] })).toThrow();
  });

  it("un access token no sirve como ticket", () => {
    expect(TokenService.verifyWallEventsTicket(accessToken())).toBeNull();
  });

  it("rechaza un ticket expirado", () => {
    const ticketSecret = createHmac("sha256", config.jwtSecret).update("wall-events-ticket").digest();
    const expired = encryptNestedJwt(
      jwt.sign({ ...payload, scope: "wall-events" }, ticketSecret, { algorithm: "HS256", expiresIn: -10, jwtid: "x" }),
      config.jwtEncryptionKey,
    );

    expect(TokenService.verifyWallEventsTicket(expired)).toBeNull();
  });
});
