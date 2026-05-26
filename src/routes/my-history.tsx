import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { resultsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/my-history")({
  head: () => ({ meta: [{ title: "Mi Historial — EvalPro" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { profile } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      if (!profile?.id) return;
      
      try {
        setLoading(true);
        const data = await resultsService.getByUserId(profile.id);
        setResults(data);
      } catch (err) {
        console.error('Error loading results:', err);
        setError('Error al cargar el historial');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [profile?.id]);

  // Calculate KPIs from real data
  const completedCount = results.length;
  const scores = results.map((r) => r.score).filter((s) => s !== null);
  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) 
    : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const kpis = [
    { label: "Completadas", value: String(completedCount) },
    { label: "Puntaje Promedio", value: `${averageScore}%` },
    { label: "Mejor Puntaje", value: `${bestScore}%` },
  ];

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando historial...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
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
    <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {results.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No has completado ninguna evaluación todavía.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Evaluación</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Puntaje</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {results.map((result) => (
                  <tr key={result.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {new Date(result.completed_at).toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: 'short' 
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {result.evaluations?.title || 'Evaluación'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status="completed" />
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-accent">
                      {result.score}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
