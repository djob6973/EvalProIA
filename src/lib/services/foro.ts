// All data access goes through the local REST API (/api/data/*)
// so this layer runs safely in the browser without any DB driver.

export interface ForoAdjunto {
  id?: string;
  nombre: string;
  tipo: string;
  data_url: string;
  tamano: number;
}

export interface ForoArticulo {
  id: string;
  titulo: string;
  contenido: string;
  resumen: string | null;
  autor_id: string;
  autor_nombre?: string;
  autor_email?: string;
  categoria: string | null;
  etiquetas: string[];
  estado: "borrador" | "publicado";
  vistas: number;
  comentarios?: number;
  adjuntos?: ForoAdjunto[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForoComentario {
  id: string;
  articulo_id: string;
  autor_id: string;
  autor_nombre?: string;
  parent_id: string | null;
  contenido: string;
  mentions: string[];
  likes: number;
  liked_by_me: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForoArticuloFilters {
  search?: string;
  categoria?: string;
  etiqueta?: string;
  autor?: string;
  desde?: string;
  hasta?: string;
  orden?: "recientes" | "populares";
}

export interface ForoArticuloInput {
  titulo: string;
  contenido: string;
  resumen?: string | null;
  categoria?: string | null;
  etiquetas: string[];
  estado: "borrador" | "publicado";
  adjuntos?: ForoAdjunto[];
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const r = await fetch(path, options);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error || r.statusText);
  }
  return r.json();
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ── Foro service ──────────────────────────────────────────────────────────────

export const foroService = {
  async getArticulos(filters: ForoArticuloFilters = {}): Promise<ForoArticulo[]> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const qs = params.toString();
    return apiFetch(`/api/data/foro-articulos${qs ? `?${qs}` : ""}`);
  },

  async getArticulo(id: string): Promise<ForoArticulo> {
    return apiFetch(`/api/data/foro-articulos/${id}`);
  },

  async createArticulo(input: ForoArticuloInput): Promise<ForoArticulo> {
    return apiFetch("/api/data/foro-articulos", jsonBody(input));
  },

  async updateArticulo(id: string, input: ForoArticuloInput): Promise<ForoArticulo> {
    return apiFetch(`/api/data/foro-articulos/${id}`, { ...jsonBody(input), method: "PUT" });
  },

  async deleteArticulo(id: string): Promise<void> {
    await apiFetch(`/api/data/foro-articulos/${id}`, { method: "DELETE" });
  },

  async getComentarios(articuloId: string): Promise<ForoComentario[]> {
    return apiFetch(`/api/data/foro-comentarios/by-articulo/${articuloId}`);
  },

  async createComentario(input: {
    articulo_id: string;
    contenido: string;
    parent_id?: string;
    mentions?: string[];
  }): Promise<ForoComentario> {
    return apiFetch("/api/data/foro-comentarios", jsonBody(input));
  },

  async updateComentario(
    id: string,
    input: { contenido: string; mentions?: string[] }
  ): Promise<ForoComentario> {
    return apiFetch(`/api/data/foro-comentarios/${id}`, { ...jsonBody(input), method: "PUT" });
  },

  async deleteComentario(id: string): Promise<void> {
    await apiFetch(`/api/data/foro-comentarios/${id}`, { method: "DELETE" });
  },

  async toggleLike(id: string): Promise<{ liked: boolean; likes: number }> {
    return apiFetch(`/api/data/foro-comentarios/${id}/like`, { method: "POST" });
  },
};
