import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  CheckCircle,
  HelpCircle,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { questionsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/question-bank")({
  head: () => ({ meta: [{ title: "Banco de Preguntas — EvalPro" }] }),
  component: QuestionBankPage,
});

type QType = "unica" | "multiple" | "vf";
type Difficulty = "facil" | "medio" | "dificil";
type Status = "activa" | "borrador" | "inactiva";

type Question = {
  id: string;
  enunciado: string;
  contexto: string;
  tipo: QType;
  categoria: string;
  dificultad: Difficulty;
  estado: Status;
  opciones: string[];
  correctas: number[]; // indices
  justificacion?: string;
};

const DEFAULT_CATEGORIES = [
  "Arquitectura Cloud",
  "Seguridad",
  "Frontend",
  "Backend",
  "Producto",
  "Datos",
];

const TYPE_LABEL: Record<QType, string> = {
  unica: "Selección Única",
  multiple: "Selección Múltiple",
  vf: "Verdadero / Falso",
};

const DIFF_LABEL: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};

const PAGE_SIZE = 10;

const SEED: Question[] = [
  {
    id: "Q-001",
    enunciado: "¿Qué servicio de AWS provee procesamiento de eventos serverless?",
    contexto:
      "AWS ofrece varios servicios de cómputo y almacenamiento. Algunos están orientados a infraestructura tradicional y otros a modelos de ejecución basados en eventos sin gestionar servidores.",
    tipo: "unica",
    categoria: "Arquitectura Cloud",
    dificultad: "medio",
    estado: "activa",
    opciones: ["AWS Lambda", "AWS EC2", "AWS S3", "AWS RDS"],
    correctas: [0],
  },
  {
    id: "Q-002",
    enunciado: "Selecciona los principios fundamentales de IAM.",
    contexto:
      "La gestión de identidad y accesos define cómo se otorgan, revisan y revocan permisos sobre recursos dentro de una organización moderna.",
    tipo: "multiple",
    categoria: "Seguridad",
    dificultad: "dificil",
    estado: "activa",
    opciones: [
      "Mínimo privilegio",
      "Separación de deberes",
      "Acceso total por defecto",
      "Auditoría continua",
    ],
    correctas: [0, 1, 3],
  },
  {
    id: "Q-003",
    enunciado: "La hidratación en React asocia el HTML del servidor con los listeners del cliente.",
    contexto:
      "En aplicaciones renderizadas en servidor, existe un proceso por el cual el cliente conecta el árbol del DOM ya entregado con el código JavaScript que aporta interactividad.",
    tipo: "vf",
    categoria: "Frontend",
    dificultad: "medio",
    estado: "activa",
    opciones: ["Verdadero", "Falso"],
    correctas: [0],
  },
  {
    id: "Q-004",
    enunciado: "Las edge functions siempre se ejecutan en el servidor de origen.",
    contexto:
      "Las plataformas modernas distribuyen el cómputo en múltiples ubicaciones geográficas, lo que influye en dónde se procesan las solicitudes de los usuarios.",
    tipo: "vf",
    categoria: "Arquitectura Cloud",
    dificultad: "facil",
    estado: "borrador",
    opciones: ["Verdadero", "Falso"],
    correctas: [1],
  },
];

function emptyQuestion(): Question {
  return {
    id: "",
    enunciado: "",
    contexto: "",
    tipo: "unica",
    categoria: "General",
    dificultad: "medio",
    estado: "activa",
    opciones: ["", "", "", ""],
    correctas: [],
    justificacion: "",
  };
}

