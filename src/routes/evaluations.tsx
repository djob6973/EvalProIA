import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Clock,
  CheckCircle,
  Tag,
  ToggleLeft,
  ToggleRight,
  Settings,
  Search,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { evaluationsService, getUniqueCategories } from "@/lib/services/evaluations";

export const Route = createFileRoute("/evaluations")({
  head: () => ({ meta: [{ title: "Evaluaciones — EvalPro" }] }),
  component: EvaluationsPage,
});

type Config = {
  num_preguntas: number;
  dificultad: "mixto" | "facil" | "medio" | "dificil";
  dist_unica: number;
  dist_multiple: number;
  dist_vf: number;
  aleatorio: boolean;
};

type Evaluation = {
  id: string;
  nombre: string;
  descripcion: string;
  tiempo_limite: number;
  intentos_permitidos: number;
  activa: boolean;
  categorias: string[];
  config: Config;
  created_at?: string;
};

const DEFAULT_CONFIG: Config = {
  num_preguntas: 20,
  dificultad: "mixto",
  dist_unica: 50,
  dist_multiple: 30,
  dist_vf: 20,
  aleatorio: true,
};

function EvaluationsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  const [items, setItems] = useState<Evaluation[]>([]);

  // Cargar evaluaciones desde Supabase
  useEffect(() => {
    async function loadEvaluations() {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const data = await evaluationsService.getAll();
        
        // Mapear datos de Supabase al formato local
        const mappedItems: Evaluation[] = data.map((evaluation: any) => ({
          id: evaluation.id,
          nombre: evaluation.title,
          descripcion: evaluation.description || '',
          tiempo_limite: evaluation.tiempo_limite || 0,
          intentos_permitidos: evaluation.intentos_permitidos || 1,
          activa: evaluation.activa !== undefined ? evaluation.activa : true,
          categorias: evaluation.categorias || [],
          config: evaluation.config || DEFAULT_CONFIG,
          created_at: evaluation.created_at
        }));
        
        setItems(mappedItems);
      } catch (err) {
        console.error('Error loading evaluations:', err);
        setError('Error al cargar las evaluaciones');
      } finally {
        setLoading(false);
      }
    }

    loadEvaluations();
  }, [isAdmin]);

  // Cargar categorías únicas desde la base de datos
  useEffect(() => {
    async function loadCategories() {
      if (!isAdmin) return;
      
      try {
        const uniqueCategories = await getUniqueCategories();
        setCategories(uniqueCategories);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    }

    loadCategories();
  }, [isAdmin]);
  const [query, setQuery] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activa" | "inactiva">("todos");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const emptyForm: Evaluation = {
    id: "",
    nombre: "",
    descripcion: "",
    tiempo_limite: 0,
    intentos_permitidos: 1,
    activa: true,
    categorias: [],
    config: DEFAULT_CONFIG,
  };
  const [form, setForm] = useState<Evaluation>(emptyForm);

  const filtered = useMemo(
    () =>
      items.filter((e) => {
        const matchQuery = (e.nombre + " " + e.descripcion)
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchCat =
          filterCategoria === "todas" || e.categorias.includes(filterCategoria);
        const matchEstado =
          filterEstado === "todos" ||
          (filterEstado === "activa" ? e.activa : !e.activa);
        return matchQuery && matchCat && matchEstado;
      }),
    [items, query, filterCategoria, filterEstado],
  );

  const totalDist = form.config.dist_unica + form.config.dist_multiple + form.config.dist_vf;
  
  // Calcular peso por pregunta (100% / cantidad de preguntas)
  const pesoPorPregunta = form.config.num_preguntas > 0 
    ? (100 / form.config.num_preguntas).toFixed(2)
    : "0.00";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (ev: Evaluation) => {
    setEditing(ev);
    setForm({ ...ev, config: { ...ev.config }, categorias: [...ev.categorias] });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDist !== 100) {
      showToast("La distribución debe sumar 100%", "error");
      return;
    }
    
    try {
      if (editing) {
        // Actualizar en Supabase
        await evaluationsService.update(editing.id, {
          title: form.nombre,
          description: form.descripcion,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config
        });
        
        setItems((p) => p.map((x) => (x.id === editing.id ? { ...form, id: editing.id } : x)));
        showToast("Evaluación actualizada");
      } else {
        // Crear en Supabase
        const newEvaluation = await evaluationsService.create({
          title: form.nombre,
          description: form.descripcion,
          created_by: profile?.id || null,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config
        });
        
        const mappedItem: Evaluation = {
          id: newEvaluation.id,
          nombre: newEvaluation.title,
          descripcion: newEvaluation.description || '',
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          created_at: newEvaluation.created_at
        };
        
        setItems((p) => [mappedItem, ...p]);
        showToast("Evaluación creada");
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      showToast("Error al guardar la evaluación", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta evaluación?")) return;
    
    try {
      await evaluationsService.delete(id);
      setItems((p) => p.filter((e) => e.id !== id));
      showToast("Evaluación eliminada");
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      showToast("Error al eliminar la evaluación", "error");
    }
  };

  const toggleCat = (cat: string) => {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(cat)
        ? f.categorias.filter((c) => c !== cat)
        : [...f.categorias, cat],
    }));
  };

  if (loading) {
    return (
      <AppShell
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando evaluaciones...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Nueva Evaluación
        </Button>
      }
    >
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "error"
              ? "bg-destructive text-destructive-foreground"
              : "bg-emerald-600 text-white"
          }`}
        >
          <CheckCircle className="size-4" />
          {toast.msg}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evaluaciones…"
              className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="todas">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="todos">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>
          <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {filtered.length} de {items.length}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ClipboardList className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay evaluaciones. Crea la primera con "Nueva Evaluación".
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {ev.id}
                      </span>
                      <h3 className="font-semibold">{ev.nombre}</h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                          ev.activa
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {ev.activa ? "ACTIVA" : "INACTIVA"}
                      </span>
                    </div>
                    {ev.descripcion && (
                      <p className="mb-3 text-sm text-muted-foreground">{ev.descripcion}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                        <ClipboardList className="size-3" />
                        {ev.config.num_preguntas} preguntas
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                        <span className="font-mono font-bold">
                          {(100 / ev.config.num_preguntas).toFixed(2)}%
                        </span>
                        <span className="text-muted-foreground">c/u</span>
                      </span>
                      {ev.tiempo_limite > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                          <Clock className="size-3" />
                          {ev.tiempo_limite} min
                        </span>
                      )}
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        {ev.intentos_permitidos} intento{ev.intentos_permitidos !== 1 ? "s" : ""}
                      </span>
                      {ev.categorias.slice(0, 4).map((c) => (
                        <span
                          key={c}
                          className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground"
                        >
                          <Tag className="size-3" />
                          {c}
                        </span>
                      ))}
                      {ev.categorias.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{ev.categorias.length - 4} más
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/evaluation-results/${ev.id}`}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
                      title="Ver resultados"
                    >
                      <BarChart3 className="size-4" />
                    </a>
                    <button
                      onClick={() => openEdit(ev)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <h3 className="font-semibold">
                {editing ? "Editar" : "Nueva"} Evaluación
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Nombre *
                  </label>
                  <input
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Evaluación de Seguridad Industrial"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Descripción
                  </label>
                  <textarea
                    rows={2}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Tiempo límite (min, 0 = sin límite)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.tiempo_limite}
                      onChange={(e) =>
                        setForm({ ...form, tiempo_limite: +e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Intentos permitidos
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.intentos_permitidos}
                      onChange={(e) =>
                        setForm({ ...form, intentos_permitidos: +e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, activa: !form.activa })}
                  className={`flex items-center gap-2 text-sm font-medium ${
                    form.activa ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {form.activa ? (
                    <ToggleRight className="size-6" />
                  ) : (
                    <ToggleLeft className="size-6" />
                  )}
                  {form.activa ? "Evaluación activa" : "Evaluación inactiva"}
                </button>
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <Settings className="size-4 text-accent" />
                  <h4 className="text-sm font-semibold">Configuración de Preguntas</h4>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        N° de preguntas
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={form.config.num_preguntas}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: { ...form.config, num_preguntas: +e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-xs">
                        <span className="text-muted-foreground">Peso por pregunta:</span>
                        <span className="font-mono font-bold text-accent">{pesoPorPregunta}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Dificultad
                      </label>
                      <select
                        value={form.config.dificultad}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: {
                              ...form.config,
                              dificultad: e.target.value as Config["dificultad"],
                            },
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="mixto">Mixto</option>
                        <option value="facil">Fácil</option>
                        <option value="medio">Medio</option>
                        <option value="dificil">Difícil</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Distribución por tipo{" "}
                      {totalDist !== 100 && (
                        <span className="ml-1 text-destructive">
                          (debe sumar 100% — actual: {totalDist}%)
                        </span>
                      )}
                    </label>
                    {(
                      [
                        { key: "dist_unica", label: "Selección Única" },
                        { key: "dist_multiple", label: "Selección Múltiple" },
                        { key: "dist_vf", label: "Verdadero / Falso" },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="mb-1.5 flex items-center gap-2">
                        <span className="w-36 text-xs text-muted-foreground">{label}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={form.config[key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              config: { ...form.config, [key]: +e.target.value },
                            })
                          }
                          className="flex-1 accent-accent"
                        />
                        <span className="w-10 text-right font-mono text-xs font-medium">
                          {form.config[key]}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.config.aleatorio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, aleatorio: e.target.checked },
                        })
                      }
                    />
                    Orden aleatorio de preguntas
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Categorías incluidas{" "}
                  <span className="text-muted-foreground/70">(vacío = todas)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = form.categorias.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-accent/40"
                        }`}
                      >
                        <Tag className="size-3" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={totalDist !== 100}>
                  <Save className="size-4" />
                  {editing ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
