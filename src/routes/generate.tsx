import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RichTextField } from "@/components/RichTextField";
import { renderEscenarioHtml } from "@/lib/sanitizeHtml";
import {
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Upload,
  X,
  Wand2,
  Square,
  CheckSquare,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { extractTextWithOCR, type GeneratedQuestion } from "@/lib/services/openai";
import { questionsService, getUniqueCategories, getUniqueAreas } from "@/lib/services/evaluations";
import { generateQuestionsFn } from "@/lib/services/openai-server";
import { getModelConfig, getSystemPrompt } from "@/routes/settings";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "generate.pageTitle" },
      {
        name: "description",
        content: "Genera, revisa y guarda preguntas de evaluación calibradas desde cualquier documento usando IA.",
      },
    ],
  }),
  component: GeneratePage,
});

type QuestionType = "seleccion_unica" | "seleccion_multiple" | "verdadero_falso";

function getTypeLabels(t: (key: string) => string): Record<QuestionType, string> {
  return {
    seleccion_unica: t('evaluations.singleChoice'),
    seleccion_multiple: t('evaluations.multipleChoice'),
    verdadero_falso: t('evaluations.trueFalse'),
  };
}

const CASE_TYPES = [
  "Automático",
  "Operativo",
  "Atención al Cliente",
  "Seguridad de la Información",
  "Administrativo",
  "Legal",
  "Financiero",
  "Comercial",
  "Tecnológico",
] as const;

const CASE_LENGTHS = ["Corta", "Media", "Detallada"] as const;

function getCaseTypeLabels(t: (key: string) => string): Record<string, string> {
  return {
    "Automático": t('generate.caseTypeAuto'),
    "Operativo": t('generate.caseTypeOperational'),
    "Atención al Cliente": t('generate.caseTypeCustomerService'),
    "Seguridad de la Información": t('generate.caseTypeInfoSecurity'),
    "Administrativo": t('generate.caseTypeAdministrative'),
    "Legal": t('generate.caseTypeLegal'),
    "Financiero": t('generate.caseTypeFinancial'),
    "Comercial": t('generate.caseTypeCommercial'),
    "Tecnológico": t('generate.caseTypeTechnological'),
  };
}

function getCaseLengthLabels(t: (key: string) => string): Record<string, string> {
  return {
    "Corta": t('generate.caseLengthShort'),
    "Media": t('generate.caseLengthMedium'),
    "Detallada": t('generate.caseLengthDetailed'),
  };
}

