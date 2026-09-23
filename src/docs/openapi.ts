const openapi = {
  openapi: "3.0.3",
  info: {
    title: "GR Wall Microservice",
    version: "1.0.0",
    description: "API del muro de comunicaciones: publicaciones, categorias, fijado y vigencia.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/publicaciones": {
      get: {
        summary: "Listar publicaciones vigentes, paginadas",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 0 } },
          { name: "size", in: "query", schema: { type: "integer", default: 10 } },
          { name: "categoria", in: "query", schema: { type: "string", enum: ["AVISO", "NOTICIA", "URGENTE", "MANTENIMIENTO"] } },
        ],
        responses: { "200": { description: "Pagina de publicaciones" } },
      },
      post: {
        summary: "Publicar un comunicado (solo ADMINISTRACION)",
        responses: { "201": { description: "Publicacion creada" }, "403": { description: "Rol no autorizado" } },
      },
    },
    "/publicaciones/{id}": {
      get: { summary: "Ver el detalle de una publicacion", responses: { "200": { description: "Publicacion" }, "404": { description: "No encontrada" } } },
      put: { summary: "Editar una publicacion (solo ADMINISTRACION)", responses: { "200": { description: "Publicacion actualizada" } } },
      delete: { summary: "Retirar (eliminar logicamente) una publicacion", responses: { "204": { description: "Retirada" } } },
    },
    "/publicaciones/{id}/fijar": {
      patch: { summary: "Fijar una publicacion (maximo 3 simultaneas)", responses: { "200": { description: "Fijada" }, "409": { description: "Limite de fijadas alcanzado" } } },
    },
    "/publicaciones/{id}/desfijar": {
      patch: { summary: "Desfijar una publicacion", responses: { "200": { description: "Desfijada" } } },
    },
  },
};

export default openapi;
