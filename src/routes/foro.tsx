import { createFileRoute, useLocation, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useDebounce } from "@/hooks/use-debounce";
import { foroService, ForoArticulo, ForoArticuloInput } from "@/lib/services/foro";
import { ArticleCard } from "@/components/foro/ArticleCard";
import { ArticleEditor } from "@/components/foro/ArticleEditor";
import { AiArticleGenerator } from "@/components/foro/AiArticleGenerator";

export const Route = createFileRoute("/foro")({
  head: () => ({ meta: [{ title: "Foro de Discusión — EvalPro" }] }),
  component: ForoRouteComponent,
});

// /foro/$id is a sibling route nested under this same file path (foro.$id.tsx);
// TanStack renders this component for both, so hand off to <Outlet/> when the
// child route is active — same pattern as ResultsPage in results.tsx.
function ForoRouteComponent() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/foro/")) return <Outlet />;
  return <ForoPage />;
}

function ForoPage() {
  const { profile } = useAuth();
  const { getLevel, loading: permLoading } = useRolePermissions();
  const level = getLevel("foro");
  const canWrite = !permLoading && (level === "editar" || level === "full");
  const canGenerateAI = !permLoading && level === "full";

  const [items, setItems] = useState<ForoArticulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [categoria, setCategoria] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [orden, setOrden] = useState<"recientes" | "populares">("recientes");

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<ForoArticulo | null>(null);
  const [aiDraft, setAiDraft] = useState<ForoArticuloInput | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    foroService
      .getArticulos({ search: debouncedQuery, categoria, etiqueta, orden })
      .then(setItems)
      .catch(() => setError("No se pudieron cargar los artículos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, debouncedQuery, categoria, etiqueta, orden]);

  const categorias = useMemo(
    () => Array.from(new Set(items.map((a) => a.categoria).filter(Boolean))) as string[],
    [items],
  );

  const openCreate = () => { setEditing(null); setAiDraft(null); setShowEditor(true); };

  const handleAiGenerated = (draft: ForoArticuloInput) => {
    setEditing(null);
    setAiDraft(draft);
    setShowAiGenerator(false);
    setShowEditor(true);
  };

  const handleSave = async (input: ForoArticuloInput) => {
    setSaving(true);
    try {
      if (editing) await foroService.updateArticulo(editing.id, input);
      else await foroService.createArticulo({ ...input, origen: aiDraft ? "ia" : "manual" });
      setShowEditor(false);
      setAiDraft(null);
      load();
    } catch (e: any) {
      setError(e.message ?? "No se pudo guardar el artículo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Foro de Discusión"
        subtitle="Conocimiento compartido a partir de capacitaciones, documentos y evaluaciones"
        actions={
          <div className="flex items-center gap-2">
            {canGenerateAI && (
              <Button variant="outline" onClick={() => setShowAiGenerator(true)}>
                <Sparkles className="size-4" /> Generar con IA
              </Button>
            )}
            {canWrite && (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Nuevo artículo
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o contenido…"
            className="pl-9"
          />
        </div>

        {categorias.length > 0 && (
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {etiqueta && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px]">
            #{etiqueta}
            <button onClick={() => setEtiqueta("")} aria-label="Quitar filtro de etiqueta"><X className="size-3" /></button>
          </span>
        )}

        <Tabs value={orden} onValueChange={(v) => setOrden(v as "recientes" | "populares")}>
          <TabsList>
            <TabsTrigger value="recientes">Recientes</TabsTrigger>
            <TabsTrigger value="populares">Más vistos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-[var(--muted-foreground)]">Cargando artículos…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[var(--border)] py-16 text-center text-[14px] text-[var(--muted-foreground)]">
          Aún no hay artículos publicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => <ArticleCard key={a.id} articulo={a} />)}
        </div>
      )}

      <ArticleEditor
        open={showEditor}
        initial={editing ?? aiDraft}
        saving={saving}
        onClose={() => { setShowEditor(false); setAiDraft(null); }}
        onSave={handleSave}
      />

      <AiArticleGenerator
        open={showAiGenerator}
        onClose={() => setShowAiGenerator(false)}
        onGenerated={handleAiGenerated}
      />
    </AppShell>
  );
}