function QuestionBankPage() {
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('question_bank')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  const [items, setItems] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Cargar preguntas desde Supabase
  useEffect(() => {
    async function loadQuestions() {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const data = await questionsService.getAll();
        
        // Mapear datos de Supabase al formato local
        const mappedItems: Question[] = data.map((q: any) => ({
          id: q.id,
          enunciado: q.question_text,
          contexto: q.contexto || '',
          tipo: q.options?.length === 2 && q.options[0] === 'Verdadero' ? 'vf' : 
                q.correct_answer?.includes(',') ? 'multiple' : 'unica',
          categoria: q.categoria || 'General',
          dificultad: (q.dificultad as Difficulty) || 'medio',
          estado: (q.estado as Status) || 'activa',
          opciones: q.options || [],
          correctas: q.correct_answer ? q.correct_answer.split(',').map(Number) : [],
          justificacion: q.justificacion || ''
        }));
        
        setItems(mappedItems);

        // Extraer categorías únicas de las preguntas
        const uniqueCategories = Array.from(new Set(mappedItems.map(q => q.categoria))).sort();
        setCategories(uniqueCategories.length > 0 ? uniqueCategories : ['General']);

        // Preseleccionar la categoría de la pregunta activa más reciente
        const lastActiveCat = mappedItems.find(q => q.estado === 'activa')?.categoria;
        if (lastActiveCat) setFilterCat(lastActiveCat);
      } catch (err) {
        console.error('Error loading questions:', err);
        setError('Error al cargar las preguntas');
        // Usar datos de ejemplo si falla la carga
        setItems(SEED);
        setCategories(DEFAULT_CATEGORIES);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [isAdmin]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | Status>("activa");
  const [filterTipo, setFilterTipo] = useState<"todos" | QType>("todos");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((q) => {
        const matchQ = q.enunciado.toLowerCase().includes(debouncedQuery.toLowerCase());
        const matchC = filterCat === "todas" || q.categoria === filterCat;
        const matchE = filterEstado === "todos" || q.estado === filterEstado;
        const matchT = filterTipo === "todos" || q.tipo === filterTipo;
        return matchQ && matchC && matchE && matchT;
      }),
    [items, debouncedQuery, filterCat, filterEstado, filterTipo],
  );

  // Resetear página al cambiar cualquier filtro o búsqueda
  useEffect(() => { setPage(1); }, [debouncedQuery, filterCat, filterEstado, filterTipo]);

  const counts = useMemo(() => {
    const source = filterEstado === 'todos' ? items : items.filter(q => q.estado === filterEstado);
    const c: Record<string, number> = { Todas: source.length };
    categories.forEach((cat) => (c[cat] = source.filter((q) => q.categoria === cat).length));
    return c;
  }, [items, categories, filterEstado]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyQuestion());
    setIsCreatingCategory(false);
    setNewCategoryName("");
    setShowModal(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({ ...q, opciones: [...q.opciones], correctas: [...q.correctas] });
    setIsCreatingCategory(false);
    setNewCategoryName("");
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta pregunta?")) return;
    try {
      await questionsService.delete(id);
      setItems((p) => p.filter((q) => q.id !== id));
      showToast("Pregunta eliminada");
    } catch (error) {
      console.error('Error deleting question:', error);
      showToast("Error al eliminar la pregunta", "error");
    }
  };

  const setTipo = (tipo: QType) => {
    if (tipo === "vf") {
      setForm((f) => ({ ...f, tipo, opciones: ["Verdadero", "Falso"], correctas: [] }));
    } else {
      setForm((f) => ({
        ...f,
        tipo,
        opciones: f.opciones.length >= 2 && f.opciones[0] !== "Verdadero"
          ? f.opciones
          : ["", "", "", ""],
        correctas: [],
      }));
    }
  };

  const toggleCorrecta = (idx: number) => {
    setForm((f) => {
      if (f.tipo === "multiple") {
        return {
          ...f,
          correctas: f.correctas.includes(idx)
            ? f.correctas.filter((i) => i !== idx)
            : [...f.correctas, idx].sort(),
        };
      }
      return { ...f, correctas: [idx] };
    });
  };

  const updateOpcion = (idx: number, val: string) => {
    setForm((f) => ({
      ...f,
      opciones: f.opciones.map((o, i) => (i === idx ? val : o)),
    }));
  };

  const addOpcion = () => {
    if (form.tipo === "vf" || form.opciones.length >= 6) return;
    setForm((f) => ({ ...f, opciones: [...f.opciones, ""] }));
  };

  const removeOpcion = (idx: number) => {
    if (form.tipo === "vf" || form.opciones.length <= 2) return;
    setForm((f) => ({
      ...f,
      opciones: f.opciones.filter((_, i) => i !== idx),
      correctas: f.correctas.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)),
    }));
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.enunciado.trim()) return showToast("Escribe el enunciado", "error");
    if (!form.contexto.trim()) return showToast("Añade un contexto a la pregunta", "error");
    if (isCreatingCategory && !newCategoryName.trim())
      return showToast("Escribe el nombre de la nueva categoría", "error");
    const opcionesValidas = form.opciones.every((o) => o.trim().length > 0);
    if (!opcionesValidas) return showToast("Completa todas las opciones", "error");
    if (form.correctas.length === 0)
      return showToast("Marca al menos una respuesta correcta", "error");
    if (form.tipo === "unica" && form.correctas.length > 1)
      return showToast("Selección única: solo una correcta", "error");
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    // Si es una categoría nueva, agregarla a la lista de categorías
    if (isCreatingCategory && newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories((prev) => [...prev, newCategoryName.trim()].sort());
    }

    setIsSaving(true);
    try {
      if (editing) {
        // Actualizar pregunta existente en Supabase
        await questionsService.update(editing.id, {
          question_text: form.enunciado,
          contexto: form.contexto,
          options: form.opciones,
          correct_answer: form.correctas.join(','),
          categoria: form.categoria,
          dificultad: form.dificultad,
          estado: form.estado,
          justificacion: form.justificacion
        });
        setItems((p) => p.map((q) => (q.id === editing.id ? { ...form, id: editing.id } : q)));
        showToast("Pregunta actualizada");
      } else {
        // Crear nueva pregunta en Supabase (sin evaluation_id para banco de preguntas)
        const created = await questionsService.create({
          evaluation_id: null,
          question_text: form.enunciado,
          contexto: form.contexto,
          options: form.opciones,
          correct_answer: form.correctas.join(','),
          categoria: form.categoria,
          dificultad: form.dificultad,
          estado: form.estado,
          justificacion: form.justificacion
        });

        // Optimistic insert — avoids a full getAll() round-trip after every create
        const mappedItem: Question = {
          id: created.id,
          enunciado: created.question_text,
          contexto: created.contexto || '',
          tipo: created.options?.length === 2 && created.options[0] === 'Verdadero' ? 'vf'
              : created.correct_answer?.includes(',') ? 'multiple' : 'unica',
          categoria: created.categoria || 'General',
          dificultad: (created.dificultad as Difficulty) || 'medio',
          estado: (created.estado as Status) || 'activa',
          opciones: created.options || [],
          correctas: created.correct_answer ? created.correct_answer.split(',').map(Number) : [],
          justificacion: created.justificacion || '',
        };
        setItems((prev) => [mappedItem, ...prev]);
        showToast("Pregunta creada");
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (error) {
      console.error('Error saving question:', error);
      showToast("Error al guardar la pregunta", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Banco de Preguntas" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando preguntas...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Banco de Preguntas" />
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
    <AppShell>
      <PageHeader
        title="Banco de Preguntas"
        actions={<Button onClick={openCreate}><Plus className="size-4" /> Nueva Pregunta</Button>}
      />
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

      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="space-y-4 lg:col-span-1">
          <div className="rounded-lg border border-border bg-card p-5 transition-all duration-300" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="mb-4 font-mono text-[9px] font-bold uppercase tracking-[.14em] transition-colors duration-300" style={{ color: "var(--accent)" }}>
              Categorías
            </div>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setFilterCat("todas")}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ${
                    filterCat === "todas"
                      ? "bg-coral-soft text-coral-text"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>Todas</span>
                  <span className="font-mono text-[10px] font-bold">{counts.Todas}</span>
                </button>
              </li>
              {categories.map((c: string, idx: number) => (
                <li key={c} style={{ animation: `slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 25}ms both` }}>
                  <button
                    onClick={() => setFilterCat(c)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ${
                      filterCat === c
                        ? "bg-coral-soft text-coral-text"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span>{c}</span>
                    <span className="font-mono text-[10px] font-bold">{counts[c] ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3 animate-fade-in">
            <div className="relative min-w-[220px] flex-1 max-w-sm transition-all duration-300">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-300" style={{ color: "var(--muted-foreground)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar preguntas…"
                className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
              className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="todos">Todos los tipos</option>
              <option value="unica">Selección Única</option>
              <option value="multiple">Selección Múltiple</option>
              <option value="vf">Verdadero / Falso</option>
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
              className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="todos">Todos los estados</option>
              <option value="activa">Activas</option>
              <option value="borrador">Borradores</option>
              <option value="inactiva">Inactivas</option>
            </select>
            <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[.12em] px-3 py-2 rounded-lg transition-all duration-300" style={{ background: "var(--secondary)/40", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {filtered.length} de {items.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center animate-fade-in transition-all duration-300" style={{ boxShadow: "var(--shadow-sm)" }}>
              <HelpCircle className="mx-auto mb-3 size-10 transition-colors duration-300" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                No hay preguntas que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginated.map((q, idx) => (
                  <div
                    key={q.id}
                    style={{ animation: `slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 40}ms both` }}
                    className="group rounded-lg border border-border bg-card p-5 transition-all duration-300 hover:shadow-md hover:border-accent/40"
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] transition-all duration-300" style={{ background: "var(--coral-soft)", color: "var(--coral-text)", borderRadius: 6, padding: "3px 8px" }}>
                            {q.id}
                          </span>
                          <span className="rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all duration-300 hover:shadow-sm" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                            {q.categoria}
                          </span>
                          <span className="rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all duration-300 hover:shadow-sm" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
                            {TYPE_LABEL[q.tipo]}
                          </span>
                          <span className="text-[10px] font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                            {DIFF_LABEL[q.dificultad]}
                          </span>
                          <span
                            className="rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider transition-all duration-300"
                            style={{
                              background: q.estado === "activa" ? "var(--coral-soft)" : q.estado === "borrador" ? "rgba(217,119,6,.12)" : "rgba(107,114,128,.12)",
                              color: q.estado === "activa" ? "var(--coral-text)" : q.estado === "borrador" ? "#FBBF24" : "#6B7280"
                            }}
                          >
                            {q.estado === "activa" ? "ACTIVA" : q.estado === "borrador" ? "BORRADOR" : "INACTIVA"}
                          </span>
                        </div>
                        <p className="mb-2 text-sm leading-relaxed transition-colors duration-300" style={{ color: "var(--foreground)" }}>{q.enunciado}</p>
                        {q.contexto && (
                          <p className="mb-3 rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed transition-all duration-300" style={{ borderColor: "var(--accent)", background: "var(--coral-soft)", color: "var(--muted-foreground)" }}>
                            <strong className="transition-colors duration-300" style={{ color: "var(--foreground)" }}>Contexto:</strong> {q.contexto}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {q.opciones.map((o, i) => {
                            const ok = q.correctas.includes(i);
                            return (
                              <li
                                key={i}
                                className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 hover:bg-secondary/40"
                                style={{
                                  border: "1px solid var(--border)",
                                  background: ok ? "var(--coral-soft)" : "var(--background)",
                                  color: ok ? "var(--coral-text)" : "var(--muted-foreground)"
                                }}
                              >
                                <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300" style={{ borderColor: "currentColor" }}>
                                  {ok && <Check className="size-3" />}
                                </span>
                                <span>{o}</span>
                              </li>
                            );
                          })}
                        </ul>
                        {q.justificacion && (
                          <p className="mt-3 rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed transition-all duration-300" style={{ borderColor: "var(--accent)", background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                            <strong className="transition-colors duration-300" style={{ color: "var(--foreground)" }}>Justificación:</strong> {q.justificacion}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-70 transition-all duration-300 group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(q)}
                          className="rounded-lg p-2 transition-all duration-300 hover:bg-secondary hover:scale-110"
                          style={{ color: "var(--muted-foreground)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="rounded-lg p-2 transition-all duration-300 hover:bg-destructive/10 hover:scale-110"
                          style={{ color: "var(--muted-foreground)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--destructive)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} · {filtered.length} preguntas
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                    >
                      Siguiente →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card shadow-2xl transition-all duration-300" style={{ borderRadius: 16, border: "1px solid var(--border)" }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 transition-all duration-300" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <h3 className="font-display text-[15px] font-semibold transition-colors duration-300" style={{ color: "var(--foreground)" }}>
                {editing ? "Editar" : "Nueva"} Pregunta
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 transition-all duration-300 hover:bg-secondary hover:scale-110"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
                <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                  Enunciado *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.enunciado}
                  onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
                  placeholder="Escribe la pregunta…"
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                />
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
                <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                  Contexto *
                  <span className="ml-1 font-normal normal-case transition-colors duration-300" style={{ color: "var(--muted-foreground)/70" }}>
                    — explica el enunciado sin revelar la respuesta
                  </span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.contexto}
                  onChange={(e) => setForm({ ...form, contexto: e.target.value })}
                  placeholder="Describe el escenario, marco teórico o situación que da sentido a la pregunta. No insinúes ni adelantes la respuesta correcta."
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                />
              </div>


              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setTipo(e.target.value as QType)}
                    className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    <option value="unica">Selección Única</option>
                    <option value="multiple">Selección Múltiple</option>
                    <option value="vf">Verdadero / Falso</option>
                  </select>
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    Categoría
                  </label>
                  <select
                    value={isCreatingCategory ? "nueva" : form.categoria}
                    onChange={(e) => {
                      if (e.target.value === "nueva") {
                        setIsCreatingCategory(true);
                        setNewCategoryName("");
                      } else {
                        setIsCreatingCategory(false);
                        setForm({ ...form, categoria: e.target.value });
                      }
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    {categories.map((c: string) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="nueva">+ Crear nueva categoría</option>
                  </select>
                  {isCreatingCategory && (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        setForm({ ...form, categoria: e.target.value });
                      }}
                      placeholder="Nombre de la nueva categoría"
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                  )}
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    Dificultad
                  </label>
                  <select
                    value={form.dificultad}
                    onChange={(e) =>
                      setForm({ ...form, dificultad: e.target.value as Difficulty })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    Opciones — marca la(s) correcta(s)
                  </label>
                  {form.tipo !== "vf" && form.opciones.length < 6 && (
                    <button
                      type="button"
                      onClick={addOpcion}
                      className="text-xs font-medium transition-all duration-300 hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      + Añadir opción
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {form.opciones.map((o, i) => {
                    const ok = form.correctas.includes(i);
                    return (
                      <div key={i} className="flex items-center gap-2 transition-all duration-300">
                        <button
                          type="button"
                          onClick={() => toggleCorrecta(i)}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-300"
                          style={{
                            borderColor: ok ? "var(--coral-text)" : "var(--border)",
                            background: ok ? "var(--coral-soft)" : "var(--background)",
                            color: ok ? "var(--coral-text)" : "transparent"
                          }}
                          title="Marcar como correcta"
                        >
                          <Check className="size-4" />
                        </button>
                        <input
                          value={o}
                          onChange={(e) => updateOpcion(i, e.target.value)}
                          disabled={form.tipo === "vf"}
                          placeholder={`Opción ${i + 1}`}
                          className="flex-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                          style={{ borderColor: "var(--border)", background: "var(--background)" }}
                        />
                        {form.tipo !== "vf" && form.opciones.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOpcion(i)}
                            className="rounded-lg p-2 transition-all duration-300 hover:bg-destructive/10 hover:scale-110"
                            style={{ color: "var(--muted-foreground)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--destructive)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
                <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                  Justificación (opcional)
                </label>
                <textarea
                  rows={2}
                  value={form.justificacion ?? ""}
                  onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                />
              </div>

              <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: "350ms" }}>
                <label className="text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as Status })}
                  className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                >
                  <option value="activa">Activa</option>
                  <option value="borrador">Borrador</option>
                  <option value="inactiva">Inactiva</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4 transition-all duration-300">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <CheckCircle className="size-4" />
                  {editing ? "Guardar cambios" : "Crear pregunta"}
                </Button>
              </div>

              <ConfirmDialog
                open={showSaveConfirm}
                title={editing ? "¿Guardar cambios?" : "¿Crear pregunta?"}
                description={editing ? "Confirma que deseas guardar los cambios en esta pregunta." : "Confirma que deseas agregar esta pregunta al banco."}
                confirmLabel={editing ? "Guardar cambios" : "Crear pregunta"}
                loading={isSaving}
                onConfirm={executeSave}
                onCancel={() => setShowSaveConfirm(false)}
              />
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
