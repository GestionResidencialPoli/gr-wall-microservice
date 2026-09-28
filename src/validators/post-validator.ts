import { z } from "zod";
import config from "../config";
import { CATEGORIAS_PUBLICACION } from "../types/enums/categoria-publicacion";

function hoyEnColombia(): string {
  const [signo, horas, minutos] = [config.zonaHoraria.offset[0], ...config.zonaHoraria.offset.slice(1).split(":")];
  const desfaseMs = (Number(horas) * 60 + Number(minutos)) * 60_000 * (signo === "-" ? -1 : 1);
  return new Date(Date.now() + desfaseMs).toISOString().slice(0, 10);
}

const vigenciaHastaSchema = z
  .string()
  .date()
  .refine((value) => value >= hoyEnColombia(), {
    message: "La fecha de vigencia no puede ser anterior a hoy.",
  })
  .nullable()
  .optional();

export const createPublicacionSchema = z.object({
  titulo: z.string().trim().min(1, "El titulo es obligatorio.").max(150, "El titulo supera los 150 caracteres."),
  cuerpo: z.string().trim().min(1, "El cuerpo es obligatorio.").max(10_000, "El cuerpo supera los 10000 caracteres."),
  categoria: z.enum(CATEGORIAS_PUBLICACION),
  vigenciaHasta: vigenciaHastaSchema,
});

export const updatePublicacionSchema = createPublicacionSchema;

export const listPublicacionesQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(50).default(10),
  categoria: z.enum(CATEGORIAS_PUBLICACION).optional(),
});

class PostValidator {
  public static create(input: unknown) {
    return createPublicacionSchema.parse(input);
  }

  public static update(input: unknown) {
    return updatePublicacionSchema.parse(input);
  }

  public static listQuery(input: unknown) {
    return listPublicacionesQuerySchema.parse(input);
  }
}

export default PostValidator;
