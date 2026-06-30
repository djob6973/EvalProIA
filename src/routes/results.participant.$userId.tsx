import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useEffect, useMemo, useState } from "react";
import React from "react";
import {
  ArrowLeft, CheckCircle, XCircle, TrendingUp, ChevronDown, ChevronRight,
  Users, Trophy, Clock, BarChart2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  resultsService, areasService, questionsService,
} from "@/lib/services/evaluations";

export const Route = createFileRoute("/results/participant/$userId")({
  head: () => ({ meta: [{ title: "Detalle de Participante — EvalPro" }] }),
  component: ParticipantDetailPage,
});

type ResultRow = {
  id: string;
  user_id: string;
  evaluation_id: string;
  score: number;
  answers: Record<string, string | string[]>;
  completed_at: string;
  started_at: string;
  evaluations: { title: string; area_id: string | null };
  profiles: { full_name: string | null; email: string };
};

function formatDuration(startedAt: string, completedAt: string): string {
  if (!startedAt || !completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getDificultadClass(dificultad: string): string {
  const d = (dificultad || "").toLowerCase();
  if (d.includes("fácil") || d.includes("facil") || d === "bajo")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (d.includes("medio") || d === "intermedio")
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (d.includes("difícil") || d.includes("dificil") || d === "alto")
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return "bg-secondary text-muted-foreground";
}

function classifyAnswer(
  userAnswer: string | string[] | undefined,
  correctAnswer: string
): { isCorrect: boolean; isPartial: boolean } {
  const userAnswers = userAnswer
    ? String(userAnswer).split(",").map((a) => a.trim()).filter(Boolean)
    : [];
  const correctAnswers = correctAnswer.split(",").map((a) => a.trim());
  if (userAnswers.length === 0) return { isCorrect: false, isPartial: false };
  const allCorrect = userAnswers.every((a) => correctAnswers.includes(a));
  const allSelected = correctAnswers.every((a) => userAnswers.includes(a));
  const hasSome = userAnswers.some((a) => correctAnswers.includes(a));
  const isCorrect = allCorrect && allSelected;
  return { isCorrect, isPartial: hasSome && !isCorrect };
}

function QuestionCard({
  question,
  userAnswer,
  index,
}: {
  question: any;
  userAnswer: string | string[] | undefined;
  index: number;
}) {
  const { t } = useTranslation();
  const userAnswers = userAnswer
    ? String(userAnswer).split(",").map((a) => a.trim()).filter(Boolean)
    : [];
  const correctAnswers = question.correct_answer.split(",").map((a: string) => a.trim());
  const { isCorrect, isPartial } = classifyAnswer(userAnswer, question.correct_answer);
  const selectedCorrectCount = userAnswers.filter((a) => correctAnswers.includes(a)).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center ${
            isCorrect
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : isPartial
              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {isCorrect ? (
            <CheckCircle className="size-3" />
          ) : isPartial ? (
            <TrendingUp className="size-3" />
          ) : (
            <XCircle className="size-3" />
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-start gap-2">
            <div className="font-medium text-sm flex-1">
              <span className="text-muted-foreground mr-1">{t('common.question')} {index + 1}:</span>
              {question.question_text}
            </div>
            {question.dificultad && (
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getDificultadClass(question.dificultad)}`}
              >
                {question.dificultad}
              </span>
            )}
          </div>

          {question.contexto && (
            <p
              className="rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
              style={{
                borderColor: "var(--accent)",
                background: "var(--secondary)",
                color: "var(--muted-foreground)",
              }}
            >
              <strong style={{ color: "var(--foreground)" }}>{t('common.context')}</strong>{" "}
              {question.contexto}
            </p>
          )}

          <div className="space-y-1">
            {question.options.map((option: string, oIndex: number) => {
              const isSelected = userAnswers.includes(String(oIndex));
              const isOptionCorrect = correctAnswers.includes(String(oIndex));
              return (
                <div
                  key={oIndex}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${
                    isSelected && isOptionCorrect
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : isSelected && !isOptionCorrect
                      ? "bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                      : isOptionCorrect
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
                      : "bg-background border border-transparent"
                  }`}
                >
                  <div
                    className={`size-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-current bg-current" : "border-muted"
                    }`}
                  >
                    {isSelected && <div className="size-2 rounded-sm bg-white" />}
                  </div>
                  <span className="flex-1">{option}</span>
                  {isOptionCorrect && !isSelected && (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {t('common.correct')}
                    </span>
                  )}
                  {isSelected && isOptionCorrect && (
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      Tu respuesta ✓
                    </span>
                  )}
                  {isSelected && !isOptionCorrect && (
                    <span className="text-[10px] font-medium text-red-700 dark:text-red-400">
                      Tu respuesta ✗
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {isPartial && (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t('evalResults.partialDetail', { correct: selectedCorrectCount, total: correctAnswers.length })}
            </p>
          )}

          {question.justificacion && (
            <p
              className="mt-1 rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
              style={{
                borderColor: "var(--accent)",
                background: "var(--secondary)",
                color: "var(--muted-foreground)",
              }}
            >
              <strong style={{ color: "var(--foreground)" }}>{t('common.justification')}</strong>{" "}
              {question.justificacion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantDetailPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();
  const { userId } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantProfile, setParticipantProfile] = useState<{
    full_name: string | null;
    email: string;
  } | null>(null);
  const [resultsByEval, setResultsByEval] = useState<
    Array<{
      evalId: string;
      evalTitle: string;
      areaName: string | null;
      results: ResultRow[];
    }>
  >([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({
    totalSessions: 0,
    evalCount: 0,
    avgScore: 0,
    bestScore: 0,
  });

  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('results')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  useEffect(() => {
    async function load() {
      if (!isAdmin || !userId) return;
      try {
        setLoading(true);
        const [allResults, allAreas] = await Promise.all([
          resultsService.getAll(),
          areasService.getAll(),
        ]);

        const areaMap = Object.fromEntries(allAreas.map((a) => [a.id, a.name]));
        const userResults = (allResults as ResultRow[]).filter((r) => r.user_id === userId);

        if (userResults.length === 0) {
          setError(t('myResults.noAnswers'));
          return;
        }

        setParticipantProfile(userResults[0].profiles);

        // Load questions
        const allQuestionIds = new Set<string>();
        userResults.forEach((r) => {
          if (r.answers) Object.keys(r.answers).forEach((id) => allQuestionIds.add(id));
        });
        if (allQuestionIds.size > 0) {
          const questions = await questionsService.getByIds(Array.from(allQuestionIds));
          const qMap: Record<string, any> = {};
          questions.forEach((q: any) => { qMap[q.id] = q; });
          setQuestionsMap(qMap);
        }

        // Group by evaluation, sort attempts chronologically
        const byEval = new Map<string, ResultRow[]>();
        for (const r of userResults) {
          const arr = byEval.get(r.evaluation_id) ?? [];
          arr.push(r);
          byEval.set(r.evaluation_id, arr);
        }

        const evalGroups = Array.from(byEval.entries()).map(([evalId, results]) => ({
          evalId,
          evalTitle: results[0].evaluations.title,
          areaName: results[0].evaluations.area_id
            ? (areaMap[results[0].evaluations.area_id] ?? null)
            : null,
          results: [...results].sort(
            (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
          ),
        }));
        // Sort evaluations by most recent activity
        evalGroups.sort((a, b) => {
          const aLast = Math.max(...a.results.map((r) => new Date(r.completed_at).getTime()));
          const bLast = Math.max(...b.results.map((r) => new Date(r.completed_at).getTime()));
          return bLast - aLast;
        });

        setResultsByEval(evalGroups);

        const scores = userResults.map((r) => r.score);
        setStats({
          totalSessions: userResults.length,
          evalCount: byEval.size,
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          bestScore: Math.max(...scores),
        });
      } catch (err) {
        console.error("Error loading participant detail:", err);
        setError(t('myResults.loadError'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin, userId]);

  const participantName =
    participantProfile?.full_name || participantProfile?.email || "Participante";

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Detalle Participante" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">{t('myResults.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Detalle Participante" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button asChild variant="outline">
              <Link to="/results">
                <ArrowLeft className="size-4" /> {t('common.back')}
              </Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={participantName}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/results">
              <ArrowLeft className="size-4" /> {t('common.back')}
            </Link>
          </Button>
        }
      />
      <div className="space-y-5">
        {/* Participant header */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-[var(--coral-soft)] text-lg font-bold text-[var(--coral-text)]">
              {participantName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{participantName}</h1>
              {participantProfile?.full_name && (
                <p className="text-sm text-muted-foreground">{participantProfile.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t('results.colSessions'), value: String(stats.totalSessions), icon: Clock },
            { label: t('nav.evaluations'), value: String(stats.evalCount), icon: Users },
            { label: t('common.average'), value: `${stats.avgScore}%`, icon: BarChart2 },
            { label: t('results.bestScore'), value: `${stats.bestScore}%`, icon: Trophy },
          ].map((k) => (
            <div key={k.label} className="dash-card p-[22px]">
              <div className="flex items-center gap-1.5">
                <k.icon className="size-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "var(--muted-foreground)" }}>{k.label}</span>
              </div>
              <div className="mt-[10px] font-display text-[34px] font-medium leading-none tracking-tight tabular-nums" style={{ color: "var(--foreground)" }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Evaluations */}
        <div className="space-y-4">
          {resultsByEval.map((group) => {
            const groupScores = group.results.map((r) => r.score);
            const groupAvg = Math.round(
              groupScores.reduce((a, b) => a + b, 0) / groupScores.length
            );
            const groupBest = Math.max(...groupScores);
            const isPassing = groupAvg >= 60;

            return (
              <div
                key={group.evalId}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Evaluation header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 bg-[var(--surface-2)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{group.evalTitle}</h3>
                      {group.areaName && (
                        <span className="text-xs text-muted-foreground">{group.areaName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {t('common.average')}
                      </div>
                      <div
                        className={`font-mono text-lg font-bold ${
                          isPassing ? "text-[var(--coral-text)]" : "text-muted-foreground"
                        }`}
                      >
                        {groupAvg}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {t('results.colBest')}
                      </div>
                      <div className="font-mono text-lg font-bold text-foreground">{groupBest}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {t('common.attempts')}
                      </div>
                      <div className="font-mono text-lg font-bold text-foreground">
                        {group.results.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attempts */}
                <div className="divide-y divide-border">
                  {group.results.map((result, attemptIdx) => {
                    const isExpanded = expandedResultId === result.id;
                    const isPassing = result.score >= 60;
                    const hasAnswers = result.answers && Object.keys(result.answers).length > 0;

                    let correct = 0, partial = 0, incorrect = 0;
                    if (hasAnswers) {
                      Object.entries(result.answers).forEach(([qId, ans]) => {
                        const q = questionsMap[qId];
                        if (!q) return;
                        const { isCorrect, isPartial } = classifyAnswer(ans, q.correct_answer);
                        if (isCorrect) correct++;
                        else if (isPartial) partial++;
                        else incorrect++;
                      });
                    }

                    return (
                      <React.Fragment key={result.id}>
                        <div className="flex flex-wrap items-center gap-4 px-6 py-3.5 hover:bg-[var(--surface-2)] transition-colors">
                          {/* Attempt badge */}
                          <div className="shrink-0">
                            <span className="rounded-full bg-[var(--surface-2)] border border-border px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                              {t('common.attempt_n', { n: attemptIdx + 1 })}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-base font-bold ${
                                isPassing ? "text-[var(--coral-text)]" : "text-muted-foreground"
                              }`}
                            >
                              {result.score}%
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isPassing
                                  ? "bg-[var(--coral-soft)] text-[var(--coral-text)]"
                                  : "bg-[var(--surface-2)] text-muted-foreground"
                              }`}
                            >
                              {isPassing ? t('common.approved').toLowerCase() : t('common.failed').toLowerCase()}
                            </span>
                          </div>

                          {/* Correcta / Parcial / Incorrecta */}
                          {hasAnswers && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="size-3" />
                                {correct}
                              </span>
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <TrendingUp className="size-3" />
                                {partial}
                              </span>
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <XCircle className="size-3" />
                                {incorrect}
                              </span>
                            </div>
                          )}

                          {/* Date + Duration */}
                          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatDuration(result.started_at, result.completed_at)}</span>
                            <span>
                              {new Date(result.completed_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>

                            {/* Expand toggle */}
                            {hasAnswers && (
                              <button
                                onClick={() =>
                                  setExpandedResultId(isExpanded ? null : result.id)
                                }
                                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:border-accent"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="size-3" /> {t('common.hide')}
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="size-3" /> {t('common.show_questions')}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded question detail */}
                        {isExpanded && (
                          <div className="border-t border-border/50 bg-[var(--surface-2)]/50 px-6 py-4">
                            <div className="space-y-3">
                              {Object.keys(result.answers).length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  {t('evalResults.noAnswers')}
                                </p>
                              ) : (
                                Object.entries(result.answers).map(([qId, ans], qIdx) => {
                                  const question = questionsMap[qId];
                                  if (!question) return null;
                                  return (
                                    <QuestionCard
                                      key={qId}
                                      question={question}
                                      userAnswer={ans}
                                      index={qIdx}
                                    />
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
