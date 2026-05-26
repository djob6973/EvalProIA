import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, FileQuestion, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { evaluationsService, questionsService, resultsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/participant")({
  head: () => ({ meta: [{ title: "Mis Evaluaciones — EvalPro" }] }),
  component: ParticipantHome,
});

function ParticipantHome() {
  const { profile, loading } = useAuth();
  const userName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Usuario';
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) return;
      
      try {
        setLoadingData(true);
        
        // Fetch all active evaluations
        const allEvaluations = await evaluationsService.getAll();
        const activeEvaluations = allEvaluations.filter((ev: any) => ev.activa !== false);
        
        // For each evaluation, get the question count
        const evaluationsWithQuestions = await Promise.all(
          activeEvaluations.map(async (ev: any) => {
            const questions = await questionsService.getByEvaluationId(ev.id);
            console.log('Evaluation:', ev.id, 'Questions count:', questions.length);
            return {
              ...ev,
              questionCount: questions.length,
              code: ev.id.slice(0, 6).toUpperCase(), // Generate a short code from ID
              locked: false
            };
          })
        );
        
        setEvaluations(evaluationsWithQuestions);
        
        // Fetch user's results
        const results = await resultsService.getByUserId(profile.id);
        setUserResults(results);
        
      } catch (err) {
        console.error('Error loading participant data:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [profile?.id]);

  // Filter out evaluations the user has already completed
  const completedEvaluationIds = new Set(userResults.map((r: any) => r.evaluation_id));
  const availableEvaluations = evaluations.filter((ev) => !completedEvaluationIds.has(ev.id));
  const completedEvaluations = evaluations.filter((ev) => completedEvaluationIds.has(ev.id));

  if (loading || loadingData) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mis Evaluaciones" }]}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando evaluaciones...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mis Evaluaciones" }]}>
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
    <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mis Evaluaciones" }]}>
      <div className="space-y-8">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Bienvenido de vuelta
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Hola, {userName}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tienes <span className="font-medium text-foreground">{availableEvaluations.length} evaluaciones activas</span> disponibles.
            {completedEvaluations.length > 0 && ` Has completado ${completedEvaluations.length} evaluación${completedEvaluations.length !== 1 ? 'es' : ''}.`}
          </p>
        </div>

        {availableEvaluations.length > 0 && (
          <div>
            <h2 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Evaluaciones Disponibles
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableEvaluations.map((e) => (
                <div
                  key={e.id}
                  className={`flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                    e.locked ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {e.code}
                    </span>
                    {e.locked && <Lock className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold leading-tight">{e.title}</h3>
                    {e.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileQuestion className="size-3.5" /> {e.questionCount} P
                      </span>
                      {e.tiempo_limite > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {e.tiempo_limite}m
                        </span>
                      )}
                    </div>
                  </div>
                  {e.locked ? (
                    <div className="rounded-md bg-secondary px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      {e.lockMsg}
                    </div>
                  ) : (
                    <Button asChild className="w-full" onClick={() => console.log('Navigating to evaluation:', e.id)}>
                      <Link to="/take/$code" params={{ code: e.id }}>
                        Comenzar <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {completedEvaluations.length > 0 && (
          <div>
            <h2 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Evaluaciones Completadas
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedEvaluations.map((e) => {
                const result = userResults.find((r: any) => r.evaluation_id === e.id);
                return (
                  <div
                    key={e.id}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                        {e.code}
                      </span>
                      <span className="font-mono text-sm font-bold text-accent">
                        {result?.score}%
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold leading-tight">{e.title}</h3>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3.5" /> {e.questionCount} P
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {new Date(result?.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/my-results/$id" params={{ id: result?.id }}>
                        Ver Resultados
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {availableEvaluations.length === 0 && completedEvaluations.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileQuestion className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No hay evaluaciones disponibles en este momento.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
