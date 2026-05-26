import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { extractTextWithOCR, generateQuestions, type GeneratedQuestion } from "@/lib/services/openai";

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
  const isAdmin = profile?.role === 'admin';
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
  const [saved, setSaved] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);

  const total = Object.values(distribucion).reduce((s, v) => s + v, 0);

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
      const generated = await generateQuestions(
        extractedText,
        numPreguntas,
        dificultad,
        categoria,
        distribucion
      );
      setQuestions(generated);
      // pre-select all
      setSelected(new Set(generated.map((q) => q.id)));
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error al generar preguntas: ' + (error as Error).message);
    }
    
    setGenerating(false);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function saveSelected() {
    if (selected.size === 0) {
      alert("Selecciona al menos una pregunta para guardar");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
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
      <div className="space-y-6">
        {/* Stepper */}
        <ol className="grid gap-3 sm:grid-cols-4">
          {[
            { n: 1, label: "Cargar Documento", done: !!file },
            { n: 2, label: "Extraer Contenido", done: !!extractedText },
            { n: 3, label: "Configurar y Generar", done: questions.length > 0 },
            { n: 4, label: "Revisar y Guardar", done: saved },
          ].map((s) => (
            <li
              key={s.n}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                s.done ? "border-accent/40 bg-accent/5" : "border-border bg-card"
              }`}
            >
              <div
                className={`grid size-7 place-items-center rounded-full font-mono text-xs font-bold ${
                  s.done ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {s.done ? <Check className="size-4" /> : s.n}
              </div>
              <span className="text-sm font-medium">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT: Upload + Extraction + Config */}
          <div className="space-y-6 lg:col-span-2">
            {/* 1. Upload */}
            <Card title="1. Cargar Documento" subtitle="Sube PDF, DOCX o TXT para extraer contenido">
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="grid size-10 place-items-center rounded-md bg-accent/10 text-accent">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · listo para extracción
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setExtractedText("");
                    }}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary/50">
                  <Upload className="mb-2 size-5" />
                  <span className="text-sm font-medium">Arrastra tu archivo aquí o haz clic</span>
                  <span className="mt-1 text-[10px]">PDF, DOCX, TXT (máx. 10MB)</span>
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              <Button onClick={extractText} disabled={!file || extracting} className="mt-4 w-full">
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
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${extractionProgress}%` }}
                  />
                </div>
              )}

              {extractedText && !extracting && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    {showExtractedText ? (
                      <>
                        <EyeOff className="size-4" />
                        Ocultar texto extraído ({extractedText.length} chars)
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" />
                        Ver texto extraído ({extractedText.length} chars)
                      </>
                    )}
                  </button>
                  
                  {showExtractedText && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-4 transition-all duration-300 ease-in-out">
                      <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                        {extractedText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 2. Configuration */}
            <Card
              title="2. Configuración de Preguntas"
              subtitle="Define los parámetros de generación"
              disabled={!extractedText}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Número de Preguntas">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numPreguntas}
                    onChange={(e) => setNumPreguntas(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Dificultad">
                  <select
                    value={dificultad}
                    onChange={(e) => setDificultad(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </Field>
                <Field label="Categoría">
                  <input
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ej: Matemáticas, Historia…"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Tiempo Límite (min)">
                  <input
                    type="number"
                    min={1}
                    value={tiempoLimite}
                    onChange={(e) => setTiempoLimite(parseInt(e.target.value) || 1)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Distribución por Tipo
                  </label>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                      total === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    Total: {total}%
                  </span>
                </div>
                {(Object.keys(distribucion) as QuestionType[]).map((tipo) => (
                  <div key={tipo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{TYPE_LABELS[tipo]}</span>
                      <span className="font-mono text-muted-foreground">{distribucion[tipo]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={distribucion[tipo]}
                      onChange={(e) => updateDistribucion(tipo, parseInt(e.target.value))}
                      className="w-full accent-accent"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={generate}
                disabled={!extractedText || generating || total !== 100}
                size="lg"
                className="mt-6 w-full"
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

          {/* RIGHT: Pipeline */}
          <div className="space-y-6">
            <div className="rounded-xl bg-primary p-6 text-primary-foreground">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">
                Flujo de Extracción
              </div>
              <ol className="mt-4 space-y-3 text-xs">
                {[
                  "Cargar documento",
                  "Extracción de texto con IA",
                  "Configurar parámetros",
                  "Generar preguntas",
                  "Revisar y seleccionar",
                  "Guardar en Banco de Preguntas",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <div className="grid size-5 shrink-0 place-items-center rounded-full border border-primary-foreground/20 font-mono text-[9px]">
                      {i + 1}
                    </div>
                    <span className="text-primary-foreground/80">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-bold">Recomendaciones</h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li>· Los archivos PDF y DOCX se procesan directamente para extraer texto.</li>
                <li>· Las imágenes (.jpg, .png) se procesan con IA de visión de OpenAI.</li>
                <li>· Los archivos de texto (.txt) se leen directamente sin procesamiento adicional.</li>
                <li>
                  · Personaliza los prompts en{" "}
                  <Link to="/settings" className="text-foreground hover:underline">
                    Configuración de Prompts
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3. Review & Save */}
        {questions.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 p-5">
              <div>
                <h2 className="font-bold">3. Revisar y Seleccionar Preguntas</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Marca las preguntas que quieras conservar y guárdalas en el banco.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-accent">
                  {selected.size} de {questions.length} seleccionadas
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      selected.size === questions.length ? new Set() : new Set(questions.map((q) => q.id)),
                    )
                  }
                >
                  {selected.size === questions.length ? "Deseleccionar todas" : "Seleccionar todas"}
                </Button>
                <Button onClick={saveSelected} disabled={saving || selected.size === 0}>
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
                      <Save className="size-4" /> Guardar Seleccionadas
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {questions.map((q, idx) => {
                const isSel = selected.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={`flex gap-4 p-5 transition-colors ${
                      isSel ? "bg-accent/5" : "hover:bg-secondary/30"
                    }`}
                  >
                    <button
                      onClick={() => toggle(q.id)}
                      className="mt-1 shrink-0 text-accent"
                      aria-label="Seleccionar pregunta"
                    >
                      {isSel ? (
                        <CheckSquare className="size-5" />
                      ) : (
                        <Square className="size-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {TYPE_LABELS[q.tipo]}
                        </span>
                        <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                          {q.dificultad}
                        </span>
                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {q.categoria}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{q.pregunta}</p>
                      {q.contexto && (
                        <p className="rounded-md border-l-2 border-accent/50 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          <strong className="text-foreground">Contexto:</strong> {q.contexto}
                        </p>
                      )}
                      <ul className="space-y-1.5">
                        {q.opciones.map((opt, i) => {
                          const correct = q.respuesta_correcta.includes(i);
                          return (
                            <li
                              key={i}
                              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                                correct
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-border bg-background text-muted-foreground"
                              }`}
                            >
                              <span className="grid size-5 shrink-0 place-items-center rounded-sm font-mono text-[10px] font-bold">
                                {String.fromCharCode(65 + i)}
                              </span>
                              {opt}
                              {correct && <Check className="ml-auto size-3.5" />}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="rounded-md border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Justificación:</strong> {q.justificacion}
                      </p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
