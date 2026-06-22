import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useSystemSettings, invalidateSystemSettings } from "@/hooks/useSystemSettings";
import { Upload, X, ImageIcon } from "lucide-react";

export const PROMPT_STORAGE_KEY = "evalpro_system_prompt";
export const PROMPT_VERSION_KEY = "evalpro_prompt_version";
export const PROMPT_VERSION = "2";
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
  maxTokens: 8192,
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

export function getSystemPrompt(): string {
  if (typeof window === "undefined") return defaultPrompt;
  const storedVersion = localStorage.getItem(PROMPT_VERSION_KEY);
  if (storedVersion !== PROMPT_VERSION) {
    localStorage.setItem(PROMPT_STORAGE_KEY, defaultPrompt);
    localStorage.setItem(PROMPT_VERSION_KEY, PROMPT_VERSION);
    return defaultPrompt;
  }
  return localStorage.getItem(PROMPT_STORAGE_KEY) ?? defaultPrompt;
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
- Incluir un contexto breve y neutral relacionado con el tema evaluado.
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
  "según la guía", "según el manual","segun el texto" o frases similares.
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

REGLAS PARA PREGUNTAS BASADAS EN PASOS O SECUENCIAS
Cuando el contenido describa procedimientos o secuencias operativas:
* Las preguntas deben indicar claramente qué se desea evaluar: primer paso, último paso, acción obligatoria, validación, orden correcto, objetivo del proceso, acción incorrecta, requisito previo.
* No mezclar múltiples pasos correctos en preguntas de selección única.
* Si varias opciones pertenecen al mismo procedimiento, la pregunta debe especificar el criterio exacto:
  * "¿Cuál es el primer paso...?"
  * "¿Qué acción se realiza antes de guardar...?"
  * "¿Cuál es una validación obligatoria...?"
  * "¿Qué acción NO hace parte del proceso...?"
* En preguntas de selección múltiple: indicar explícitamente que existen varias respuestas correctas, incluir únicamente combinaciones válidas, evitar listas incompletas o ambiguas.
* Mantener coherencia exacta con el orden y contenido del procedimiento original.

# REGLA CRÍTICA DEL CAMPO CONTEXTO
El campo "contexto" NO debe describir, explicar, resumir ni desarrollar el contenido específico evaluado en la pregunta.
Su función es únicamente indicar el tema general al que pertenece la pregunta.

## Regla principal
Si el contexto puede utilizarse para inferir si una afirmación es verdadera o falsa, identificar la opción correcta o descartar opciones incorrectas, entonces el contexto es inválido.

## Nivel de detalle permitido
El contexto debe permanecer un nivel de abstracción por encima de la pregunta.

Correcto — tema general:
* "Importaciones."
* "Proceso de importación."
* "Capacitación sobre importaciones."
* "Gestión de operaciones de comercio exterior."

Incorrecto — información específica evaluada:
* "La capacitación busca reducir errores."
* "El proceso permite validar documentos."
* "La recepción electrónica requiere aceptación."
* "Las novedades salariales afectan la liquidación."

## Restricciones adicionales
El contexto NO puede:
* Contener objetivos, beneficios o finalidades.
* Contener ventajas o desventajas.
* Contener definiciones completas.
* Contener reglas de negocio.
* Contener condiciones de uso.
* Contener criterios de validación.
* Contener consecuencias de una acción.
* Contener características distintivas del concepto evaluado.
* Contener información que permita confirmar o negar el enunciado.

## Formato recomendado
Preferir contextos extremadamente breves:
* Nombre del módulo.
* Nombre del proceso.
* Nombre del tema.
* Nombre de la funcionalidad.

Ejemplos válidos:
* "Importaciones."
* "Capacitación en importaciones."
* "Gestión documental."
* "Facturación electrónica."
* "Nómina."

## Validación obligatoria
Antes de generar el contexto, responder:
1. ¿El contexto ayuda a responder la pregunta? → Si sí, eliminar información.
2. ¿El contexto permite deducir la respuesta correcta? → Si sí, reescribir.
3. ¿El contexto podría mostrarse para cualquier pregunta del mismo tema sin necesidad de cambios? → Si no, es demasiado específico.
4. ¿El contexto es simplemente el nombre del tema o una descripción general del área? → Si no, simplificar.

REGLAS DE JUSTIFICACIÓN
La justificación debe:
* explicar por qué la respuesta es correcta,
* aclarar por qué las demás opciones son incorrectas cuando sea necesario,
* resumir el procedimiento o concepto correspondiente,
* ampliar el aprendizaje después de responder.
La justificación puede ser más detallada que el contexto e incluir pasos, condiciones y explicaciones operativas.

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
  const { settings } = useSystemSettings();

  // ── Prompt state ──────────────────────────────────────────────────────────
  const [persistedPrompt, setPersistedPrompt] = useState<string>(getSystemPrompt);
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

  // ── Brand logo state ──────────────────────────────────────────────────────
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const [showLogoDeleteConfirm, setShowLogoDeleteConfirm] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentLogo = settings.brand_logo ?? null;

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoSuccess(false);

    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type))
      return setLogoError("Solo se aceptan imágenes PNG, JPG, SVG o WebP.");

    if (file.size > 1_000_000)
      return setLogoError("La imagen no debe superar 1 MB.");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);

    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function saveLogo() {
    if (!logoPreview) return;
    setLogoSaving(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: logoPreview }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      invalidateSystemSettings();
      setLogoSuccess(true);
      setLogoPreview(null);
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setLogoSaving(false);
    }
  }

  async function deleteLogo() {
    setLogoSaving(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      invalidateSystemSettings();
      setLogoPreview(null);
      setShowLogoDeleteConfirm(false);
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setLogoSaving(false);
    }
  }

  useEffect(() => {
    if (profile && !isAdmin) navigate({ to: "/account" });
  }, [profile, isAdmin, navigate]);

  // ── Change own password state ─────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handleChangeOwnPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) { setPasswordError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError("Las contraseñas no coinciden"); return; }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/change-own-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar contraseña');
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Error al cambiar contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  }

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
      {/* ── Brand logo ────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h2 className="font-bold">Logo de la Organización</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Se mostrará en el sidebar junto al logo del sistema. Formatos: PNG, JPG, SVG, WebP. Máx. 1 MB.
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start gap-6">
            {/* Vista previa actual / nueva */}
            <div className="flex flex-col gap-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {logoPreview ? "Vista previa" : currentLogo ? "Logo actual" : "Sin logo"}
              </div>
              <div className="flex h-24 w-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30">
                {logoPreview || currentLogo ? (
                  <img
                    src={logoPreview ?? currentLogo!}
                    alt="Logo organización"
                    className="max-h-20 max-w-44 object-contain"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-3 pt-1">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoFile}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoSaving}
              >
                <Upload className="mr-2 size-4" strokeWidth={1.5} />
                {currentLogo || logoPreview ? "Cambiar logo" : "Subir logo"}
              </Button>

              {logoPreview && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveLogo} disabled={logoSaving}>
                    {logoSaving ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setLogoPreview(null); setLogoError(null); }}
                    disabled={logoSaving}
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </Button>
                </div>
              )}

              {currentLogo && !logoPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowLogoDeleteConfirm(true)}
                  disabled={logoSaving}
                >
                  Eliminar logo
                </Button>
              )}

              {logoError && (
                <p className="text-xs text-destructive">{logoError}</p>
              )}
              {logoSuccess && !logoPreview && (
                <p className="text-xs text-emerald-600">Logo guardado correctamente.</p>
              )}
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={showLogoDeleteConfirm}
          title="¿Eliminar logo de la organización?"
          description="Se eliminará el logo de marca del sistema. El logo de EvalPro permanecerá intacto."
          confirmLabel="Eliminar"
          onConfirm={deleteLogo}
          onCancel={() => setShowLogoDeleteConfirm(false)}
        />
      </div>

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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tokens Máx.
                  </label>
                  <span className="font-mono text-xs font-semibold">{config.maxTokens.toLocaleString()}</span>
                </div>
                <input
                  type="number"
                  min="1024"
                  max="128000"
                  step="512"
                  value={config.maxTokens}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1024) setField("maxTokens", val);
                  }}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-mono"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {TOKEN_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField("maxTokens", t)}
                      className={`rounded px-2 py-0.5 text-[10px] font-mono transition-colors ${
                        config.maxTokens === t
                          ? "text-white"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                      style={config.maxTokens === t ? { background: "#333333" } : undefined}
                    >
                      {t >= 1000 ? `${t / 1000}k` : t}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Mín. 1 024</span>
                  <span>Máx. 128 000</span>
                </div>
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

          <div className="rounded-xl p-6" style={{ background: "#333333", color: "#F1F1F1" }}>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(241,241,241,0.5)" }}>
              Estrategia Actual
            </div>
            <h3 className="mt-2 font-bold">Extracción Semántica v4</h3>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(241,241,241,0.7)" }}>
              La calidad subió <strong className="text-emerald-400">+14%</strong> desde la última
              revisión del prompt. Mantén el foco en la fidelidad del esquema.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