function GeneratePage() {
  const { t } = useTranslation();
  const TYPE_LABELS = getTypeLabels(t);
  const CASE_TYPE_LABELS = getCaseTypeLabels(t);
  const CASE_LENGTH_LABELS = getCaseLengthLabels(t);
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('generate')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  // Step state
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [extractedText, setExtractedText] = useState("");

  // Config
  const [numPreguntas, setNumPreguntas] = useState(10);
  const [dificultad, setDificultad] = useState("medio");
  const [categoria, setCategoria] = useState("");
  const [area, setArea] = useState("");
  const [idioma, setIdioma] = useState("Español");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [catComboSearch, setCatComboSearch] = useState("");
  const [catComboOpen, setCatComboOpen] = useState(false);
  const catComboRef = useRef<HTMLDivElement>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [nuevaArea, setNuevaArea] = useState(false);
  const [areaComboSearch, setAreaComboSearch] = useState("");
  const [areaComboOpen, setAreaComboOpen] = useState(false);
  const areaComboRef = useRef<HTMLDivElement>(null);
  const [distribucion, setDistribucion] = useState<Record<QuestionType, number>>({
    seleccion_unica: 33,
    seleccion_multiple: 33,
    verdadero_falso: 34,
  });

  // Casos prácticos (modo adicional, opcional)
  const [generarCasos, setGenerarCasos] = useState(false);
  const [tipoCaso, setTipoCaso] = useState("Automático");
  const [longitudCaso, setLongitudCaso] = useState("Media");
  const [preguntasPorCaso, setPreguntasPorCaso] = useState(1);

  // Generation + review
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<{ current: number; total: number } | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GeneratedQuestion | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [partialWarning, setPartialWarning] = useState<{ generated: number; requested: number } | null>(null);

  const total = Object.values(distribucion).reduce((s, v) => s + v, 0);
  
  useEffect(() => {
    getUniqueCategories().then(setCategorias).catch(console.error);
    getUniqueAreas().then(setAreas).catch(console.error);
  }, []);

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


  function handleFile(f: File | null) {
    if (!f) return;
    const ok = /\.(pdf|docx|txt)$/i.test(f.name);
    if (!ok) {
      alert(t('generate.fileTypeError'));
      return;
    }
    setFile(f);
    setExtractedText("");
  }

  async function extractText() {
    if (!file) return;
    setExtracting(true);
    setExtractionProgress(0);
    setExtractionStatus(t('generate.extracting1'));
    setExtractionProgress(20);

    try {
      setExtractionStatus(t('generate.extracting2'));
      setExtractionProgress(40);

      setExtractionStatus(t('generate.extracting3'));
      setExtractionProgress(60);

      const text = await extractTextWithOCR(file);

      setExtractionStatus(t('generate.extracting4'));
      setExtractionProgress(80);

      setExtractionStatus(t('generate.extracting5'));
      setExtractionProgress(100);

      setExtractedText(text);
      setExtracting(false);
      setExtractionStatus(t('generate.extractionDone'));
    } catch (error) {
      setExtracting(false);
      setExtractionStatus(t('generate.extractionError'));
      console.error('Error extracting text:', error);
      alert(t('generate.extractError', { error: (error as Error).message }));
    }
  }

  function updateDistribucion(tipo: QuestionType, value: number) {
    const diff = value - distribucion[tipo];
    if (total + diff > 100) return;
    setDistribucion({ ...distribucion, [tipo]: value });
  }

  const CLIENT_BATCH_SIZE = 10;

  // Trocea `total` en trozos de tamaño máximo `maxPerChunk`, sin partir ninguna
  // "unidad" (caso) de tamaño `unitSize` entre dos trozos. Solo se usa en modo casos prácticos.
  function buildCaseAwareBatches(total: number, unitSize: number, maxPerChunk: number): number[] {
    const totalUnits = Math.ceil(total / unitSize);
    const unitSizes = Array.from({ length: totalUnits }, (_, i) =>
      i < totalUnits - 1 ? unitSize : total - unitSize * (totalUnits - 1)
    );
    const chunks: number[] = [];
    let current = 0;
    for (const size of unitSizes) {
      if (current > 0 && current + size > maxPerChunk) {
        chunks.push(current);
        current = 0;
      }
      current += size;
    }
    if (current > 0) chunks.push(current);
    return chunks;
  }

  async function generate() {
    setGenerating(true);
    setGenerateProgress(null);
    setQuestions([]);
    setSelected(new Set());
    setSaved(false);
    setPartialWarning(null);

    try {
      const customSystemPrompt = getSystemPrompt();
      const { model, temperature, maxTokens, retries } = getModelConfig();
      const casosPracticos = generarCasos
        ? { habilitado: true, tipo: tipoCaso, longitud: longitudCaso, preguntasPorCaso }
        : undefined;

      // Split into client-side batches to avoid nginx timeout.
      // En modo casos prácticos, se trocea por caso completo, nunca por pregunta suelta.
      const batches: number[] = casosPracticos
        ? buildCaseAwareBatches(numPreguntas, preguntasPorCaso, CLIENT_BATCH_SIZE)
        : (() => {
            const arr: number[] = [];
            let remaining = numPreguntas;
            while (remaining > 0) {
              arr.push(Math.min(remaining, CLIENT_BATCH_SIZE));
              remaining -= CLIENT_BATCH_SIZE;
            }
            return arr;
          })();

      const allQuestions: GeneratedQuestion[] = [];

      for (let i = 0; i < batches.length; i++) {
        setGenerateProgress({ current: i + 1, total: batches.length });
        const batchQuestions = await generateQuestionsFn({
          data: {
            extractedText,
            numPreguntas: batches[i],
            dificultad,
            categoria,
            area,
            distribucion,
            customSystemPrompt,
            model,
            temperature,
            maxTokens,
            retries,
            idioma,
            previousQuestions: allQuestions.map((q) => ({ pregunta: q.pregunta, opciones: q.opciones })),
            casosPracticos,
          },
        });
        // El servidor numera los caso_id desde 0 en cada llamada; se prefija con el
        // índice del lote para que sigan siendo únicos al combinar todos los lotes.
        const taggedBatch = casosPracticos
          ? batchQuestions.map((q) => (q.caso_id ? { ...q, caso_id: `${i}-${q.caso_id}` } : q))
          : batchQuestions;
        allQuestions.push(...taggedBatch);
      }

      // Re-number IDs sequentially across all batches
      const numbered = allQuestions.map((q, i) => ({ ...q, id: i + 1 }));
      setQuestions(numbered);
      setSelected(new Set(numbered.map((q) => q.id)));

      if (numbered.length < numPreguntas) {
        setPartialWarning({ generated: numbered.length, requested: numPreguntas });
      }
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      alert(t('generate.generateError', { error: (error as Error).message }));
    }

    setGenerating(false);
    setGenerateProgress(null);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function startEdit(q: GeneratedQuestion) {
    setEditingId(q.id);
    setEditDraft({ ...q, opciones: [...q.opciones], respuesta_correcta: [...q.respuesta_correcta] });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit() {
    if (!editDraft) return;
    setQuestions((prev) => prev.map((q) => (q.id === editDraft.id ? editDraft : q)));
    setEditingId(null);
    setEditDraft(null);
  }

  async function regenerateQuestion(q: GeneratedQuestion) {
    setRegeneratingId(q.id);
    // Cancel edit mode on the question being regenerated
    if (editingId === q.id) cancelEdit();
    try {
      const customSystemPrompt = getSystemPrompt();
      const { model, temperature, maxTokens, retries } = getModelConfig();
      const singleDistribucion = {
        seleccion_unica: q.tipo === "seleccion_unica" ? 100 : 0,
        seleccion_multiple: q.tipo === "seleccion_multiple" ? 100 : 0,
        verdadero_falso: q.tipo === "verdadero_falso" ? 100 : 0,
      };
      const [newQ] = await generateQuestionsFn({
        data: {
          extractedText,
          numPreguntas: 1,
          dificultad: q.dificultad,
          categoria: q.categoria,
          area: q.area,
          distribucion: singleDistribucion,
          customSystemPrompt,
          model,
          temperature,
          maxTokens,
          retries,
          previousQuestions: questions
            .filter((item) => item.id !== q.id)
            .map((item) => ({ pregunta: item.pregunta, opciones: item.opciones })),
          // Si la pregunta pertenece a un caso práctico, el escenario no se reinventa:
          // se le pide al modelo una pregunta nueva atada al mismo caso ya existente.
          escenarioFijo: q.es_caso_practico ? q.escenario : undefined,
        },
      });
      // Keep original id so selection state is preserved. Si era una pregunta de caso
      // práctico, se conserva el escenario/tipo/caso_id originales (no vienen del modelo).
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? {
                ...newQ,
                id: q.id,
                ...(q.es_caso_practico
                  ? { escenario: q.escenario, tipo_caso: q.tipo_caso, es_caso_practico: true, caso_id: q.caso_id }
                  : {}),
              }
            : item
        )
      );
    } catch (error) {
      alert(t('generate.regenerateError', { error: (error as Error).message }));
    } finally {
      setRegeneratingId(null);
    }
  }

  function toggleCorrectAnswer(optionIndex: number) {
    if (!editDraft) return;
    const isSingle = editDraft.tipo === "seleccion_unica" || editDraft.tipo === "verdadero_falso";
    if (isSingle) {
      setEditDraft({ ...editDraft, respuesta_correcta: [optionIndex] });
    } else {
      const already = editDraft.respuesta_correcta.includes(optionIndex);
      const next = already
        ? editDraft.respuesta_correcta.filter((i) => i !== optionIndex)
        : [...editDraft.respuesta_correcta, optionIndex];
      setEditDraft({ ...editDraft, respuesta_correcta: next });
    }
  }

  async function saveSelected() {
    if (selected.size === 0) {
      alert(t('generate.minOneQuestion'));
      return;
    }
    setSaving(true);

    try {
      const selectedQuestions = questions.filter(q => selected.has(q.id));

      const validQuestions = selectedQuestions.filter(q =>
        q.pregunta?.trim() &&
        Array.isArray(q.opciones) && q.opciones.length >= 2 &&
        Array.isArray(q.respuesta_correcta) && q.respuesta_correcta.length > 0
      );

      if (validQuestions.length === 0) {
        alert(t('generate.noValidQuestions'));
        setSaving(false);
        return;
      }

      if (validQuestions.length < selectedQuestions.length) {
        const skipped = selectedQuestions.length - validQuestions.length;
        alert(t('generate.skippedQuestions', { count: skipped }));
      }

      // Posición secuencial (0,1,2...) de cada pregunta dentro de su propio caso,
      // solo entre las que efectivamente se van a guardar (si se deselecciona alguna hermana).
      const casoOrdenCounters = new Map<string, number>();
      const questionsToSave = validQuestions.map(q => {
        let caso_orden: number | undefined;
        if (q.caso_id) {
          caso_orden = casoOrdenCounters.get(q.caso_id) ?? 0;
          casoOrdenCounters.set(q.caso_id, caso_orden + 1);
        }
        return {
          evaluation_id: null,
          question_text: q.pregunta,
          options: q.opciones,
          correct_answer: q.respuesta_correcta.join(','),
          contexto: q.contexto ?? '',
          categoria: q.categoria,
          area: q.area,
          dificultad: q.dificultad,
          estado: 'activa',
          justificacion: q.justificacion ?? '',
          escenario: q.escenario ?? '',
          tipo_caso: q.tipo_caso ?? '',
          es_caso_practico: q.es_caso_practico ?? false,
          caso_id: q.caso_id ?? '',
          caso_orden,
        };
      });

      const savedResult = await questionsService.createBatch(questionsToSave);

      // Eliminar del estado las preguntas ya guardadas para evitar duplicados
      const savedIds = new Set(validQuestions.map(q => q.id));
      setQuestions(prev => prev.filter(q => !savedIds.has(q.id)));
      setSelected(prev => {
        const next = new Set(prev);
        savedIds.forEach(id => next.delete(id));
        return next;
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (error) {
      console.error('❌ Error al guardar preguntas:', error);
      alert(t('generate.saveError', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={t('generate.title')}
        subtitle={t('generate.subtitle')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/question-bank">{t('generate.viewBank')}</Link>
          </Button>
        }
      />
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT: Upload + Extraction + Config */}
          <div className="space-y-6 lg:col-span-2">
            {/* 1. Upload - Enhanced Design */}
            <Card title={t('generate.step1Title')} subtitle={t('generate.step1Desc')}>
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/5 p-4 animate-slide-up transition-all">
                  <div className="grid size-10 place-items-center rounded-md bg-accent/15 text-accent animate-pulse-accent">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · listo para extracción
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setExtractedText("");
                    }}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="group flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-all duration-300 hover:border-accent/40 hover:bg-accent/5">
                  <div className="flex flex-col items-center transition-transform duration-300 group-hover:scale-110">
                    <Upload className="mb-2 size-6 transition-colors group-hover:text-accent" />
                    <span className="text-sm font-semibold">{t('generate.dragFile')}</span>
                    <span className="mt-1 text-[10px]">{t('generate.fileTypes')}</span>
                  </div>
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              <Button 
                onClick={extractText} 
                disabled={!file || extracting} 
                className="mt-4 w-full transition-all duration-300 hover:shadow-lg"
              >
                {extracting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {extractionStatus}
                  </>
                ) : extractedText ? (
                  <>
                    <CheckCircle2 className="size-4" /> {t('generate.reExtractButton')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> {t('generate.extractButton')}
                  </>
                )}
              </Button>

              {extracting && (
                <div className="mt-4 space-y-2 animate-slide-up">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{extractionProgress}%</span>
                    <span className="text-muted-foreground">{t('generate.processingButton')}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-500"
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {extractedText && !extracting && (
                <div className="mt-4 space-y-2 animate-slide-up">
                  <button
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    className="flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent/80 group"
                  >
                    {showExtractedText ? (
                      <>
                        <EyeOff className="size-4 transition-transform group-hover:scale-110" />
                        {t('generate.hideExtracted', { length: extractedText.length })}
                      </>
                    ) : (
                      <>
                        <Eye className="size-4 transition-transform group-hover:scale-110" />
                        {t('generate.viewExtracted', { length: extractedText.length })}
                      </>
                    )}
                  </button>
                  
                  {showExtractedText && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-secondary/50 p-4 animate-slide-down transition-all duration-300">
                      <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words font-mono">
                        {extractedText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 2. Configuration - Enhanced Design */}
            <Card
              title={t('generate.step2Title')}
              subtitle={t('generate.step2Desc')}
              disabled={!extractedText}
            >
              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <Field label={t('generate.numQuestions')} hint="1 – 100">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={numPreguntas}
                    onChange={(e) => setNumPreguntas(parseInt(e.target.value) || 1)}
                    className="field-base"
                  />
                </Field>
                <Field label={t('generate.difficulty')}>
                  <select
                    value={dificultad}
                    onChange={(e) => setDificultad(e.target.value)}
                    className="field-base"
                  >
                    <option value="facil">{t('common.easy')}</option>
                    <option value="medio">{t('common.medium')}</option>
                    <option value="dificil">{t('common.hard')}</option>
                  </select>
                </Field>
                <Field label={t('generate.category')}>
                  <div className="relative" ref={catComboRef}>
                    <input
                      type="text"
                      value={catComboOpen ? catComboSearch : (nuevaCategoria ? t('generate.createCategory') : (categoria || t('generate.noCategory')))}
                      onFocus={() => { setCatComboOpen(true); setCatComboSearch(""); }}
                      onChange={(e) => { setCatComboSearch(e.target.value); setCatComboOpen(true); }}
                      placeholder={t('generate.noCategory')}
                      className="field-base"
                    />
                    {catComboOpen && (
                      <div
                        className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                      >
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => { setCategoria(""); setNuevaCategoria(false); setCatComboOpen(false); setCatComboSearch(""); }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: !categoria && !nuevaCategoria ? "var(--accent)" : "var(--foreground)" }}
                          >
                            {t('generate.noCategory')}
                          </button>
                          {categorias
                            .filter((c) => c.toLowerCase().includes(catComboSearch.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => { setCategoria(c); setNuevaCategoria(false); setCatComboOpen(false); setCatComboSearch(""); }}
                                className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                                style={{ color: categoria === c && !nuevaCategoria ? "var(--accent)" : "var(--foreground)" }}
                              >
                                {c}
                              </button>
                            ))}
                          {categorias.filter((c) => c.toLowerCase().includes(catComboSearch.toLowerCase())).length === 0 && catComboSearch && (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                              Sin resultados
                            </div>
                          )}
                        </div>
                        <div className="border-t" style={{ borderColor: "var(--border)" }}>
                          <button
                            type="button"
                            onClick={() => { setNuevaCategoria(true); setCategoria(""); setCatComboOpen(false); setCatComboSearch(""); }}
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: "var(--accent)" }}
                          >
                            {t('generate.createCategory')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {nuevaCategoria && (
                    <input
                      type="text"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      placeholder={t('generate.newCategoryName')}
                      autoFocus
                      className="mt-2 field-base"
                    />
                  )}
                </Field>
                <Field label={t('generate.area')}>
                  <div className="relative" ref={areaComboRef}>
                    <input
                      type="text"
                      value={areaComboOpen ? areaComboSearch : (nuevaArea ? t('generate.createArea') : (area || t('generate.noArea')))}
                      onFocus={() => { setAreaComboOpen(true); setAreaComboSearch(""); }}
                      onChange={(e) => { setAreaComboSearch(e.target.value); setAreaComboOpen(true); }}
                      placeholder={t('generate.noArea')}
                      className="field-base"
                    />
                    {areaComboOpen && (
                      <div
                        className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                      >
                        <div className="max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => { setArea(""); setNuevaArea(false); setAreaComboOpen(false); setAreaComboSearch(""); }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: !area && !nuevaArea ? "var(--accent)" : "var(--foreground)" }}
                          >
                            {t('generate.noArea')}
                          </button>
                          {areas
                            .filter((a) => a.toLowerCase().includes(areaComboSearch.toLowerCase()))
                            .map((a) => (
                              <button
                                key={a}
                                type="button"
                                onClick={() => { setArea(a); setNuevaArea(false); setAreaComboOpen(false); setAreaComboSearch(""); }}
                                className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                                style={{ color: area === a && !nuevaArea ? "var(--accent)" : "var(--foreground)" }}
                              >
                                {a}
                              </button>
                            ))}
                          {areas.filter((a) => a.toLowerCase().includes(areaComboSearch.toLowerCase())).length === 0 && areaComboSearch && (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                              Sin resultados
                            </div>
                          )}
                        </div>
                        <div className="border-t" style={{ borderColor: "var(--border)" }}>
                          <button
                            type="button"
                            onClick={() => { setNuevaArea(true); setArea(""); setAreaComboOpen(false); setAreaComboSearch(""); }}
                            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                            style={{ color: "var(--accent)" }}
                          >
                            {t('generate.createArea')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {nuevaArea && (
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder={t('generate.newAreaName')}
                      autoFocus
                      className="mt-2 field-base"
                    />
                  )}
                </Field>
                <Field label={t('generate.language')}>
                  <select
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    className="field-base"
                  >
                    <option value="Español">{t('generate.spanish')}</option>
                    <option value="Inglés">{t('generate.english')}</option>
                    <option value="Portugués">{t('generate.portuguese')}</option>
                  </select>
                </Field>
              </div>

              <div className="mt-6 space-y-4 p-5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t('generate.distributionTitle')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                      {t('generate.distributionHint')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold ${
                      total === 100
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {t('generate.distributionTotal', { total })}
                  </span>
                </div>
                {(Object.keys(distribucion) as QuestionType[]).map((tipo) => (
                  <div key={tipo} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--foreground)]">{TYPE_LABELS[tipo]}</span>
                      <span className="font-mono font-bold text-accent w-8 text-right">{distribucion[tipo]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={distribucion[tipo]}
                      onChange={(e) => updateDistribucion(tipo, parseInt(e.target.value))}
                      className="w-full cursor-pointer accent-accent"
                      style={{ accentColor: "var(--accent)" }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4 p-5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-fade-in">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generarCasos}
                    onChange={(e) => setGenerarCasos(e.target.checked)}
                    className="size-4 accent-accent"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                      {t('generate.casesTitle')}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                      {t('generate.casesDesc')}
                    </p>
                  </div>
                </label>

                {generarCasos && (
                  <div className="grid grid-cols-3 gap-4 animate-fade-in">
                    <Field label={t('generate.caseType')}>
                      <select
                        value={tipoCaso}
                        onChange={(e) => setTipoCaso(e.target.value)}
                        className="field-base"
                      >
                        {CASE_TYPES.map((ct) => (
                          <option key={ct} value={ct}>{CASE_TYPE_LABELS[ct]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('generate.caseLength')}>
                      <select
                        value={longitudCaso}
                        onChange={(e) => setLongitudCaso(e.target.value)}
                        className="field-base"
                      >
                        {CASE_LENGTHS.map((cl) => (
                          <option key={cl} value={cl}>{CASE_LENGTH_LABELS[cl]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={t('generate.questionsPerCase')}
                      hint={t('generate.caseCountHint', { count: Math.ceil(numPreguntas / preguntasPorCaso) })}
                    >
                      <select
                        value={preguntasPorCaso}
                        onChange={(e) => setPreguntasPorCaso(parseInt(e.target.value))}
                        className="field-base"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </Field>
                  </div>
                )}
              </div>

              <Button
                onClick={() => generate()}
                disabled={!extractedText || generating || total !== 100}
                size="lg"
                className="mt-6 w-full transition-all duration-300 hover:shadow-lg disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {generateProgress && generateProgress.total > 1
                      ? `${t('generate.generatingButton')} (${generateProgress.current}/${generateProgress.total})`
                      : t('generate.generatingButton')}
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" /> {t('generate.generateButton')}
                  </>
                )}
              </Button>

              {partialWarning && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 animate-slide-down">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      {t('generate.partialGenerationTitle')}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t('generate.partialGeneration', {
                        generated: partialWarning.generated,
                        requested: partialWarning.requested,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setPartialWarning(null)}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-amber-600 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
                    aria-label={t('common.close')}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: Enhanced Pipeline Panel */}
          <div className="space-y-6 animate-slide-in-left">
            {/* Flujo de Extracción */}
            {(() => {
              const steps = [
                { label: t('generate.flow1'), completed: !!file },
                { label: t('generate.flow2'), completed: !!extractedText },
                { label: t('generate.flow3'), completed: questions.length > 0 || generating },
                { label: t('generate.flow4'), completed: questions.length > 0 },
                { label: t('generate.flow5'), completed: questions.length > 0 && selected.size > 0 },
                { label: t('generate.flow6'), completed: saved },
              ];
              const currentStepIndex = steps.findIndex((s) => !s.completed);
              return (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6 transition-all duration-300 hover:shadow-lg">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                    {t('generate.flowTitle')}
                  </div>
                  <ol className="mt-5 space-y-3.5 text-xs">
                    {steps.map((s, i) => {
                      const isCurrent = i === currentStepIndex;
                      return (
                        <li
                          key={i}
                          className="flex gap-3 transition-all duration-300 group"
                          style={{ opacity: s.completed || isCurrent ? 1 : 0.4 }}
                        >
                          <div className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[9px] font-bold transition-all duration-300 ${
                            s.completed
                              ? "bg-accent text-white border-accent"
                              : isCurrent
                              ? "border-accent/70 bg-accent/10 text-accent"
                              : "border-[var(--border)] text-[var(--muted-foreground)]"
                          }`}>
                            {s.completed ? (
                              <Check className="size-3" />
                            ) : (
                              <span className={isCurrent ? "animate-pulse" : ""}>{i + 1}</span>
                            )}
                          </div>
                          <span className={`transition-colors duration-300 ${
                            s.completed
                              ? "text-[var(--foreground)] font-medium"
                              : isCurrent
                              ? "text-[var(--foreground)] font-semibold"
                              : "text-[var(--muted-foreground)]"
                          }`}>
                            {s.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })()}

            {/* Recomendaciones - Enhanced Design */}
            <div className="rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:border-accent/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <h3 className="font-bold">{t('generate.recTitle')}</h3>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>{t('generate.rec1')}</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>{t('generate.rec2')}</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>{t('generate.rec3')}</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>
                    {t('generate.rec4')}{" "}
                    <Link to="/settings" className="text-accent font-semibold hover:underline">
                      {t('generate.rec4Link')}
                    </Link>
                    .
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3. Review & Save - Enhanced Design with Card Layout */}
        {questions.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden animate-slide-up">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-secondary/40 to-accent/5 p-6">
              <div>
                <h2 className="text-lg font-bold">{t('generate.step3Title')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('generate.step3Desc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-accent border border-accent/30">
                  {t('generate.selectedOf', { selected: selected.size, total: questions.length })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      selected.size === questions.length ? new Set() : new Set(questions.map((q) => q.id)),
                    )
                  }
                  className="transition-all duration-300 hover:bg-secondary"
                >
                  {selected.size === questions.length ? t('generate.deselect') : t('generate.select')}
                </Button>
                <Button 
                  onClick={() => setShowSaveConfirm(true)} 
                  disabled={saving || selected.size === 0}
                  className="transition-all duration-300 hover:shadow-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {t('generate.savingButton')}
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 className="size-4" /> {t('generate.savedButton')}
                    </>
                  ) : (
                    <>
                      <Save className="size-4" /> {t('generate.saveButton')}
                    </>
                  )}
                </Button>

                <ConfirmDialog
                  open={showSaveConfirm}
                  title={t('generate.confirmSaveTitle')}
                  description={t('generate.confirmSaveDesc', { count: selected.size })}
                  confirmLabel={t('generate.saveButton')}
                  loading={saving}
                  onConfirm={async () => { setShowSaveConfirm(false); await saveSelected(); }}
                  onCancel={() => setShowSaveConfirm(false)}
                />
              </div>
            </div>

            {/* Questions Grid - Card Layout */}
            <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-1">
              {(() => {
                // Las preguntas de un mismo caso práctico llegan contiguas (se generan y
                // acumulan juntas); se marca el inicio de cada grupo para mostrar su escenario una sola vez.
                let lastCasoId: string | undefined;
                return questions.map((q) => {
                  const isGroupStart = !!q.caso_id && q.caso_id !== lastCasoId;
                  lastCasoId = q.caso_id;
                  return isGroupStart;
                });
              })().map((showCaseHeader, idx) => {
                const q = questions[idx];
                const isSel = selected.has(q.id);
                return (
                  <Fragment key={q.id}>
                    {showCaseHeader && (
                      <div className="col-span-full rounded-lg border border-accent/40 bg-accent/5 p-4 animate-fade-in">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-sm">📋</span>
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                            {t('generate.caseBadge')} · {q.tipo_caso}
                          </span>
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_img]:block [&_img]:mx-auto [&_img]:max-w-full [&_img]:rounded-lg [&_iframe]:mx-auto [&_iframe]:block [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: renderEscenarioHtml(q.escenario) }}
                        />
                      </div>
                    )}
                    <div
                      className={`group rounded-lg border transition-all duration-300 p-5 ${
                        isSel
                          ? "border-accent/40 bg-accent/10 shadow-md hover:shadow-lg hover:border-accent/60"
                          : "border-border bg-card hover:border-accent/20 hover:shadow-md"
                      }`}
                      style={{
                        animation: `slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms both`
                      }}
                    >
                    <div className="flex gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggle(q.id)}
                        className="mt-0.5 shrink-0 text-accent transition-transform duration-300 hover:scale-125"
                        aria-label={t('generate.selectQuestion')}
                      >
                        {isSel ? (
                          <CheckSquare className="size-5 animate-scale-in" />
                        ) : (
                          <Square className="size-5 text-muted-foreground group-hover:text-accent/60" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-3">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            #{String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {TYPE_LABELS[q.tipo]}
                          </span>
                          {q.es_caso_practico && (
                            <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                              📋 {t('generate.caseBadge')}
                            </span>
                          )}
                          <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                            {editingId === q.id && editDraft ? editDraft.dificultad : q.dificultad}
                          </span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {editingId === q.id && editDraft ? editDraft.categoria : q.categoria}
                          </span>
                          {(editingId === q.id && editDraft ? editDraft.area : q.area) && (
                            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {editingId === q.id && editDraft ? editDraft.area : q.area}
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={() => regenerateQuestion(q)}
                              disabled={regeneratingId !== null || editingId === q.id || generating}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Regenerar esta pregunta"
                            >
                              {regeneratingId === q.id ? (
                                <><Loader2 className="size-3 animate-spin" /> {t('common.regenerating')}</>
                              ) : (
                                <><RefreshCw className="size-3" /> {t('common.regenerate')}</>
                              )}
                            </button>
                            <button
                              onClick={() => editingId === q.id ? cancelEdit() : startEdit(q)}
                              disabled={regeneratingId !== null}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={editingId === q.id ? t('generate.cancelEditing') : t('common.edit')}
                            >
                              {editingId === q.id ? (
                                <><X className="size-3" /> {t('generate.cancelEdit')}</>
                              ) : (
                                <><Pencil className="size-3" /> {t('common.edit')}</>
                              )}
                            </button>
                          </div>
                        </div>

                        {editingId === q.id && editDraft ? (
                          /* ── EDIT MODE ── */
                          <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4 animate-slide-down">
                            {/* Pregunta */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editQuestion')}</label>
                              <textarea
                                rows={3}
                                value={editDraft.pregunta}
                                onChange={(e) => setEditDraft({ ...editDraft, pregunta: e.target.value })}
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </div>

                            {/* Escenario del caso práctico (solo si aplica) */}
                            {editDraft.es_caso_practico && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editScenario')}</label>
                                <RichTextField
                                  value={editDraft.escenario ?? ''}
                                  onChange={(html) => setEditDraft({ ...editDraft, escenario: html })}
                                />
                              </div>
                            )}

                            {/* Contexto */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editContext')}</label>
                              <textarea
                                rows={2}
                                value={editDraft.contexto}
                                onChange={(e) => setEditDraft({ ...editDraft, contexto: e.target.value })}
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </div>

                            {/* Opciones */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t('generate.editOptions')}
                              </label>
                              {editDraft.opciones.map((opt, i) => {
                                const isCorrect = editDraft.respuesta_correcta.includes(i);
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all duration-300 ${
                                      isCorrect
                                        ? "border-emerald-500/50 bg-emerald-500/10"
                                        : "border-border bg-background hover:border-accent/30"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleCorrectAnswer(i)}
                                      title={isCorrect ? t('generate.unmarkCorrect') : t('generate.markCorrect')}
                                      className={`grid size-5 shrink-0 place-items-center rounded-sm font-mono text-[10px] font-bold transition-all duration-300 ${
                                        isCorrect
                                          ? "bg-emerald-500 text-white"
                                          : "bg-secondary text-muted-foreground hover:bg-accent/20"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + i)}
                                    </button>
                                    <input
                                      value={opt}
                                      onChange={(e) => {
                                        const next = [...editDraft.opciones];
                                        next[i] = e.target.value;
                                        setEditDraft({ ...editDraft, opciones: next });
                                      }}
                                      className="flex-1 bg-transparent text-xs focus:outline-none"
                                    />
                                    {isCorrect && <Check className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Dificultad + Categoría + Área */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editDifficulty')}</label>
                                <select
                                  value={editDraft.dificultad}
                                  onChange={(e) => setEditDraft({ ...editDraft, dificultad: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                                >
                                  <option value="facil">{t('common.easy')}</option>
                                  <option value="medio">{t('common.medium')}</option>
                                  <option value="dificil">{t('common.hard')}</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editCategory')}</label>
                                <input
                                  value={editDraft.categoria}
                                  onChange={(e) => setEditDraft({ ...editDraft, categoria: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editArea')}</label>
                                <input
                                  value={editDraft.area}
                                  onChange={(e) => setEditDraft({ ...editDraft, area: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                              </div>
                            </div>

                            {/* Justificación */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('generate.editJustification')}</label>
                              <textarea
                                rows={2}
                                value={editDraft.justificacion}
                                onChange={(e) => setEditDraft({ ...editDraft, justificacion: e.target.value })}
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                              <Button size="sm" onClick={saveEdit} className="transition-all duration-300">
                                <Save className="size-3.5" /> {t('generate.saveChanges')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                {t('generate.cancelEdit')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── VIEW MODE ── */
                          <>
                            <p className="text-sm font-medium leading-relaxed text-foreground">{q.pregunta}</p>
                            {q.contexto && (
                              <p className="rounded-md border-l-4 border-accent/50 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                <strong className="text-foreground">Contexto:</strong> {q.contexto}
                              </p>
                            )}
                            <ul className="space-y-1.5">
                              {q.opciones.map((opt, i) => {
                                const correct = q.respuesta_correcta.includes(i);
                                return (
                                  <li
                                    key={i}
                                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all duration-300 ${
                                      correct
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                        : "border-border bg-background text-muted-foreground group-hover:border-accent/20"
                                    }`}
                                  >
                                    <span className="grid size-5 shrink-0 place-items-center rounded-sm font-mono text-[10px] font-bold">
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    <span className="flex-1">{opt}</span>
                                    {correct && <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="rounded-md border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                              <strong className="text-foreground">Justificación:</strong> {q.justificacion}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Card({
  title,
  subtitle,
  children,
  disabled,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card shadow-sm transition-opacity ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div className="border-b border-border bg-secondary/40 p-5">
        <h2 className="font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
