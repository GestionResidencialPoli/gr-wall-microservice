import { describe, expect, it } from "vitest";
import PostValidator from "./post-validator";

const validInput = {
  titulo: "Corte de agua programado",
  cuerpo: "El corte sera el sabado de 8am a 12m.",
  categoria: "AVISO",
};

describe("PostValidator.create", () => {
  it("acepta una publicacion valida", () => {
    expect(() => PostValidator.create(validInput)).not.toThrow();
  });

  it("rechaza titulo vacio", () => {
    expect(() => PostValidator.create({ ...validInput, titulo: "" })).toThrow();
  });

  it("rechaza cuerpo que supera los 10000 caracteres", () => {
    expect(() => PostValidator.create({ ...validInput, cuerpo: "a".repeat(10_001) })).toThrow();
  });

  it("acepta un cuerpo de exactamente 10000 caracteres", () => {
    expect(() => PostValidator.create({ ...validInput, cuerpo: "a".repeat(10_000) })).not.toThrow();
  });

  it("rechaza una categoria fuera del enum", () => {
    expect(() => PostValidator.create({ ...validInput, categoria: "SPAM" })).toThrow();
  });

  it("rechaza una vigenciaHasta anterior a hoy", () => {
    expect(() => PostValidator.create({ ...validInput, vigenciaHasta: "2000-01-01" })).toThrow();
  });

  it("acepta sin vigenciaHasta (opcional)", () => {
    const result = PostValidator.create(validInput);
    expect(result.vigenciaHasta).toBeUndefined();
  });
});

describe("PostValidator.listQuery", () => {
  it("aplica los valores por defecto", () => {
    const result = PostValidator.listQuery({});
    expect(result).toEqual({ page: 0, size: 10 });
  });

  it("coacciona page y size desde strings de query params", () => {
    const result = PostValidator.listQuery({ page: "2", size: "25" });
    expect(result).toEqual({ page: 2, size: 25 });
  });

  it("rechaza size mayor a 50", () => {
    expect(() => PostValidator.listQuery({ size: "51" })).toThrow();
  });

  it("rechaza page negativo", () => {
    expect(() => PostValidator.listQuery({ page: "-1" })).toThrow();
  });
});
