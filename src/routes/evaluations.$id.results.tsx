import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { resultsService, evaluationsService } from "@/lib/services/evaluations";
import { ArrowLeft, TrendingUp, Users, Award } from "lucide-react";

export const Route = createFileRoute("/evaluations/$id/results")({
  head: () => ({ meta: [{ title: "Resultados de Evaluación — EvalPro" }] }),
  component: EvaluationResultsPage,
});

function EvaluationResultsPage() {
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalParticipants: 0, averageScore: 0, passRate: 0, bestScore: 0 });

  useEffect(() => {
    async function loadData() {
      // Wait for profile to resolve before acting
      if (!profile) return;

      if (!isAdmin) {
        navigate({ to: "/participant" });
        return;
      }

      if (!id) return;

      try {
        setLoading(true);
        
        // Cargar evaluación
        const evalData = await evaluationsService.getById(id);
        setEvaluation(evalData);
        
        // Cargar resultados de esta evaluación
        const resultsData = await resultsService.getByEvaluationId(id);
        setResults(resultsData);
        
        // Calcular estadísticas
        const totalParticipants = resultsData.length;
        const averageScore = totalParticipants > 0
          ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / totalParticipants)
          : 0;
        const passingThreshold = evalData?.config?.porcentaje_aprobacion ?? 60;
        const passRate = totalParticipants > 0
          ? Math.round((resultsData.filter((r) => r.score >= passingThreshold).length / totalParticipants) * 100)
          : 0;
        const bestScore = totalParticipants > 0
          ? Math.max(...resultsData.map((r) => r.score))
          : 0;
        
        setStats({ totalParticipants, averageScore, passRate, bestScore });
        
      } catch (err) {
        console.error('Error loading evaluation results:', err);
        setError('Error al cargar los resultados de la evaluación');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile, isAdmin, id, navigate]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Resultados" />
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
      <AppShell>
        <PageHeader title="Resultados" />
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
    <AppShell>
      <PageHeader
        title="Resultados"
        actions={
          <Button asChild variant="outline">
            <Link to="/evaluations">
              <ArrowLeft className="size-4" /> Volver a Evaluaciones
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{evaluation?.title || 'Evaluación'}</h1>
          {evaluation?.description && (
            <p className="mt-2 text-sm text-muted-foreground">{evaluation.description}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="size-4" />
              Participantes
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.totalParticipants}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-4" />
              Promedio
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.averageScore}%</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4" />
              Tasa Aprobación
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.passRate}%</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4" />
              Mejor Puntaje
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.bestScore}%</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <h2 className="font-bold">Resultados por Participante</h2>
            <p className="mt-1 text-xs text-muted-foreground">Detalles de cada intento de evaluación</p>
          </div>
          <div className="p-6">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hay resultados registrados para esta evaluación</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-bold">Participante</th>
                    <th className="px-6 py-3 font-bold">Email</th>
                    <th className="px-6 py-3 font-bold">Puntaje</th>
                    <th className="px-6 py-3 font-bold">Estado</th>
                    <th className="px-6 py-3 font-bold">Fecha</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {results.map((result: any) => (
                    <tr key={result.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                      <td className="px-6 py-4 font-medium">
                        {result.profiles?.full_name || 'Sin nombre'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {result.profiles?.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-accent">
                        {result.score}%
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-bold ${
                            result.score >= (evaluation?.config?.porcentaje_aprobacion ?? 60)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.score >= (evaluation?.config?.porcentaje_aprobacion ?? 60) ? "APROBADO" : "REPROBADO"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(result.completed_at).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
