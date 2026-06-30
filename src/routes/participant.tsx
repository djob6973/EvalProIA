import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, FileQuestion, Lock, Calendar, CalendarX, CheckCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { evaluationsService, resultsService, evaluationParticipantsService } from "@/lib/services/evaluations";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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

        // getActive() pre-filters activa=true and non-expired at DB level,
        // avoiding downloading the full evaluations list for every participant.
        const [allEvaluations, results, directIds] = await Promise.all([
          evaluationsService.getActive(),
          resultsService.getByUserId(profile.id),
          evaluationParticipantsService.getByUserId(profile.id).catch(() => [] as string[]),
        ]);

        setUserResults(results);

        const directSet = new Set(directIds);
        const userAreaId = profile.area_id ?? null;

        // activa and fecha_vencimiento already filtered by DB — only apply area/assignment logic
        const activeEvaluations = allEvaluations.filter((ev: any) => {
          if (directSet.has(ev.id)) return true;
          if (!ev.area_id) return false;
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
        setError(t('participant.loadError'));
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [profile?.id]);

  // Agrupar resultados por evaluación
  const resultCountByEval: Record<string, number> = {};
  const latestResultByEval: Record<string, any> = {};
  const bestResultByEval: Record<string, any> = {};
  userResults.forEach((r: any) => {
    resultCountByEval[r.evaluation_id] = (resultCountByEval[r.evaluation_id] || 0) + 1;
    const prev = latestResultByEval[r.evaluation_id];
    if (!prev || new Date(r.completed_at) > new Date(prev.completed_at)) {
      latestResultByEval[r.evaluation_id] = r;
    }
    const best = bestResultByEval[r.evaluation_id];
    if (!best || r.score > best.score) {
      bestResultByEval[r.evaluation_id] = r;
    }
  });

  // Disponibles: aún tienen intentos restantes
  const availableEvaluations = evaluations.filter((ev) => {
    const count = resultCountByEval[ev.id] || 0;
    return count < (ev.intentos_permitidos ?? 1);
  });

  // Completadas: se agotaron todos los intentos
  const completedEvaluations = evaluations.filter((ev) => {
    const count = resultCountByEval[ev.id] || 0;
    return count >= (ev.intentos_permitidos ?? 1);
  });

  if (loading || loadingData) {
    return (
      <AppShell>
        <PageHeader title={t('participant.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div
              className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{t('participant.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title={t('participant.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-[13px] mb-4" style={{ color: "var(--destructive)" }}>{error}</p>
            <Button onClick={() => window.location.reload()}>{t('participant.retry')}</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={t('participant.title')} />
      <div className="flex flex-col gap-[28px]">
        {/* Welcome banner */}
        <div
          className="rounded-[20px] p-[22px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
            {t('participant.welcome')}
          </div>
          <h1 className="font-display mt-2 text-[32px] font-medium leading-[1.25] tracking-[-0.01em]" style={{ color: "var(--foreground)" }}>
            {t('participant.greeting', { name: userName })}
          </h1>
          <p className="mt-[6px] text-[16px] font-normal" style={{ color: "var(--muted-foreground)" }}>
            <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
              {t('participant.availableCount', { count: availableEvaluations.length })}
            </span>
            {completedEvaluations.length > 0 && (
              <>
                {" "}
                <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                  {t('participant.exhaustedCount', { count: completedEvaluations.length })}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Available evaluations */}
        {availableEvaluations.length > 0 && (
          <div>
            <div className="mb-[14px] font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
              {t('participant.availableSection')}
            </div>
            <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
              {availableEvaluations.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col gap-[14px] rounded-[20px] transition-shadow hover:shadow-md"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    padding: 22,
                    boxShadow: "var(--shadow-sm)",
                    opacity: e.locked ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-[10px] font-bold uppercase tracking-[.1em]"
                      style={{
                        background: "var(--coral-soft)",
                        color: "var(--coral-text)",
                        borderRadius: 6,
                        padding: "2px 8px",
                      }}
                    >
                      {e.code}
                    </span>
                    <div className="flex items-center gap-2">
                      {(resultCountByEval[e.id] || 0) > 0 && (
                        <span className="font-display text-[18px] font-medium" style={{ color: "var(--accent)" }}>
                          {latestResultByEval[e.id]?.score}%
                        </span>
                      )}
                      {e.locked && <Lock className="size-4" style={{ color: "var(--muted-foreground)" }} />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-[17px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
                      {e.title}
                    </h3>
                    {e.description && (
                      <p className="mt-1 text-[13px] line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                        {e.description}
                      </p>
                    )}
                    <div className="mt-[10px] flex flex-wrap items-center gap-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      <span className="flex items-center gap-1">
                        <FileQuestion className="size-3.5" /> {t('participant.numQuestions', { count: e.questionCount })}
                      </span>
                      {e.tiempo_limite > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {e.tiempo_limite} min
                        </span>
                      )}
                      {(e.intentos_permitidos ?? 1) > 1 && (
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ background: "#EFF6FF", color: "#1E40AF" }}>
                          {t('participant.attemptOf', { current: (resultCountByEval[e.id] || 0) + 1, max: e.intentos_permitidos })}
                        </span>
                      )}
                    </div>
                    <div className="mt-[8px] space-y-1">
                      {e.created_at && (
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          <Calendar className="size-3 shrink-0" />
                          <span>{t('evaluations.created')} {formatDateTime(e.created_at)}</span>
                        </div>
                      )}
                      {e.fecha_vencimiento && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <CalendarX className="size-3 shrink-0" />
                          <span>{t('evaluations.expires')} {formatDateTime(e.fecha_vencimiento)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {e.locked ? (
                    <div
                      className="rounded-[10px] px-3 py-2 text-center text-[13px] font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}
                    >
                      {e.lockMsg}
                    </div>
                  ) : (
                    <Button asChild className="w-full">
                      <Link to="/take/$code" params={{ code: e.id }}>
                        {(resultCountByEval[e.id] || 0) > 0 ? (
                          <><RefreshCw className="size-4" /> {t('participant.retry')}</>
                        ) : (
                          <>{t('participant.start')} <ArrowRight className="size-4" /></>
                        )}
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed evaluations */}
        {completedEvaluations.length > 0 && (
          <div>
            <div className="mb-[14px] font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
              {t('participant.completedSection')}
            </div>
            <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
              {completedEvaluations.map((e) => {
                const bestResult = bestResultByEval[e.id];
                const intentosUsados = resultCountByEval[e.id] || 0;
                const intentosPermitidos = e.intentos_permitidos ?? 1;
                return (
                  <div
                    key={e.id}
                    className="flex flex-col gap-[14px] rounded-[20px]"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      padding: 22,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-[10px] font-bold uppercase tracking-[.1em]"
                        style={{ background: "#ECFDF5", color: "#065F46", borderRadius: 6, padding: "2px 8px" }}
                      >
                        {e.code}
                      </span>
                      <span className="font-display text-[20px] font-medium" style={{ color: "var(--accent)" }}>
                        {bestResult?.score}%
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-[17px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
                        {e.title}
                      </h3>
                      <div className="mt-[10px] flex flex-wrap items-center gap-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3.5" /> {t('participant.numQuestions', { count: e.questionCount })}
                        </span>
                        {intentosPermitidos > 1 && (
                          <span className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                            {t('participant.attemptCount', { count: `${intentosUsados}/${intentosPermitidos}` })}
                          </span>
                        )}
                      </div>
                      {bestResult?.completed_at && (
                        <div className="mt-[8px] flex items-center gap-1 text-[11px]" style={{ color: "#059669" }}>
                          <CheckCircle className="size-3 shrink-0" />
                          <span>{intentosPermitidos > 1 ? t('participant.bestResult') : t('participant.submitted')} {formatDateTime(bestResult.completed_at)}</span>
                        </div>
                      )}
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/my-results/$id" params={{ id: bestResult?.id }}>
                        {intentosPermitidos > 1 ? t('participant.viewBest') : t('participant.viewResults')}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {availableEvaluations.length === 0 && completedEvaluations.length === 0 && (
          <div
            className="rounded-[20px] p-12 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <FileQuestion className="mx-auto mb-3 size-10" style={{ color: "var(--text-faint)" }} />
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              {t('participant.emptyState')}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
