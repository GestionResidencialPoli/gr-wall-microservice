import knex from "../db/knex";
import type { PublicacionRow } from "../types/components/post";
import type { CategoriaPublicacion } from "../types/enums/categoria-publicacion";

const TABLE = "publicaciones";

function baseVisibleQuery() {
  return knex<PublicacionRow>(TABLE)
    .whereNull("eliminado_en")
    .andWhere((builder) => builder.whereNull("vigencia_hasta").orWhere("vigencia_hasta", ">=", knex.fn.now()));
}

interface FindPageParams {
  page: number;
  size: number;
  categoria?: CategoriaPublicacion;
}

class PostRepository {
  public static async findPage({ page, size, categoria }: FindPageParams): Promise<{ rows: PublicacionRow[]; total: number }> {
    const filtered = () => {
      const query = baseVisibleQuery();
      return categoria ? query.andWhere("categoria", categoria) : query;
    };

    const [rows, countRows] = await Promise.all([
      filtered().orderBy([{ column: "fijada", order: "desc" }, { column: "created_at", order: "desc" }]).offset(page * size).limit(size),
      filtered().count<{ count: string }[]>({ count: "*" }),
    ]);

    return { rows, total: Number(countRows[0]?.count ?? 0) };
  }

  public static async findVisibleById(id: number): Promise<PublicacionRow | undefined> {
    return baseVisibleQuery().andWhere("id", id).first();
  }

  public static async countFijadas(): Promise<number> {
    const result = await knex<PublicacionRow>(TABLE).whereNull("eliminado_en").andWhere("fijada", true).count<{ count: string }[]>({
      count: "*",
    });
    return Number(result[0]?.count ?? 0);
  }

  public static async insert(data: {
    autorUserId: number;
    autorNombre: string;
    titulo: string;
    cuerpo: string;
    categoria: CategoriaPublicacion;
    vigenciaHasta: string | null;
  }): Promise<PublicacionRow> {
    const [row] = await knex<PublicacionRow>(TABLE)
      .insert({
        autor_user_id: data.autorUserId,
        autor_nombre: data.autorNombre,
        titulo: data.titulo,
        cuerpo: data.cuerpo,
        categoria: data.categoria,
        vigencia_hasta: data.vigenciaHasta,
      })
      .returning("*");

    return row as PublicacionRow;
  }

  public static async update(
    id: number,
    data: { titulo: string; cuerpo: string; categoria: CategoriaPublicacion; vigenciaHasta: string | null },
  ): Promise<PublicacionRow | undefined> {
    const [row] = await knex<PublicacionRow>(TABLE)
      .where({ id })
      .whereNull("eliminado_en")
      .update({
        titulo: data.titulo,
        cuerpo: data.cuerpo,
        categoria: data.categoria,
        vigencia_hasta: data.vigenciaHasta,
        updated_at: knex.fn.now(),
      })
      .returning("*");

    return row as PublicacionRow | undefined;
  }

  public static async setFijada(id: number, fijada: boolean): Promise<PublicacionRow | undefined> {
    const [row] = await knex<PublicacionRow>(TABLE).where({ id }).whereNull("eliminado_en").update({ fijada }).returning("*");

    return row as PublicacionRow | undefined;
  }

  public static async softDelete(id: number): Promise<number> {
    return knex<PublicacionRow>(TABLE).where({ id }).whereNull("eliminado_en").update({ eliminado_en: knex.fn.now() });
  }
}

export default PostRepository;
