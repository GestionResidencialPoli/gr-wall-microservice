import type { CategoriaPublicacion } from "../enums/categoria-publicacion";

export interface PublicacionRow {
  id: number;
  autor_user_id: number;
  autor_nombre: string;
  titulo: string;
  cuerpo: string;
  categoria: CategoriaPublicacion;
  fijada: boolean;
  vigencia_hasta: string | null;
  eliminado_en: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicacionDto {
  id: number;
  autorUserId: number;
  autorNombre: string;
  titulo: string;
  cuerpo: string;
  categoria: CategoriaPublicacion;
  fijada: boolean;
  vigenciaHasta: string | null;
  editada: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicacionResumenDto {
  id: number;
  autorNombre: string;
  titulo: string;
  extracto: string;
  categoria: CategoriaPublicacion;
  fijada: boolean;
  createdAt: string;
}

export interface CreatePublicacionInput {
  titulo: string;
  cuerpo: string;
  categoria: CategoriaPublicacion;
  vigenciaHasta?: string | null;
}

export interface UpdatePublicacionInput {
  titulo: string;
  cuerpo: string;
  categoria: CategoriaPublicacion;
  vigenciaHasta?: string | null;
}

export interface PageResult<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
