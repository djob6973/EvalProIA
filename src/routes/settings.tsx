import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export const PROMPT_STORAGE_KEY = "evalpro_system_prompt";
export const MODEL_CONFIG_KEY = "evalpro_model_config";

export type ModelConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
  retries: number;
};

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 4096,
  retries: 3,
};

export function getModelConfig(): ModelConfig {
  if (typeof window === "undefined") return DEFAULT_MODEL_CONFIG;
  try {
    const stored = localStorage.getItem(MODEL_CONFIG_KEY);
    return stored ? { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(stored) } : DEFAULT_MODEL_CONFIG;
  } catch {
    return DEFAULT_MODEL_CONFIG;
  }
}

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — EvalPro" }] }),
  component: SettingsPage,
});

const defaultPrompt = `ROL DEL MODELO
Actúas como un experto en diseño instruccional, evaluación del aprendizaje y generación de preguntas para exámenes, quizzes interactivos (tipo Kahoot), evaluaciones internas y entrenamientos corporativos.

CONTEXTO DE ENTRADA
Recibirás un documento (texto, guía, manual, política, material de capacitación o contenido técnico) junto con los parámetros de generación: cantidad de preguntas, nivel de dificultad, categoría temática y distribución por tipo de pregunta.
Debes basarte EXCLUSIVAMENTE en la información contenida en el documento.
No utilices conocimientos externos ni hagas suposiciones.

REQUISITOS DE CADA PREGUNTA
- Incluir un contexto claro relacionado con el contenido del documento.
- Evaluar información relevante y explícita.
- Estar redactada de forma clara, concreta y sin ambigüedades.
- No repetir conceptos ni reutilizar enunciados similares entre preguntas.
- Respetar el nivel de dificultad y la distribución por tipo indicados en los parámetros.
- Usar lenguaje adecuado para exámenes, entrenamientos internos o quizzes tipo Kahoot.

RESTRICCIONES OBLIGATORIAS
- No agregar información externa al documento.
- No modificar el significado del contenido original.
- No omitir respuestas ni justificaciones en ninguna pregunta.
- No utilizar expresiones meta-referenciales al material fuente como:
  "según el documento", "de acuerdo con el documento", "como se menciona en el texto",
  "según la guía", "según el manual" o frases similares.
- Las preguntas, opciones, respuestas y justificaciones deben redactarse como evaluaciones
  naturales y autónomas, sin referencia explícita al material entregado.
- Si el documento no contiene información suficiente para algún tipo de pregunta solicitado,
  indícalo al inicio de la respuesta, antes del JSON.

EXCEPCIÓN PERMITIDA
Se permite mencionar leyes, normas, políticas, resoluciones, estándares o marcos regulatorios
cuando hagan parte explícita del contenido evaluado.
Ejemplos válidos:
- "Según la Ley 1581..."
- "De acuerdo con la norma ISO 27001..."
- "Según la política de seguridad..."

CONSIDERACIONES PARA QUIZZES TIPO KAHOOT
- Redactar las preguntas de forma clara y directa, sin enunciados extensos.
- Priorizar conceptos clave, definiciones, procesos y reglas importantes.
- Las opciones incorrectas deben ser plausibles pero claramente distinguibles de la correcta.

FORMATO DE SALIDA
Responde únicamente con un JSON válido. No incluyas texto adicional fuera del objeto JSON.`;

const AVAILABLE_MODELS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini — Rápido y económico" },
  { value: "gpt-4o",      label: "gpt-4o — Máxima calidad" },
  { value: "gpt-4-turbo", label: "gpt-4-turbo — Alta capacidad" },
  { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo — Económico" },
];

const TOKEN_OPTIONS = [1024, 2048, 4096, 8192, 16384];

