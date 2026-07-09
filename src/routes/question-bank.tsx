import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  head: () => ({ meta: [{ title: "Banco de Preguntas — EvalPro" }] }), // translated at runtime via useTranslation
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
  area: string;
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
    area: "",
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
    area: "",
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
    area: "",
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
    area: "",
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
    area: "",
    dificultad: "medio",
    estado: "activa",
    opciones: ["", "", "", ""],
    correctas: [],
    justificacion: "",
  };
}

function QuestionBankPage() {
  const { t } = useTranslation();
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
  const [areas, setAreas] = useState<string[]>([]);

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
          area: q.area || '',
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

        // Extraer áreas únicas de las preguntas
        const uniqueAreas = Array.from(new Set(mappedItems.map(q => q.area).filter(Boolean))).sort();
        setAreas(uniqueAreas);

        // Preseleccionar la categoría de la pregunta activa más reciente
        const lastActiveCat = mappedItems.find(q => q.estado === 'activa')?.categoria;
        if (lastActiveCat) setFilterCat(lastActiveCat);
      } catch (err) {
        console.error('Error loading questions:', err);
        setError(t('questionBank.loadError'));
        // Usar datos de ejemplo si falla la carga
        setItems(SEED);
        setCategories(DEFAULT_CATEGORIES);
        setAreas([]);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [isAdmin]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [catSearch, setCatSearch] = useState("");
  const [filterArea, setFilterArea] = useState<string>("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | Status>("activa");
  const [filterTipo, setFilterTipo] = useState<"todos" | QType>("todos");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [catComboSearch, setCatComboSearch] = useState("");
  const [catComboOpen, setCatComboOpen] = useState(false);
  const catComboRef = useRef<HTMLDivElement>(null);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [areaComboSearch, setAreaComboSearch] = useState("");
  const [areaComboOpen, setAreaComboOpen] = useState(false);
  const areaComboRef = useRef<HTMLDivElement>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((q) => {
        const matchQ = q.enunciado.toLowerCase().includes(debouncedQuery.toLowerCase());
        const matchC = filterCat === "todas" || q.categoria === filterCat;
        const matchA = filterArea === "todas" || q.area === filterArea;
        const matchE = filterEstado === "todos" || q.estado === filterEstado;
        const matchT = filterTipo === "todos" || q.tipo === filterTipo;
        return matchQ && matchC && matchA && matchE && matchT;
      }),
    [items, debouncedQuery, filterCat, filterArea, filterEstado, filterTipo],
  );

  // Resetear página al cambiar cualquier filtro o búsqueda
  useEffect(() => { setPage(1); }, [debouncedQuery, filterCat, filterArea, filterEstado, filterTipo]);

  // Close category/area combobox on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catComboRef.current && !catComboRef.current.contains(e.target as Node)) {
        setCatComboOpen(false);
      }
      if (areaComboRef.current && !areaComboRef.current.contains(e.target as Node)) {
        setAreaComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const counts = useMemo(() => {
    const source = items.filter(
      (q) =>
        (filterEstado === 'todos' || q.estado === filterEstado) &&
        (filterArea === 'todas' || q.area === filterArea),
    );
    const c: Record<string, number> = { Todas: source.length };
    categories.forEach((cat) => (c[cat] = source.filter((q) => q.categoria === cat).length));
    return c;
  }, [items, categories, filterEstado, filterArea]);

  // Cuando hay un área seleccionada, solo mostrar las categorías que tienen
  // preguntas en esa área — así el usuario identifica qué categorías existen por área.
  const categoriesForArea = useMemo(() => {
    if (filterArea === "todas") return categories;
    return categories.filter((cat) => (counts[cat] ?? 0) > 0);
  }, [categories, filterArea, counts]);

  // Si la categoría filtrada ya no aplica al área seleccionada, resetear el filtro
  useEffect(() => {
    if (filterCat !== "todas" && !categoriesForArea.includes(filterCat)) {
      setFilterCat("todas");
    }
  }, [filterArea, categoriesForArea]);

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
    setCatComboSearch("");
    setCatComboOpen(false);
    setIsCreatingArea(false);
    setNewAreaName("");
    setAreaComboSearch("");
    setAreaComboOpen(false);
    setShowModal(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({ ...q, opciones: [...q.opciones], correctas: [...q.correctas] });
    setIsCreatingCategory(false);
    setNewCategoryName("");
    setCatComboSearch("");
    setCatComboOpen(false);
    setIsCreatingArea(false);
    setNewAreaName("");
    setAreaComboSearch("");
    setAreaComboOpen(false);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('questionBank.confirmDelete'))) return;
    try {
      await questionsService.delete(id);
      setItems((p) => p.filter((q) => q.id !== id));
      showToast(t('questionBank.deleted'));
    } catch (error) {
      console.error('Error deleting question:', error);
      showToast(t('questionBank.deleteError'), "error");
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
    if (!form.enunciado.trim()) return showToast(t('questionBank.validStatement'), "error");
    if (!form.contexto.trim()) return showToast(t('questionBank.validContext'), "error");
    if (isCreatingCategory && !newCategoryName.trim())
      return showToast(t('questionBank.validCategory'), "error");
    if (isCreatingArea && !newAreaName.trim())
      return showToast(t('questionBank.validArea'), "error");
    const opcionesValidas = form.opciones.every((o) => o.trim().length > 0);
    if (!opcionesValidas) return showToast(t('questionBank.validOptions'), "error");
    if (form.correctas.length === 0)
      return showToast(t('questionBank.validCorrect'), "error");
    if (form.tipo === "unica" && form.correctas.length > 1)
      return showToast(t('questionBank.validSingleChoice'), "error");
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    // Si es una categoría nueva, agregarla a la lista de categorías
    if (isCreatingCategory && newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories((prev) => [...prev, newCategoryName.trim()].sort());
    }
    // Si es un área nueva, agregarla a la lista de áreas
    if (isCreatingArea && newAreaName.trim() && !areas.includes(newAreaName.trim())) {
      setAreas((prev) => [...prev, newAreaName.trim()].sort());
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
          area: form.area,
          dificultad: form.dificultad,
          estado: form.estado,
          justificacion: form.justificacion
        });
        setItems((p) => p.map((q) => (q.id === editing.id ? { ...form, id: editing.id } : q)));
        showToast(t('questionBank.updated'));
      } else {
        // Crear nueva pregunta en Supabase (sin evaluation_id para banco de preguntas)
        const created = await questionsService.create({
          evaluation_id: null,
          question_text: form.enunciado,
          contexto: form.contexto,
          options: form.opciones,
          correct_answer: form.correctas.join(','),
          categoria: form.categoria,
          area: form.area,
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
          area: created.area || '',
          dificultad: (created.dificultad as Difficulty) || 'medio',
          estado: (created.estado as Status) || 'activa',
          opciones: created.options || [],
          correctas: created.correct_answer ? created.correct_answer.split(',').map(Number) : [],
          justificacion: created.justificacion || '',
        };
        setItems((prev) => [mappedItem, ...prev]);
        showToast(t('questionBank.created'));
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (error) {
      console.error('Error saving question:', error);
      showToast(t('questionBank.saveError'), "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('questionBank.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">{t('questionBank.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title={t('questionBank.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={t('questionBank.title')}
        actions={<Button onClick={openCreate}><Plus className="size-4" /> {t('questionBank.newQuestion')}</Button>}
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
            <div className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[.14em] transition-colors duration-300" style={{ color: "var(--accent)" }}>
              {t('questionBank.categories')}
              {filterArea !== "todas" && (
                <span className="ml-1 normal-case tracking-normal" style={{ color: "var(--muted-foreground)" }}>
                  · {filterArea}
                </span>
              )}
            </div>
            {categoriesForArea.length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Buscar categoría..."
                  className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
                {catSearch && (
                  <button
                    onClick={() => setCatSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}
            <ul className="space-y-1">
              {!catSearch && (
                <li>
                  <button
                    onClick={() => setFilterCat("todas")}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ${
                      filterCat === "todas"
                        ? "bg-coral-soft text-coral-text"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span>{t('questionBank.all')}</span>
                    <span className="font-mono text-[10px] font-bold">{counts.Todas}</span>
                  </button>
                </li>
              )}
              {categoriesForArea
                .filter((c) => c.toLowerCase().includes(catSearch.toLowerCase()))
                .map((c: string, idx: number) => (
                  <li key={c} style={{ animation: `slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 25}ms both` }}>
                    <button
                      onClick={() => { setFilterCat(c); setCatSearch(""); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-300 ${
                        filterCat === c
                          ? "bg-coral-soft text-coral-text"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span className="truncate pr-2">{c}</span>
                      <span className="font-mono text-[10px] font-bold shrink-0">{counts[c] ?? 0}</span>
                    </button>
                  </li>
                ))}
              {catSearch && categoriesForArea.filter((c) => c.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                <li className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Sin resultados
                </li>
              )}
              {!catSearch && categoriesForArea.length === 0 && (
                <li className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t('questionBank.emptyFilters')}
                </li>
              )}
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
                placeholder={t('questionBank.searchPlaceholder')}
                className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
              className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="todos">{t('questionBank.allTypes')}</option>
              <option value="unica">{t('evaluations.singleChoice')}</option>
              <option value="multiple">{t('evaluations.multipleChoice')}</option>
              <option value="vf">{t('evaluations.trueFalse')}</option>
            </select>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="todas">{t('questionBank.allAreas')}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
              className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="todos">{t('questionBank.allStatuses')}</option>
              <option value="activa">{t('questionBank.active')}</option>
              <option value="borrador">{t('questionBank.draft')}</option>
              <option value="inactiva">{t('questionBank.inactive')}</option>
            </select>
            <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[.12em] px-3 py-2 rounded-lg transition-all duration-300" style={{ background: "var(--secondary)/40", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {t('questionBank.countOf', { count: filtered.length, total: items.length })}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center animate-fade-in transition-all duration-300" style={{ boxShadow: "var(--shadow-sm)" }}>
              <HelpCircle className="mx-auto mb-3 size-10 transition-colors duration-300" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                {t('questionBank.emptyFilters')}
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
                          {q.area && (
                            <span className="rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all duration-300 hover:shadow-sm" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                              {q.area}
                            </span>
                          )}
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
                            <strong className="transition-colors duration-300" style={{ color: "var(--foreground)" }}>{t('questionBank.context')}</strong> {q.contexto}
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
                            <strong className="transition-colors duration-300" style={{ color: "var(--foreground)" }}>{t('questionBank.justification')}</strong> {q.justificacion}
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
                    {t('questionBank.page', { current: page, total: totalPages, count: filtered.length })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                    >
                      {t('questionBank.prev')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                    >
                      {t('questionBank.next')}
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
                {editing ? t('questionBank.editTitle') : t('questionBank.newTitle')}
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
                  {t('questionBank.statementLabel')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.enunciado}
                  onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
                  placeholder={t('questionBank.statementPlaceholder')}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                />
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
                <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                  {t('questionBank.contextLabel')}
                  <span className="ml-1 font-normal normal-case transition-colors duration-300" style={{ color: "var(--muted-foreground)/70" }}>
                    {t('questionBank.contextHint')}
                  </span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.contexto}
                  onChange={(e) => setForm({ ...form, contexto: e.target.value })}
                  placeholder={t('questionBank.contextDesc')}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                />
              </div>


              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('questionBank.typeLabel')}
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setTipo(e.target.value as QType)}
                    className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    <option value="unica">{t('evaluations.singleChoice')}</option>
                    <option value="multiple">{t('evaluations.multipleChoice')}</option>
                    <option value="vf">{t('evaluations.trueFalse')}</option>
                  </select>
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('questionBank.categoryLabel')}
                  </label>
                  <div className="relative" ref={catComboRef}>
                    <input
                      type="text"
                      value={catComboOpen ? catComboSearch : (isCreatingCategory ? t('questionBank.createCategory') : form.categoria)}
                      onFocus={() => { setCatComboOpen(true); setCatComboSearch(""); }}
                      onChange={(e) => { setCatComboSearch(e.target.value); setCatComboOpen(true); }}
                      placeholder={t('questionBank.categoryLabel')}
                      className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                    {catComboOpen && (
                      <div
                        className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                      >
                        <div className="max-h-48 overflow-y-auto">
                          {categories
                            .filter((c) => c.toLowerCase().includes(catComboSearch.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  setForm({ ...form, categoria: c });
                                  setIsCreatingCategory(false);
                                  setCatComboOpen(false);
                                  setCatComboSearch("");
                                }}
                                className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                                style={{ color: form.categoria === c && !isCreatingCategory ? "var(--accent)" : "var(--foreground)" }}
                              >
                                {c}
                              </button>
                            ))}
                          {categories.filter((c) => c.toLowerCase().includes(catComboSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                              {t('questionBank.emptyFilters')}
                            </div>
                          )}
                        </div>
                        <div className="border-t" style={{ borderColor: "var(--border)" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingCategory(true);
                              setNewCategoryName("");
                              setForm({ ...form, categoria: "" });
                              setCatComboOpen(false);
                              setCatComboSearch("");
                            }}
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: "var(--accent)" }}
                          >
                            + {t('questionBank.createCategory')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isCreatingCategory && (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        setForm({ ...form, categoria: e.target.value });
                      }}
                      placeholder={t('questionBank.newCategoryName')}
                      autoFocus
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                  )}
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "175ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('questionBank.areaLabel')}
                  </label>
                  <div className="relative" ref={areaComboRef}>
                    <input
                      type="text"
                      value={areaComboOpen ? areaComboSearch : (isCreatingArea ? t('questionBank.createArea') : (form.area || t('generate.noArea')))}
                      onFocus={() => { setAreaComboOpen(true); setAreaComboSearch(""); }}
                      onChange={(e) => { setAreaComboSearch(e.target.value); setAreaComboOpen(true); }}
                      placeholder={t('questionBank.areaLabel')}
                      className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                    {areaComboOpen && (
                      <div
                        className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                      >
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setForm({ ...form, area: "" });
                              setIsCreatingArea(false);
                              setAreaComboOpen(false);
                              setAreaComboSearch("");
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: !form.area && !isCreatingArea ? "var(--accent)" : "var(--foreground)" }}
                          >
                            {t('generate.noArea')}
                          </button>
                          {areas
                            .filter((a) => a.toLowerCase().includes(areaComboSearch.toLowerCase()))
                            .map((a) => (
                              <button
                                key={a}
                                type="button"
                                onClick={() => {
                                  setForm({ ...form, area: a });
                                  setIsCreatingArea(false);
                                  setAreaComboOpen(false);
                                  setAreaComboSearch("");
                                }}
                                className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                                style={{ color: form.area === a && !isCreatingArea ? "var(--accent)" : "var(--foreground)" }}
                              >
                                {a}
                              </button>
                            ))}
                          {areas.filter((a) => a.toLowerCase().includes(areaComboSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                              {t('questionBank.emptyFilters')}
                            </div>
                          )}
                        </div>
                        <div className="border-t" style={{ borderColor: "var(--border)" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingArea(true);
                              setNewAreaName("");
                              setForm({ ...form, area: "" });
                              setAreaComboOpen(false);
                              setAreaComboSearch("");
                            }}
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: "var(--accent)" }}
                          >
                            + {t('questionBank.createArea')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isCreatingArea && (
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => {
                        setNewAreaName(e.target.value);
                        setForm({ ...form, area: e.target.value });
                      }}
                      placeholder={t('questionBank.newAreaName')}
                      autoFocus
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                  )}
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('questionBank.difficultyLabel')}
                  </label>
                  <select
                    value={form.dificultad}
                    onChange={(e) =>
                      setForm({ ...form, dificultad: e.target.value as Difficulty })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  >
                    <option value="facil">{t('common.easy')}</option>
                    <option value="medio">{t('common.medium')}</option>
                    <option value="dificil">{t('common.hard')}</option>
                  </select>
                </div>
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "250ms" }}>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('questionBank.optionsLabel')}
                  </label>
                  {form.tipo !== "vf" && form.opciones.length < 6 && (
                    <button
                      type="button"
                      onClick={addOpcion}
                      className="text-xs font-medium transition-all duration-300 hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {t('questionBank.addOption')}
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
                          title={t('questionBank.markCorrect')}
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
                  {t('questionBank.justificationLabel')}
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
                <label className="text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>{t('questionBank.statusLabel')}</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as Status })}
                  className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                >
                  <option value="activa">{t('questionBank.statusActive')}</option>
                  <option value="borrador">{t('questionBank.statusDraft')}</option>
                  <option value="inactiva">{t('questionBank.statusInactive')}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4 transition-all duration-300">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  <CheckCircle className="size-4" />
                  {editing ? t('questionBank.saveButton') : t('questionBank.createButton')}
                </Button>
              </div>

              <ConfirmDialog
                open={showSaveConfirm}
                title={editing ? t('questionBank.confirmSave') : t('questionBank.confirmCreate')}
                description={editing ? t('questionBank.confirmSaveDesc') : t('questionBank.confirmCreateDesc')}
                confirmLabel={editing ? t('questionBank.saveButton') : t('questionBank.createButton')}
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
