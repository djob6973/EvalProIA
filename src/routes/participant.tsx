import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, FileQuestion, Lock, Calendar, CalendarX, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { evaluationsService, resultsService, evaluationParticipantsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/participant")({
  head: () => ({ meta: [{ title: "Mis Evaluaciones — EvalPro" }] }),
  component: ParticipantHome,
});

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

        const [allEvaluations, results, directIds] = await Promise.all([
          evaluationsService.getAll(),
          resultsService.getByUserId(profile.id),
          evaluationParticipantsService.getByUserId(profile.id).catch(() => [] as string[]),
        ]);

        setUserResults(results);

        const directSet = new Set(directIds);
        const now = new Date();
        const userAreaId = profile.area_id ?? null;

        const activeEvaluations = allEvaluations.filter((ev: any) => {
          if (ev.activa === false) return false;
          if (ev.fecha_vencimiento && new Date(ev.fecha_vencimiento) < now) return false;
          // Asignación directa siempre visible
          if (directSet.has(ev.id)) return true;
          // Sin área = no visible (requiere asignación directa)
          if (!ev.area_id) return false;
          // Área diferente = no visible
          if (ev.area_id !== userAreaId) return false;
          return true;
        });

        const evaluationsWithQuestions = activeEvaluations.map((ev: any) => ({
          ...ev,
          questionCount: ev.config?.num_preguntas || 0,
          code: ev.id.slice(0, 6).toUpperCase(),
          locked: false,
        }));

        setEvaluations(evaluationsWithQuestions);

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
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileQuestion className="size-3.5" /> {e.questionCount} preguntas
                      </span>
                      {e.tiempo_limite > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {e.tiempo_limite} min
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {e.created_at && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="size-3 shrink-0" />
                          <span>Creada: {formatDateTime(e.created_at)}</span>
                        </div>
                      )}
                      {e.fecha_vencimiento && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <CalendarX className="size-3 shrink-0" />
                          <span>Vence: {formatDateTime(e.fecha_vencimiento)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {e.locked ? (
                    <div className="rounded-md bg-secondary px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                      {e.lockMsg}
                    </div>
                  ) : (
                    <Button asChild className="w-full">
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
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3.5" /> {e.questionCount} preguntas
                        </span>
                      </div>
                      {result?.completed_at && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CheckCircle className="size-3 shrink-0 text-emerald-600" />
                          <span>Presentada: {formatDateTime(result.completed_at)}</span>
                        </div>
                      )}
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