function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "both";
  const navigate = useNavigate();

  // ── Prompt state ──────────────────────────────────────────────────────────
  const [persistedPrompt, setPersistedPrompt] = useState<string>(() => {
    if (typeof window === "undefined") return defaultPrompt;
    return localStorage.getItem(PROMPT_STORAGE_KEY) ?? defaultPrompt;
  });
  const [promptValue, setPromptValue] = useState<string>(persistedPrompt);
  const [showPromptConfirm, setShowPromptConfirm] = useState(false);
  const isPromptDirty = promptValue !== persistedPrompt;

  // ── Model config state ────────────────────────────────────────────────────
  const [persistedConfig, setPersistedConfig] = useState<ModelConfig>(getModelConfig);
  const [config, setConfig] = useState<ModelConfig>(persistedConfig);
  const [showConfigConfirm, setShowConfigConfirm] = useState(false);
  const isConfigDirty =
    config.model !== persistedConfig.model ||
    config.temperature !== persistedConfig.temperature ||
    config.maxTokens !== persistedConfig.maxTokens ||
    config.retries !== persistedConfig.retries;

  useEffect(() => {
    if (profile && !isAdmin) navigate({ to: "/participant" });
  }, [profile, isAdmin, navigate]);

  // ── Prompt handlers ───────────────────────────────────────────────────────
  function savePrompt() {
    localStorage.setItem(PROMPT_STORAGE_KEY, promptValue);
    setPersistedPrompt(promptValue);
    setShowPromptConfirm(false);
  }

  function resetPrompt() {
    setPromptValue(defaultPrompt);
    setPersistedPrompt(defaultPrompt);
    localStorage.setItem(PROMPT_STORAGE_KEY, defaultPrompt);
  }

  // ── Model config handlers ─────────────────────────────────────────────────
  function saveConfig() {
    localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
    setPersistedConfig(config);
    setShowConfigConfirm(false);
  }

  function resetConfig() {
    setConfig(DEFAULT_MODEL_CONFIG);
    setPersistedConfig(DEFAULT_MODEL_CONFIG);
    localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(DEFAULT_MODEL_CONFIG));
  }

  function setField<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Configuración" }]}>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Prompt editor ─────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <h2 className="font-bold">Prompt de Extracción</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Este prompt se envía a OpenAI en cada extracción de documento. Edita con cuidado.
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                rows={14}
                className="w-full rounded-md border border-input bg-secondary/30 p-4 font-mono text-xs leading-relaxed"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={resetPrompt}>Restablecer</Button>
                {isPromptDirty && (
                  <Button onClick={() => setShowPromptConfirm(true)}>Guardar Prompt</Button>
                )}
              </div>
              <ConfirmDialog
                open={showPromptConfirm}
                title="¿Guardar prompt?"
                description="Se reemplazará el prompt actual con los cambios realizados. Esta acción afectará todas las generaciones futuras."
                confirmLabel="Guardar Prompt"
                onConfirm={savePrompt}
                onCancel={() => setShowPromptConfirm(false)}
              />
            </div>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Model config card */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-bold">Configuración del Modelo</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Parámetros usados al generar preguntas con IA.
              </p>
            </div>
            <div className="space-y-4 p-6">
              {/* Modelo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Modelo
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setField("model", e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Temperatura */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Temperatura
                  </label>
                  <span className="font-mono text-xs font-semibold">{config.temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setField("temperature", parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 — Determinista</span>
                  <span>2 — Creativo</span>
                </div>
              </div>

              {/* Tokens Máx. */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tokens Máx.
                </label>
                <select
                  value={config.maxTokens}
                  onChange={(e) => setField("maxTokens", parseInt(e.target.value))}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  {TOKEN_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t.toLocaleString()} tokens</option>
                  ))}
                </select>
              </div>

              {/* Reintentos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Reintentos
                  </label>
                  <span className="font-mono text-xs font-semibold">{config.retries}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.retries}
                  onChange={(e) => setField("retries", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" onClick={resetConfig}>
                  Restablecer
                </Button>
                {isConfigDirty && (
                  <Button size="sm" onClick={() => setShowConfigConfirm(true)}>
                    Guardar
                  </Button>
                )}
              </div>
            </div>

            <ConfirmDialog
              open={showConfigConfirm}
              title="¿Guardar configuración del modelo?"
              description={`Se usará "${config.model}" con temperatura ${config.temperature.toFixed(1)} y ${config.maxTokens.toLocaleString()} tokens en todas las generaciones futuras.`}
              confirmLabel="Guardar"
              onConfirm={saveConfig}
              onCancel={() => setShowConfigConfirm(false)}
            />
          </div>

          <div className="rounded-xl bg-primary p-6 text-primary-foreground">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">
              Estrategia Actual
            </div>
            <h3 className="mt-2 font-bold">Extracción Semántica v4</h3>
            <p className="mt-2 text-xs leading-relaxed text-primary-foreground/70">
              La calidad subió <strong className="text-emerald-400">+14%</strong> desde la última
              revisión del prompt. Mantén el foco en la fidelidad del esquema.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
