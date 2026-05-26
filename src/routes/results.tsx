import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { resultsService, evaluationsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "Resultados Globales — EvalPro" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<Array<{ range: string; count: number }>>([]);
  const [topPerformers, setTopPerformers] = useState<Array<{ name: string; score: number; eval: string }>>([]);
  const [stats, setStats] = useState({ totalSessions: 0, passRate: 0, avgDuration: 0, bestScore: 0 });

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  // Cargar resultados desde Supabase
  useEffect(() => {
    async function loadResults() {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const allResults = await resultsService.getAll();
        
        // Calcular distribución de puntajes
        const ranges = [
          { range: "0-20", min: 0, max: 20 },
          { range: "21-40", min: 21, max: 40 },
          { range: "41-60", min: 41, max: 60 },
          { range: "61-80", min: 61, max: 80 },
          { range: "81-100", min: 81, max: 100 },
        ];
        
        const distributionData = ranges.map(r => ({
          range: r.range,
          count: allResults.filter((res: any) => res.score >= r.min && res.score <= r.max).length
        }));
        
        setDistribution(distributionData);
        
        // Calcular mejores participantes
        const sortedResults = [...allResults].sort((a: any, b: any) => b.score - a.score).slice(0, 4);
        const topData = sortedResults.map((res: any) => {
          return {
            name: res.profiles?.full_name || res.profiles?.email || 'Usuario',
            score: res.score,
            eval: res.evaluations?.title || 'Evaluación'
          };
        });
        
        setTopPerformers(topData);
        
        // Calcular estadísticas generales
        const totalSessions = allResults.length;
        const passRate = totalSessions > 0 
          ? Math.round((allResults.filter((r: any) => r.score >= 60).length / totalSessions) * 100)
          : 0;
        const bestScore = totalSessions > 0 
          ? Math.max(...allResults.map((r: any) => r.score))
          : 0;
        
        // Calcular duración promedio en minutos
        const durations = allResults
          .filter((r: any) => r.started_at && r.completed_at)
          .map((r: any) => {
            const start = new Date(r.started_at).getTime();
            const end = new Date(r.completed_at).getTime();
            const durationMs = end - start;
            return durationMs / (1000 * 60); // Convertir a minutos
          });
        
        const avgDuration = durations.length > 0
          ? Math.round(durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length)
          : 0;
        
        setStats({
          totalSessions,
          passRate,
          avgDuration,
          bestScore
        });
        
      } catch (err) {
        console.error('Error loading results:', err);
        setError('Error al cargar los resultados');
        // Usar datos de ejemplo si falla la carga
        setDistribution([
          { range: "0-20", count: 4 },
          { range: "21-40", count: 12 },
          { range: "41-60", count: 38 },
          { range: "61-80", count: 84 },
          { range: "81-100", count: 47 },
        ]);
        setTopPerformers([
          { name: "Sara Jenkins", score: 96, eval: "Ingeniería Frontend Nivel 3" },
          { name: "Marcus Anderson", score: 94, eval: "Arquitectura Cloud" },
          { name: "Elara Vance", score: 91, eval: "Seguridad y Cumplimiento" },
          { name: "Diego Vargas", score: 89, eval: "Gestión de Producto" },
        ]);
        setStats({ totalSessions: 1409, passRate: 76.2, avgDuration: 0, bestScore: 98 });
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [isAdmin]);

  const max = distribution.length > 0 ? Math.max(...distribution.map((d) => d.count)) : 0;

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Resultados Globales" }]}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando resultados...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Resultados Globales" }]}>
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
    <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Resultados Globales" }]}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { l: "Sesiones Totales", v: String(stats.totalSessions) },
            { l: "Tasa de Aprobación", v: `${stats.passRate}%` },
            { l: "Duración Promedio", v: stats.avgDuration > 0 ? `${stats.avgDuration}m` : "N/A" },
            { l: "Mejor Puntaje", v: `${stats.bestScore}/100` },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {k.l}
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{k.v}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <h2 className="font-bold">Distribución de Puntajes</h2>
            <p className="mt-1 text-xs text-muted-foreground">A lo largo de las últimas {stats.totalSessions} sesiones completadas.</p>
            <div className="mt-6 flex h-56 items-end gap-4">
              {distribution.map((d) => (
                <div key={d.range} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-accent/20 transition-all hover:bg-accent/40"
                      style={{ height: `${(d.count / max) * 100}%` }}
                    >
                      <div className="h-full w-full rounded-t border-t-2 border-accent" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">{d.range}</div>
                  <div className="font-mono text-xs font-bold">{d.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-bold">Mejores Participantes</h2>
            <ul className="mt-4 space-y-3">
              {topPerformers.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <div className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                    {i < 3 ? '👑' : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.eval}</div>
                  </div>
                  <div className="font-mono text-sm font-bold text-accent">{p.score}%</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
