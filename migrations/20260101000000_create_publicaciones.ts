import type { Knex } from "knex";

const CATEGORIAS = ["AVISO", "NOTICIA", "URGENTE", "MANTENIMIENTO"];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("publicaciones", (table) => {
    table.bigIncrements("id").primary();
    table.bigInteger("autor_user_id").notNullable();
    table.string("autor_nombre", 200).notNullable();
    table.string("titulo", 150).notNullable();
    table.text("cuerpo").notNullable();
    table.string("categoria", 20).notNullable();
    table.boolean("fijada").notNullable().defaultTo(false);
    table.date("vigencia_hasta").nullable();
    table.timestamp("eliminado_en", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check("?? = ANY (?)", ["categoria", CATEGORIAS], "ck_publicaciones_categoria");
  });

  await knex.raw(`
    CREATE INDEX idx_publicaciones_muro
    ON publicaciones (fijada DESC, created_at DESC)
    WHERE eliminado_en IS NULL
  `);

  await knex.raw(`
    CREATE INDEX idx_publicaciones_categoria
    ON publicaciones (categoria)
    WHERE eliminado_en IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("publicaciones");
}
