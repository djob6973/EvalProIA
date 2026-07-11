import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import React from "react";
import { resultsService, evaluationsService, questionsService, getAnswerStatus } from "@/lib/services/evaluations";
import type { Evaluation } from "@/lib/services/evaluations";
import { generateResultFeedbackFn, type FeedbackBreakdownItem } from "@/lib/services/openai-server";
import { ResultFeedbackCard } from "@/components/ResultFeedbackCard";
import { ArrowLeft, TrendingUp, CheckCircle, XCircle, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/my-results/$id")({
  head: () => ({ meta: [{ title: "Mis Resultados — EvalPro" }] }),
  component: MyResultPage,
});

function MyResultPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!profile?.id || !id) return;

      try {
        setLoading(true);

        // Load the specific result
        const resultData = await resultsService.getById(id);

        // Verify this result belongs to the current user
        if (resultData.user_id !== profile.id) {
          setError(t('myResults.noPermission'));
          return;
        }

        setResult(resultData);

        // Load evaluation details
        const evalData = await evaluationsService.getById(resultData.evaluation_id);
        setEvaluation(evalData);

        // Contar intentos usados para mostrar opción de reintentar
        const count = await resultsService.getCountByUserAndEvaluation(profile.id, resultData.evaluation_id);
        setAttemptCount(count);

        // Load questions that were answered
        if (resultData.answers && Object.keys(resultData.answers).length > 0) {
          const questionIds = Object.keys(resultData.answers);
          const questionsData = await questionsService.getByIds(questionIds);
          const questionsById: Record<string, any> = {};
          questionsData.forEach((q: any) => {
            questionsById[q.id] = q;
          });
          setQuestionsMap(questionsById);
        }

      } catch (err) {
        console.error('Error loading result:', err);
        setError(t('myResults.loadError'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile?.id, id]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('myResults.title')} />
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
        <PageHeader title={t('myResults.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button asChild>
              <Link to="/participant">
                <ArrowLeft className="size-4" /> {t('myResults.backToEvals')}
              </Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const passingThreshold = evaluation?.config?.porcentaje_aprobacion ?? 60;
  const passed = result.score >= passingThreshold;

  // Calcular conteo de respuestas
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;

  if (result.answers && Object.keys(result.answers).length > 0) {
    Object.keys(result.answers).forEach((questionId) => {
      const question = questionsMap[questionId];
      if (!question) return;
      const status = getAnswerStatus(question, result.answers[questionId]);
      if (status === "correct") correctCount++;
      else if (status === "partial") partialCount++;
      else incorrectCount++;
    });
  }

  const intentosPermitidos = evaluation?.intentos_permitidos ?? 1;
  const evaluacionVencida = !!(evaluation?.fecha_vencimiento && new Date(evaluation.fecha_vencimiento) < new Date());
  const puedeReintentar = intentosPermitidos > 1 && attemptCount < intentosPermitidos && evaluation?.activa !== false && !evaluacionVencida;

  const count = intentosPermitidos - attemptCount;

  const feedbackTrigger = evaluation?.feedback_trigger ?? 'ninguno';
  const feedbackEligible =
    feedbackTrigger === 'al_finalizar' ||
    (feedbackTrigger === 'inactiva' && (evaluation?.activa === false || evaluacionVencida));

  const inferQuestionType = (question: any): string => {
    if (question.options?.length === 2 && question.options[0] === 'Verdadero') return 'vf';
    return question.correct_answer?.includes(',') ? 'multiple' : 'unica';
  };

  const handleGetFeedback = async () => {
    if (!evaluation || !result) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const breakdown: FeedbackBreakdownItem[] = Object.keys(result.answers)
        .map((questionId) => {
          const question = questionsMap[questionId];
          if (!question) return null;
          const userAnswer = result.answers[questionId];
          const status = getAnswerStatus(question, userAnswer ?? "");
          const estado = status === 'correct' ? 'correcta' : status === 'partial' ? 'parcial' : 'incorrecta';
          const seleccionadas = Array.isArray(userAnswer) ? userAnswer : [userAnswer].filter(Boolean);
          return {
            enunciado: question.question_text,
            contexto: question.contexto ?? '',
            tipo: inferQuestionType(question),
            opciones: question.options ?? [],
            seleccionadas,
            estado,
            justificacion: question.justificacion ?? '',
          } as FeedbackBreakdownItem;
        })
        .filter((x): x is FeedbackBreakdownItem => x !== null);

      const generated = await generateResultFeedbackFn({
        data: { documentoTexto: evaluation.feedback_documento_texto ?? '', breakdown },
      });
      const saved = await resultsService.submitFeedback(result.id, generated);
      setResult((prev: any) => ({ ...prev, feedback: saved }));
    } catch (err: any) {
      console.error('Error generating feedback:', err);
      setFeedbackError(err.message ?? t('myResults.feedbackError'));
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={t('myResults.title')}
        actions={
          <div className="flex items-center gap-2">
            {puedeReintentar && (
              <Button asChild>
                <Link to="/take/$code" params={{ code: evaluation!.id }}>
                  <RefreshCw className="size-4" /> {t('common.retry')} ({attemptCount}/{intentosPermitidos})
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/participant">
                <ArrowLeft className="size-4" /> {t('myResults.backToEvals')}
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{evaluation?.title || t('nav.evaluations')}</h1>
          {evaluation?.description && (
            <p className="mt-2 text-sm text-muted-foreground">{evaluation.description}</p>
          )}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t('myResults.completedAt', { date: new Date(result.completed_at).toLocaleString('es-ES', {
              dateStyle: 'medium',
              timeStyle: 'short'
            }) })}</span>
          </div>
        </div>

        {puedeReintentar && (
          <div
            className="rounded-xl border p-4 flex items-center justify-between gap-4"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          >
            <div>
              <p className="font-medium text-[14px]" style={{ color: "#1E40AF" }}>
                {t('myResults.remainingAttempts', { count })}
              </p>
              <p className="text-[12px]" style={{ color: "#3B82F6" }}>
                {t('myResults.usedAttempts', { used: attemptCount, total: intentosPermitidos })}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/take/$code" params={{ code: evaluation!.id }}>
                <RefreshCw className="size-4" /> {t('common.retry')}
              </Link>
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-4" />
              {t('myResults.yourScore')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{result.score}%</div>
          </div>
          <div className="rounded-xl border border-border bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
              {t('myResults.correct')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-emerald-700 dark:text-emerald-300">{correctCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />
              {t('myResults.partial')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-amber-700 dark:text-amber-300">{partialCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
              <XCircle className="size-4 text-red-600 dark:text-red-400" />
              {t('myResults.incorrect')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-red-700 dark:text-red-300">{incorrectCount}</div>
          </div>
        </div>

        <div className={`rounded-xl border p-6 shadow-sm ${
          passed
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
            : "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800"
        }`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            passed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
          }`}>
            {passed ? <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="size-4 text-red-600 dark:text-red-400" />}
            {t('common.status')}
          </div>
          <div className={`mt-2 font-mono text-2xl font-bold ${
            passed ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          }`}>
            {passed ? t('common.approved') : t('common.failed')}
          </div>
        </div>

        {feedbackEligible && (
          result.feedback ? (
            <ResultFeedbackCard feedback={result.feedback} />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-sm">
                    <Sparkles className="size-4 text-[#ED5650]" /> {t('myResults.feedbackCta')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('myResults.feedbackCtaDesc')}</p>
                  {feedbackError && <p className="mt-1 text-xs text-destructive">{feedbackError}</p>}
                </div>
                <Button onClick={handleGetFeedback} disabled={feedbackLoading}>
                  {feedbackLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {feedbackLoading ? t('myResults.feedbackGenerating') : t('myResults.feedbackButton')}
                </Button>
              </div>
            </div>
          )
        )}

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <h2 className="font-bold">{t('myResults.answersDetail')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('myResults.answersSubtitle')}</p>
          </div>
          <div className="p-6">
            {!result.answers || Object.keys(result.answers).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('myResults.noAnswers')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(result.answers).map((questionId, qIndex) => {
                  const question = questionsMap[questionId];
                  if (!question) return null;

                  const userAnswer = result.answers[questionId];
                  const status = getAnswerStatus(question, userAnswer ?? "");
                  const isCorrect = status === "correct";
                  const isPartial = status === "partial";

                  const statusConfig = isCorrect
                    ? { label: t('myResults.correctBadge'), icon: <CheckCircle className="size-3" />, card: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300", text: "text-foreground dark:text-foreground", sub: "text-muted-foreground" }
                    : isPartial
                    ? { label: t('myResults.partialBadge'), icon: <TrendingUp className="size-3" />, card: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300", text: "text-foreground dark:text-foreground", sub: "text-muted-foreground" }
                    : { label: t('myResults.incorrectBadge'), icon: <XCircle className="size-3" />, card: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40", badge: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300", text: "text-foreground dark:text-foreground", sub: "text-muted-foreground" };

                  return (
                    <div key={questionId} className={`rounded-lg border p-4 ${statusConfig.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <span className={`text-xs ${statusConfig.sub}`}>{t('myResults.questionN', { index: qIndex + 1 })}</span>
                          <p className={`mt-1 font-medium text-sm ${statusConfig.text}`}>{question.question_text}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${statusConfig.badge}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
