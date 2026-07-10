import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArticleEditor } from "@/components/foro/ArticleEditor";
import { CommentThread } from "@/components/foro/CommentThread";
import { ArrowLeft, Eye, Pencil, Trash2, FileText, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { foroService, ForoArticulo, ForoArticuloInput } from "@/lib/services/foro";

export const Route = createFileRoute("/foro/$id")({
  head: () => ({ meta: [{ title: "Foro de Discusión — EvalPro" }] }),
  component: ForoDetailPage,
});

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function ForoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getLevel, loading: permLoading } = useRolePermissions();
  const level = getLevel("foro");
  const canModerateAny = level === "full";

  const [articulo, setArticulo] = useState<ForoArticulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    foroService
      .getArticulo(id)
      .then(setArticulo)
      .catch(() => setError("No se pudo cargar el artículo"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, id]);

  const isOwner = articulo?.autor_id === profile?.id;
  const canEdit = !permLoading && ((level === "editar" && isOwner) || level === "full");

  const handleSave = async (input: ForoArticuloInput) => {
    if (!articulo) return;
    setSaving(true);
    try {
      const updated = await foroService.updateArticulo(articulo.id, input);
      setArticulo(updated);
      setShowEditor(false);
    } catch (e: any) {
      setError(e.message ?? "No se pudo guardar el artículo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await foroService.deleteArticulo(id);
      navigate({ to: "/foro" });
    } catch (e: any) {
      setError(e.message ?? "No se pudo eliminar el artículo");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <p className="text-[13px] text-[var(--muted-foreground)]">Cargando artículo…</p>
      </AppShell>
    );
  }

  if (error && !articulo) {
    return (
      <AppShell>
        <p className="text-[13px] text-destructive">{error}</p>
      </AppShell>
    );
  }

  if (!articulo) return null;

  return (
    <AppShell>
      <PageHeader
        title="Foro de Discusión"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/foro" className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <ArrowLeft className="size-4" /> Volver al Foro
            </Link>
          </div>
        }
      />

      <article className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {articulo.categoria && (
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
              {articulo.categoria}
            </span>
          )}
          {articulo.origen === "ia" && (
            <span className="flex items-center gap-1 rounded-full bg-[rgba(139,92,246,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#8B5CF6]">
              <Sparkles className="size-3" /> Generado por IA
            </span>
          )}
          {articulo.estado === "borrador" && (
            <span className="rounded-full bg-[rgba(237,86,80,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#ED5650]">
              Borrador
            </span>
          )}
        </div>

        <h1 className="font-display text-[28px] font-medium leading-tight text-[var(--foreground)]">
          {articulo.titulo}
        </h1>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4 text-[13px] text-[var(--muted-foreground)]">
          <span>
            {articulo.autor_nombre} · {formatDate(articulo.published_at ?? articulo.created_at)}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Eye className="size-3.5" /> {articulo.vistas} vistas</span>
            {canEdit && (
              <button onClick={() => setShowEditor(true)} className="flex items-center gap-1 hover:text-[var(--foreground)]">
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
            {canEdit && (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 hover:text-destructive">
                <Trash2 className="size-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>

        <div
          className="prose prose-sm mt-5 max-w-none dark:prose-invert [&_table]:w-full [&_td]:border [&_th]:border [&_td]:border-[var(--border)] [&_th]:border-[var(--border)] [&_td]:p-2 [&_th]:p-2"
          dangerouslySetInnerHTML={{ __html: articulo.contenido }}
        />

        {articulo.etiquetas?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {articulo.etiquetas.map((tag) => (
              <span key={tag} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--muted-foreground)]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {(articulo.adjuntos?.length ?? 0) > 0 && (
          <div className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-[12px] font-medium text-[var(--muted-foreground)]">Adjuntos</span>
            {articulo.adjuntos!.map((a) => (
              <a
                key={a.id}
                href={a.data_url}
                download={a.nombre}
                className="flex w-fit items-center gap-2 rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[13px] hover:opacity-80"
              >
                <FileText className="size-4" /> {a.nombre}
              </a>
            ))}
          </div>
        )}
      </article>

      <div className="mt-6 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        {profile && (
          <CommentThread articuloId={articulo.id} currentUserId={profile.id} canModerateAny={canModerateAny} />
        )}
      </div>

      <ArticleEditor
        open={showEditor}
        initial={articulo}
        saving={saving}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar artículo"
        description="Esta acción eliminará el artículo y todos sus comentarios. No se puede deshacer."
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppShell>
  );
}
