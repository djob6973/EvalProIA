import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, MessageCircle, FileText, Sparkles } from "lucide-react";
import { ForoArticulo } from "@/lib/services/foro";

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function ArticleCard({ articulo }: { articulo: ForoArticulo }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to="/foro/$id"
      params={{ id: articulo.id }}
      className="flex flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between gap-2">
        {articulo.categoria && (
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
            {articulo.categoria}
          </span>
        )}
        {articulo.origen === "ia" && (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(139,92,246,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#8B5CF6]">
            <Sparkles className="size-3" /> {t("forum.aiBadgeShort")}
          </span>
        )}
        {articulo.estado === "borrador" && (
          <span className="rounded-full bg-[rgba(237,86,80,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#ED5650]">
            {t("forum.draftBadge")}
          </span>
        )}
      </div>

      <h3 className="font-display text-[18px] font-medium leading-snug text-[var(--foreground)] line-clamp-2">
        {articulo.titulo}
      </h3>

      {articulo.resumen && (
        <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)] line-clamp-2">
          {articulo.resumen}
        </p>
      )}

      {articulo.etiquetas?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {articulo.etiquetas.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3 text-[12px] text-[var(--muted-foreground)]">
        <span className="truncate">{articulo.autor_nombre} · {formatDate(articulo.published_at ?? articulo.created_at, i18n.language)}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1"><Eye className="size-3.5" /> {articulo.vistas}</span>
          <span className="flex items-center gap-1"><MessageCircle className="size-3.5" /> {articulo.comentarios ?? 0}</span>
          {(articulo.adjuntos?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1"><FileText className="size-3.5" /> {articulo.adjuntos!.length}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
