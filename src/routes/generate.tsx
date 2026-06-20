import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { extractTextWithOCR, type GeneratedQuestion } from "@/lib/services/openai";
import { questionsService, getUniqueCategories } from "@/lib/services/evaluations";
import { generateQuestionsFn } from "@/lib/services/openai-server";
import { getModelConfig, getSystemPrompt } from "@/routes/settings";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "Generador de Preguntas IA — EvalPro" },
      {
        name: "description",
        content: "Genera, revisa y guarda preguntas de evaluación calibradas desde cualquier documento usando IA.",
      },
    ],
  }),
  component: GeneratePage,
});

type QuestionType = "seleccion_unica" | "seleccion_multiple" | "verdadero_falso";

const TYPE_LABELS: Record<QuestionType, string> = {
  seleccion_unica: "Selección Única",
  seleccion_multiple: "Selección Múltiple",
  verdadero_falso: "Verdadero / Falso",
};

function GeneratePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

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
  const [tiempoLimite, setTiempoLimite] = useState(30);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [distribucion, setDistribucion] = useState<Record<QuestionType, number>>({
    seleccion_unica: 33,
    seleccion_multiple: 33,
    verdadero_falso: 34,
  });

  // Generation + review
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GeneratedQuestion | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const total = Object.values(distribucion).reduce((s, v) => s + v, 0);
  
  useEffect(() => {
    getUniqueCategories().then(setCategorias).catch(console.error);
  }, []);


  function handleFile(f: File | null) {
    if (!f) return;
    const ok = /\.(pdf|docx|txt)$/i.test(f.name);
    if (!ok) {
      alert("Solo se permiten archivos PDF, DOCX y TXT");
      return;
    }
    setFile(f);
    setExtractedText("");
  }

  async function extractText() {
    if (!file) return;
    setExtracting(true);
    setExtractionProgress(0);
    setExtractionStatus("Subiendo a almacenamiento seguro…");
    setExtractionProgress(20);
    
    try {
      setExtractionStatus("Codificando documento para IA…");
      setExtractionProgress(40);
      
      setExtractionStatus("Llamando a OpenAI Responses API…");
      setExtractionProgress(60);
      
      const text = await extractTextWithOCR(file);
      
      setExtractionStatus("Analizando texto extraído…");
      setExtractionProgress(80);
      
      setExtractionStatus("Validando contenido…");
      setExtractionProgress(100);
      
      setExtractedText(text);
      setExtracting(false);
      setExtractionStatus("Extracción completada");
    } catch (error) {
      setExtracting(false);
      setExtractionStatus("Error en la extracción");
      console.error('Error extracting text:', error);
      alert('Error al extraer el texto: ' + (error as Error).message);
    }
  }

  function updateDistribucion(tipo: QuestionType, value: number) {
    const diff = value - distribucion[tipo];
    if (total + diff > 100) return;
    setDistribucion({ ...distribucion, [tipo]: value });
  }

  async function generate() {
    setGenerating(true);
    setQuestions([]);
    setSelected(new Set());
    setSaved(false);
    
    try {
      const customSystemPrompt = getSystemPrompt();
      const { model, temperature, maxTokens, retries } = getModelConfig();
      const questionsArray = await generateQuestionsFn({
        data: { extractedText, numPreguntas, dificultad, categoria, distribucion, customSystemPrompt, model, temperature, maxTokens, retries },
      });

      setQuestions(questionsArray);
      // pre-select all
      setSelected(new Set(questionsArray.map((q) => q.id)));
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      alert('Error al generar preguntas: ' + (error as Error).message);
    }
    
    setGenerating(false);
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
          distribucion: singleDistribucion,
          customSystemPrompt,
          model,
          temperature,
          maxTokens,
          retries,
        },
      });
      // Keep original id so selection state is preserved
      setQuestions((prev) =>
        prev.map((item) => (item.id === q.id ? { ...newQ, id: q.id } : item))
      );
    } catch (error) {
      alert("Error al regenerar la pregunta: " + (error as Error).message);
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
      alert("Selecciona al menos una pregunta para guardar");
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
        alert('Ninguna de las preguntas seleccionadas tiene enunciado, opciones y respuesta correcta. Regenera las preguntas.');
        setSaving(false);
        return;
      }

      if (validQuestions.length < selectedQuestions.length) {
        const skipped = selectedQuestions.length - validQuestions.length;
        alert(`Se omitieron ${skipped} pregunta(s) incompletas (sin enunciado, opciones o respuesta correcta).`);
      }

      const questionsToSave = validQuestions.map(q => ({
        evaluation_id: null,
        question_text: q.pregunta,
        options: q.opciones,
        correct_answer: q.respuesta_correcta.join(','),
        contexto: q.contexto ?? '',
        categoria: q.categoria,
        dificultad: q.dificultad,
        estado: 'activa',
        justificacion: q.justificacion ?? ''
      }));

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
      alert('Error al guardar las preguntas: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      breadcrumb={[{ label: "Herramientas" }, { label: "Generador IA" }]}
      actions={
        <Button asChild variant="ghost">
          <Link to="/question-bank">Ver Banco de Preguntas</Link>
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT: Upload + Extraction + Config */}
          <div className="space-y-6 lg:col-span-2">
            {/* 1. Upload - Enhanced Design */}
            <Card title="1. Cargar Documento" subtitle="Sube PDF, DOCX o TXT para extraer contenido">
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
                    <span className="text-sm font-semibold">Arrastra tu archivo aquí o haz clic</span>
                    <span className="mt-1 text-[10px]">PDF, DOCX, TXT (máx. 10MB)</span>
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
                    <CheckCircle2 className="size-4" /> Re-extraer Texto
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Extraer Texto del Documento
                  </>
                )}
              </Button>

              {extracting && (
                <div className="mt-4 space-y-2 animate-slide-up">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{extractionProgress}%</span>
                    <span className="text-muted-foreground">Procesando...</span>
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
                        Ocultar texto extraído ({extractedText.length} chars)
                      </>
                    ) : (
                      <>
                        <Eye className="size-4 transition-transform group-hover:scale-110" />
                        Ver texto extraído ({extractedText.length} chars)
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
              title="2. Configuración de Preguntas"
              subtitle="Define los parámetros de generación"
              disabled={!extractedText}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
                <Field label="Número de Preguntas" hint="5-50">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numPreguntas}
                    onChange={(e) => setNumPreguntas(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                  />
                </Field>
                <Field label="Dificultad">
                  <select
                    value={dificultad}
                    onChange={(e) => setDificultad(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </Field>
                <Field label="Categoría">
                  <select
                    value={nuevaCategoria ? "__new__" : categoria}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setNuevaCategoria(true);
                        setCategoria("");
                      } else {
                        setNuevaCategoria(false);
                        setCategoria(e.target.value);
                      }
                    }}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__new__">+ Crear nueva categoría…</option>
                  </select>
                  {nuevaCategoria && (
                    <input
                      type="text"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      placeholder="Nombre de la nueva categoría"
                      autoFocus
                      className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  )}
                </Field>
                <Field label="Tiempo Límite (min)" hint="30 min default">
                  <input
                    type="number"
                    min={1}
                    value={tiempoLimite}
                    onChange={(e) => setTiempoLimite(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                  />
                </Field>
              </div>

              <div className="mt-8 space-y-4 p-5 rounded-lg border border-border/50 bg-secondary/30 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Distribución por Tipo de Pregunta
                    </label>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Ajusta los porcentajes para definir la composición de preguntas
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold transition-all duration-300 ${
                      total === 100
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm"
                    }`}
                  >
                    Total: {total}%
                  </span>
                </div>
                {(Object.keys(distribucion) as QuestionType[]).map((tipo, idx) => (
                  <div key={tipo} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{TYPE_LABELS[tipo]}</span>
                      <span className="font-mono font-bold text-accent">{distribucion[tipo]}%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={distribucion[tipo]}
                        onChange={(e) => updateDistribucion(tipo, parseInt(e.target.value))}
                        className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent transition-opacity hover:opacity-100 opacity-90"
                      />
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent rounded-full pointer-events-none transition-all"
                        style={{
                          left: `calc(${distribucion[tipo]}% - 8px)`,
                          boxShadow: '0 0 12px rgba(237, 86, 80, 0.3)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => generate()}
                disabled={!extractedText || generating || total !== 100}
                size="lg"
                className="mt-6 w-full transition-all duration-300 hover:shadow-lg disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Generando preguntas con IA…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" /> Generar Preguntas
                  </>
                )}
              </Button>
            </Card>
          </div>

          {/* RIGHT: Enhanced Pipeline Panel */}
          <div className="space-y-6 animate-slide-in-left">
            {/* Flujo de Extracción */}
            {(() => {
              const steps = [
                { label: "Cargar documento",             completed: !!file },
                { label: "Extracción de texto con IA",   completed: !!extractedText },
                { label: "Configurar parámetros",        completed: questions.length > 0 || generating },
                { label: "Generar preguntas",            completed: questions.length > 0 },
                { label: "Revisar y seleccionar",        completed: questions.length > 0 && selected.size > 0 },
                { label: "Guardar en Banco de Preguntas", completed: saved },
              ];
              const currentStepIndex = steps.findIndex((s) => !s.completed);
              return (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6 transition-all duration-300 hover:shadow-lg">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                    ✨ Flujo de Extracción
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
                <h3 className="font-bold">Recomendaciones</h3>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>Los archivos PDF y DOCX se procesan directamente para extraer texto.</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>Las imágenes (.jpg, .png) se procesan con IA de visión de OpenAI.</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>Los archivos de texto (.txt) se leen directamente sin procesamiento adicional.</span>
                </li>
                <li className="flex gap-2 transition-all hover:text-foreground">
                  <span className="shrink-0 text-accent font-bold">•</span>
                  <span>
                    Personaliza los prompts en{" "}
                    <Link to="/settings" className="text-accent font-semibold hover:underline">
                      Configuración de Prompts
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
                <h2 className="text-lg font-bold">3. Revisar y Seleccionar Preguntas</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Marca las preguntas que quieras conservar y guárdalas en el banco.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-accent border border-accent/30">
                  {selected.size} de {questions.length}
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
                  {selected.size === questions.length ? "Deseleccionar" : "Seleccionar"}
                </Button>
                <Button 
                  onClick={() => setShowSaveConfirm(true)} 
                  disabled={saving || selected.size === 0}
                  className="transition-all duration-300 hover:shadow-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Guardando…
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 className="size-4" /> Guardadas
                    </>
                  ) : (
                    <>
                      <Save className="size-4" /> Guardar
                    </>
                  )}
                </Button>

                <ConfirmDialog
                  open={showSaveConfirm}
                  title="¿Guardar preguntas seleccionadas?"
                  description={`Se agregarán ${selected.size} pregunta${selected.size !== 1 ? "s" : ""} al banco de preguntas.`}
                  confirmLabel="Guardar"
                  loading={saving}
                  onConfirm={async () => { setShowSaveConfirm(false); await saveSelected(); }}
                  onCancel={() => setShowSaveConfirm(false)}
                />
              </div>
            </div>

            {/* Questions Grid - Card Layout */}
            <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-1">
              {questions.map((q, idx) => {
                const isSel = selected.has(q.id);
                return (
                  <div
                    key={q.id}
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
                        aria-label="Seleccionar pregunta"
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
                          <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                            {editingId === q.id && editDraft ? editDraft.dificultad : q.dificultad}
                          </span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {editingId === q.id && editDraft ? editDraft.categoria : q.categoria}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={() => regenerateQuestion(q)}
                              disabled={regeneratingId === q.id || editingId === q.id || generating}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Regenerar esta pregunta"
                            >
                              {regeneratingId === q.id ? (
                                <><Loader2 className="size-3 animate-spin" /> Regenerando…</>
                              ) : (
                                <><RefreshCw className="size-3" /> Regenerar</>
                              )}
                            </button>
                            <button
                              onClick={() => editingId === q.id ? cancelEdit() : startEdit(q)}
                              disabled={regeneratingId === q.id}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={editingId === q.id ? "Cancelar edición" : "Editar pregunta"}
                            >
                              {editingId === q.id ? (
                                <><X className="size-3" /> Cancelar</>
                              ) : (
                                <><Pencil className="size-3" /> Editar</>
                              )}
                            </button>
                          </div>
                        </div>

                        {editingId === q.id && editDraft ? (
                          /* ── EDIT MODE ── */
                          <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4 animate-slide-down">
                            {/* Pregunta */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pregunta</label>
                              <textarea
                                rows={3}
                                value={editDraft.pregunta}
                                onChange={(e) => setEditDraft({ ...editDraft, pregunta: e.target.value })}
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </div>

                            {/* Contexto */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contexto (opcional)</label>
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
                                Opciones — haz clic en la letra para marcar como correcta
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
                                      title={isCorrect ? "Quitar como correcta" : "Marcar como correcta"}
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

                            {/* Dificultad + Categoría */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dificultad</label>
                                <select
                                  value={editDraft.dificultad}
                                  onChange={(e) => setEditDraft({ ...editDraft, dificultad: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                                >
                                  <option value="facil">Fácil</option>
                                  <option value="medio">Medio</option>
                                  <option value="dificil">Difícil</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categoría</label>
                                <input
                                  value={editDraft.categoria}
                                  onChange={(e) => setEditDraft({ ...editDraft, categoria: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                              </div>
                            </div>

                            {/* Justificación */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Justificación</label>
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
                                <Save className="size-3.5" /> Guardar cambios
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                Cancelar
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
