import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { statsService } from "@/lib/services/stats";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — EvalPro" },
      { name: "description", content: "Resumen de evaluaciones, participantes y preguntas generadas por IA." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  // Cargar datos del dashboard
  useEffect(() => {
    async function loadStats() {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const data = await statsService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
        setError('Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [isAdmin]);

  // KPIs calculados desde datos reales
  const kpis = stats ? [
    { label: "Total Evaluaciones", value: String(stats.totalEvaluations), delta: "Evaluaciones creadas", positive: null },
    { label: "Participantes", value: String(stats.totalParticipants), delta: "Usuarios registrados", positive: null },
    { label: "Puntaje Promedio", value: `${stats.averageScore}/100`, delta: "Rendimiento global", positive: null },
    { label: "Preguntas Totales", value: String(stats.totalQuestions), delta: "Generadas por IA", positive: null },
  ] : [];

  // Evaluaciones recientes desde datos reales
  const evaluations = stats?.recentEvaluations?.slice(0, 4).map((ev: any) => ({
    name: ev.title,
    participants: ev.participants,
    status: "live" as const,
    score: ev.averageScore > 0 ? `${ev.averageScore}%` : "--"
  })) || [];

  // Actividad reciente desde datos reales
  const activity = stats?.recentActivity?.slice(0, 4).map((act: any) => ({
    live: act.type === 'result',
    text: act.text,
    meta: act.meta
  })) || [];

  if (loading) {
    return (
      <AppShell
        breadcrumb={[{ label: "Sistema" }, { label: "Resumen del Panel" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando datos del dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        breadcrumb={[{ label: "Sistema" }, { label: "Resumen del Panel" }]}
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
      breadcrumb={[{ label: "Sistema" }, { label: "Resumen del Panel" }]}
      actions={
        <Button asChild>
          <Link to="/generate">
            <Sparkles className="size-4" /> Nueva Evaluación
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k: any) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tracking-tight">{k.value}</div>
              <div
                className={`mt-2 text-xs font-medium ${
                  k.positive ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {k.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-secondary/50 p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-4 text-accent" />
                  <h2 className="font-bold">Generador Inteligente de Preguntas</h2>
                </div>
                <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent">
                  Impulsado por GPT-4
                </span>
              </div>
              <div className="p-6">
                <Link
                  to="/generate"
                  className="flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary/50"
                >
                  <span className="text-sm font-medium">Arrastra documentación aquí para extraer preguntas</span>
                  <span className="mt-1 text-[10px]">Acepta PDF, DOCX, TXT — procesado por IA</span>
                </Link>
                <div className="mt-4 flex justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/generate">
                      Abrir generador <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border p-6">
                <h2 className="font-bold">Evaluaciones Recientes</h2>
                <Link to="/evaluations" className="text-xs font-medium text-accent hover:underline">
                  Ver todas
                </Link>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-bold">Nombre</th>
                    <th className="px-6 py-3 font-bold">Participantes</th>
                    <th className="px-6 py-3 font-bold">Estado</th>
                    <th className="px-6 py-3 font-bold text-right">Promedio</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {evaluations.map((e: any) => (
                    <tr key={e.name} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                      <td className="px-6 py-4 font-medium">{e.name}</td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {String(e.participants).padStart(2, "0")}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-accent">{e.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4 rounded-xl bg-primary p-6 text-primary-foreground">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">
                Actividad en Tiempo Real
              </div>
              <div className="space-y-4">
                {activity.map((a: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        a.live ? "bg-emerald-500" : "bg-primary-foreground/30"
                      } ${a.live ? "animate-pulse" : ""}`}
                    />
                    <div>
                      <div className="text-xs font-medium">{a.text}</div>
                      <div className="mt-0.5 text-[10px] text-primary-foreground/50">{a.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button asChild variant="ghost" className="mt-2 w-full rounded border border-primary-foreground/15 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-primary-foreground/5">
                <Link to="/activity">
                  Ver Registro Completo
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="size-4 text-accent" />
                <h3 className="font-bold">Estrategia de Prompt</h3>
              </div>
              <div className="mb-4 grid aspect-video place-items-center rounded-lg bg-secondary">
                <svg viewBox="0 0 200 80" className="h-full w-full p-4 text-accent">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    points="0,60 30,55 60,40 90,42 120,28 150,22 180,18 200,12"
                  />
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                    points="0,65 30,62 60,58 90,55 120,50 150,46 180,42 200,38"
                  />
                </svg>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                El modelo actual utiliza <strong className="text-foreground">Extracción Semántica v4</strong>.
                La calidad de evaluación ha aumentado un 14% desde el último ajuste de prompt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
