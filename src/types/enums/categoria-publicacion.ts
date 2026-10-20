export const CATEGORIAS_PUBLICACION = ["AVISO", "NOTICIA", "URGENTE", "MANTENIMIENTO"] as const;

export type CategoriaPublicacion = (typeof CATEGORIAS_PUBLICACION)[number];
