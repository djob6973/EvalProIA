import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración de Prompts — EvalPro" }] }),
  component: SettingsPage,
});

const defaultPrompt = `Eres un experto diseñador de evaluaciones. Extrae preguntas estructuradas del documento proporcionado.

- Mantén precisión pedagógica.
- Calibra la dificultad al nivel solicitado.
- Genera JSON válido: { questions: [...] }
- Cada pregunta debe incluir: pregunta, tipo, opciones, respuesta_correcta, justificación.`;

function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const navigate = useNavigate();

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  return (
    <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Configuración de Prompts" }]}>
      <div className="grid gap-6 lg:grid-cols-3">
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
                defaultValue={defaultPrompt}
                rows={14}
                className="w-full rounded-md border border-input bg-secondary/30 p-4 font-mono text-xs leading-relaxed"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost">Restablecer</Button>
                <Button>Guardar Prompt</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-bold">Configuración del Modelo</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row k="Modelo" v="gpt-4o-mini" />
              <Row k="Temperatura" v="0.3" />
              <Row k="Tokens Máx." v="4096" />
              <Row k="Reintentos" v="3" />
            </div>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-xs font-medium">{v}</span>
    </div>
  );
}
