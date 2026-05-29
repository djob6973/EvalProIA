import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  Calendar,
  CalendarX,
  Layers,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { evaluationsService, getUniqueCategories, areasService, Area, evaluationParticipantsService, getAllParticipants, ParticipantProfile } from "@/lib/services/evaluations";

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
  porcentaje_aprobacion: number;
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
  fecha_vencimiento?: string;
  area_id?: string | null;
};

function toLocalDateTimeInput(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpired(ev: Evaluation): boolean {
  if (!ev.fecha_vencimiento) return false;
  return new Date(ev.fecha_vencimiento) < new Date();
}

const DEFAULT_CONFIG: Config = {
  num_preguntas: 20,
  dificultad: "mixto",
  dist_unica: 50,
  dist_multiple: 30,
  dist_vf: 20,
  aleatorio: true,
  porcentaje_aprobacion: 60,
};

type AssignModalProps = {
  evaluation: Evaluation;
  areas: Area[];
  onClose: () => void;
};

function AssignParticipantsModal({ evaluation, areas, onClose }: AssignModalProps) {
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loadingModal, setLoadingModal] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      const [allP, ids] = await Promise.all([
        getAllParticipants(),
        evaluationParticipantsService.getByEvaluationId(evaluation.id),
      ]);
      setParticipants(allP);
      setAssignedIds(new Set(ids));
      setLoadingModal(false);
    }
    load();
  }, [evaluation.id]);

  const toggle = async (userId: string) => {
    setTogglingId(userId);
    try {
      if (assignedIds.has(userId)) {
        await evaluationParticipantsService.unassign(evaluation.id, userId);
        setAssignedIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
      } else {
        await evaluationParticipantsService.assign(evaluation.id, userId);
        setAssignedIds((prev) => new Set([...prev, userId]));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = participants.filter((p) =>
    `${p.full_name ?? ""} ${p.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Asignar Participantes</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{evaluation.nombre}</p>
          </div>
          <button onClick={onClose} className="ml-4 shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-border px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar participante…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {assignedIds.size} participante{assignedIds.size !== 1 ? "s" : ""} asignado{assignedIds.size !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingModal ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {searchQuery ? "No hay participantes que coincidan." : "No hay participantes registrados."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => {
                const isAssigned = assignedIds.has(p.id);
                const isToggling = togglingId === p.id;
                const areaName = p.area_id ? areas.find((a) => a.id === p.area_id)?.name : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => !isToggling && toggle(p.id)}
                    disabled={isToggling}
                    className={`flex w-full items-center gap-3 px-6 py-3 text-left transition-colors disabled:opacity-50 ${
                      isAssigned ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-secondary"
                    }`}
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isAssigned ? "border-accent bg-accent" : "border-border"
                      }`}
                    >
                      {isAssigned && (
                        <CheckCircle className="size-3 text-accent-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.full_name || p.email}</div>
                      <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                        <span>{p.email}</span>
                        {areaName && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            {areaName}
                          </span>
                        )}
                      </div>
                    </div>
                    {isToggling && (
                      <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function EvaluationsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

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
          created_at: evaluation.created_at,
          fecha_vencimiento: evaluation.fecha_vencimiento ?? undefined,
          area_id: evaluation.area_id ?? null,
        }));

        // Auto-desactivar evaluaciones vencidas
        const expiredItems = mappedItems.filter(
          (ev) => ev.activa && ev.fecha_vencimiento && new Date(ev.fecha_vencimiento) < new Date()
        );
        for (const ev of expiredItems) {
          try {
            await evaluationsService.update(ev.id, { activa: false });
            ev.activa = false;
          } catch (err) {
            console.error('Error auto-deactivating expired evaluation:', ev.id, err);
          }
        }

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

  // Cargar áreas
  useEffect(() => {
    async function loadAreas() {
      if (!isAdmin) return;
      try {
        const data = await areasService.getAll();
        setAreas(data);
      } catch (err) {
        console.error('Error loading areas:', err);
      }
    }
    loadAreas();
  }, [isAdmin]);
  const [query, setQuery] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activa" | "inactiva">("todos");
  const [filterArea, setFilterArea] = useState<string>("todas");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [assigningEval, setAssigningEval] = useState<Evaluation | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const emptyForm: Evaluation = {
    id: "",
    nombre: "",
    descripcion: "",
    tiempo_limite: 0,
    intentos_permitidos: 1,
    activa: true,
    categorias: [],
    config: DEFAULT_CONFIG,
    fecha_vencimiento: "",
    area_id: null,
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
        const matchArea =
          filterArea === "todas" ||
          (filterArea === "sin_area" ? !e.area_id : e.area_id === filterArea);
        return matchQuery && matchCat && matchEstado && matchArea;
      }),
    [items, query, filterCategoria, filterEstado, filterArea],
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
    setForm({
      ...ev,
      config: { ...ev.config },
      categorias: [...ev.categorias],
      fecha_vencimiento: ev.fecha_vencimiento ? toLocalDateTimeInput(ev.fecha_vencimiento) : "",
      area_id: ev.area_id ?? null,
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDist !== 100) {
      showToast("La distribución debe sumar 100%", "error");
      return;
    }
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      const fechaVencimientoISO = form.fecha_vencimiento
        ? new Date(form.fecha_vencimiento).toISOString()
        : null;

      if (editing) {
        // Actualizar en Supabase
        await evaluationsService.update(editing.id, {
          title: form.nombre,
          description: form.descripcion,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          fecha_vencimiento: fechaVencimientoISO,
          area_id: form.area_id ?? null,
        });

        setItems((p) => p.map((x) => (x.id === editing.id ? { ...form, id: editing.id, fecha_vencimiento: form.fecha_vencimiento || undefined } : x)));
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
          config: form.config,
          fecha_vencimiento: fechaVencimientoISO,
          area_id: form.area_id ?? null,
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
          created_at: newEvaluation.created_at,
          fecha_vencimiento: form.fecha_vencimiento || undefined,
          area_id: form.area_id ?? null,
        };
        
        setItems((p) => [mappedItem, ...p]);
        showToast("Evaluación creada");
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      showToast("Error al guardar la evaluación", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await evaluationsService.delete(deletingId);
      setItems((p) => p.filter((e) => e.id !== deletingId));
      showToast("Evaluación eliminada");
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      showToast("Error al eliminar la evaluación", "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingId(null);
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
          {areas.length > 0 && (
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="todas">Todas las áreas</option>
              <option value="sin_area">Sin área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
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
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {ev.id}
                      </span>
                      <h3 className="font-semibold">{ev.nombre}</h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                          isExpired(ev)
                            ? "bg-red-100 text-red-700"
                            : ev.activa
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isExpired(ev) ? "VENCIDA" : ev.activa ? "ACTIVA" : "INACTIVA"}
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
                      {ev.config.porcentaje_aprobacion != null && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                          <CheckCircle className="size-3" />
                          Aprueba con {ev.config.porcentaje_aprobacion}%
                        </span>
                      )}
                      {ev.tiempo_limite > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                          <Clock className="size-3" />
                          {ev.tiempo_limite} min
                        </span>
                      )}
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        {ev.intentos_permitidos} intento{ev.intentos_permitidos !== 1 ? "s" : ""}
                      </span>
                      {ev.area_id && (
                        <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700">
                          <Layers className="size-3" />
                          {areas.find((a) => a.id === ev.area_id)?.name ?? "Área"}
                        </span>
                      )}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ev.created_at && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="size-3" />
                          Creada: {formatDateTime(ev.created_at)}
                        </span>
                      )}
                      {ev.fecha_vencimiento && (
                        <span className={`flex items-center gap-1 text-[11px] font-medium ${isExpired(ev) ? "text-red-600" : "text-amber-600"}`}>
                          <CalendarX className="size-3" />
                          Vence: {formatDateTime(ev.fecha_vencimiento)}
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
                      onClick={() => setAssigningEval(ev)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-accent"
                      title="Asignar participantes"
                    >
                      <Users className="size-4" />
                    </button>
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

      <ConfirmDialog
        open={showDeleteConfirm}
        title="¿Eliminar evaluación?"
        description={`Se eliminará permanentemente "${items.find((e) => e.id === deletingId)?.nombre ?? "esta evaluación"}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loadingLabel="Eliminando…"
        variant="destructive"
        loading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeletingId(null); }}
      />

      {assigningEval && (
        <AssignParticipantsModal
          evaluation={assigningEval}
          areas={areas}
          onClose={() => setAssigningEval(null)}
        />
      )}

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
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Fecha y hora de vencimiento
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fecha_vencimiento || ""}
                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opcional — cuando se cumpla la fecha se inactivará automáticamente para todos los participantes
                  </p>
                </div>
                {areas.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Área
                    </label>
                    <select
                      value={form.area_id || ""}
                      onChange={(e) =>
                        setForm({ ...form, area_id: e.target.value || null })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Sin área (solo por asignación directa)</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Porcentaje de aprobación (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={form.config.porcentaje_aprobacion}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: { ...form.config, porcentaje_aprobacion: +e.target.value },
                          })
                        }
                        className="flex-1 accent-accent"
                      />
                      <span className="w-12 text-right font-mono text-sm font-bold text-accent">
                        {form.config.porcentaje_aprobacion}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      El participante aprueba si obtiene al menos este puntaje
                    </p>
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

                <ConfirmDialog
                  open={showSaveConfirm}
                  title={editing ? "¿Actualizar evaluación?" : "¿Crear evaluación?"}
                  description={editing ? `Confirma que deseas guardar los cambios en "${form.nombre}".` : `Confirma que deseas crear la evaluación "${form.nombre}".`}
                  confirmLabel={editing ? "Actualizar" : "Crear"}
                  loading={isSaving}
                  onConfirm={executeSave}
                  onCancel={() => setShowSaveConfirm(false)}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
