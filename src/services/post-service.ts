import PostRepository from "../repositories/post-repository";
import WallCache from "../lib/wall-cache";
import WallEventsPublisher from "../lib/wall-events-publisher";
import DomainError from "../lib/domain-error";
import type {
  CreatePublicacionInput,
  PageResult,
  PublicacionDto,
  PublicacionResumenDto,
  PublicacionRow,
  UpdatePublicacionInput,
} from "../types/components/post";

const MAX_PUBLICACIONES_FIJADAS = 3;
const EXTRACTO_LENGTH = 200;

function toDto(row: PublicacionRow): PublicacionDto {
  return {
    id: Number(row.id),
    autorUserId: Number(row.autor_user_id),
    autorNombre: row.autor_nombre,
    titulo: row.titulo,
    cuerpo: row.cuerpo,
    categoria: row.categoria,
    fijada: row.fijada,
    vigenciaHasta: row.vigencia_hasta,
    editada: row.updated_at.getTime() !== row.created_at.getTime(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toResumenDto(row: PublicacionRow): PublicacionResumenDto {
  const extracto = row.cuerpo.length > EXTRACTO_LENGTH ? `${row.cuerpo.slice(0, EXTRACTO_LENGTH)}...` : row.cuerpo;

  return {
    id: Number(row.id),
    autorNombre: row.autor_nombre,
    titulo: row.titulo,
    extracto,
    categoria: row.categoria,
    fijada: row.fijada,
    createdAt: row.created_at.toISOString(),
  };
}

interface ListParams {
  page: number;
  size: number;
  categoria?: PublicacionRow["categoria"];
}

class PostService {
  public static async list(params: ListParams): Promise<PageResult<PublicacionResumenDto>> {
    const cacheKey = `page=${params.page}:size=${params.size}:categoria=${params.categoria ?? "todas"}`;
    const cached = await WallCache.get<PageResult<PublicacionResumenDto>>(cacheKey);
    if (cached) return cached;

    const { rows, total } = await PostRepository.findPage(params);
    const result: PageResult<PublicacionResumenDto> = {
      content: rows.map(toResumenDto),
      page: params.page,
      size: params.size,
      totalElements: total,
      totalPages: Math.ceil(total / params.size),
    };

    await WallCache.set(cacheKey, result);
    return result;
  }

  public static async getDetail(id: number): Promise<PublicacionDto | null> {
    const row = await PostRepository.findVisibleById(id);
    return row ? toDto(row) : null;
  }

  public static async create(authorUserId: number, authorNombre: string, input: CreatePublicacionInput): Promise<PublicacionDto> {
    const row = await PostRepository.insert({
      autorUserId: authorUserId,
      autorNombre: authorNombre,
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      categoria: input.categoria,
      vigenciaHasta: input.vigenciaHasta ?? null,
    });

    await WallCache.invalidateAll();
    await WallEventsPublisher.publish({ type: "post.created", postId: Number(row.id), categoria: row.categoria, fijada: row.fijada });

    return toDto(row);
  }

  public static async update(id: number, input: UpdatePublicacionInput): Promise<PublicacionDto | null> {
    const row = await PostRepository.update(id, {
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      categoria: input.categoria,
      vigenciaHasta: input.vigenciaHasta ?? null,
    });
    if (!row) return null;

    await WallCache.invalidateAll();
    await WallEventsPublisher.publish({ type: "post.updated", postId: Number(row.id), categoria: row.categoria, fijada: row.fijada });

    return toDto(row);
  }

  public static async pin(id: number): Promise<PublicacionDto | null> {
    const existing = await PostRepository.findVisibleById(id);
    if (!existing) return null;
    if (existing.fijada) return toDto(existing);

    const fijadas = await PostRepository.countFijadas();
    if (fijadas >= MAX_PUBLICACIONES_FIJADAS) {
      throw new DomainError(409, "Ya hay tres publicaciones fijadas. Desfija alguna antes de fijar otra.");
    }

    const row = await PostRepository.setFijada(id, true);
    if (!row) return null;

    await WallCache.invalidateAll();
    await WallEventsPublisher.publish({ type: "post.updated", postId: Number(row.id), categoria: row.categoria, fijada: true });

    return toDto(row);
  }

  public static async unpin(id: number): Promise<PublicacionDto | null> {
    const row = await PostRepository.setFijada(id, false);
    if (!row) return null;

    await WallCache.invalidateAll();
    await WallEventsPublisher.publish({ type: "post.updated", postId: Number(row.id), categoria: row.categoria, fijada: false });

    return toDto(row);
  }

  public static async remove(id: number): Promise<boolean> {
    const existing = await PostRepository.findVisibleById(id);
    if (!existing) return false;

    await PostRepository.softDelete(id);
    await WallCache.invalidateAll();
    await WallEventsPublisher.publish({
      type: "post.retired",
      postId: id,
      categoria: existing.categoria,
      fijada: existing.fijada,
    });

    return true;
  }
}

export default PostService;
