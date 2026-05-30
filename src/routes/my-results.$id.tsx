import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import React from "react";
import { resultsService, evaluationsService, questionsService } from "@/lib/services/evaluations";
import { ArrowLeft, TrendingUp, CheckCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/my-results/$id")({
  head: () => ({ meta: [{ title: "Mis Resultados — EvalPro" }] }),
  component: MyResultPage,
});

function MyResultPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    async function loadData() {
      if (!profile?.id || !id) return;
      
      try {
        setLoading(true);
        
        // Load the specific result
        const resultData = await resultsService.getById(id);
        
        // Verify this result belongs to the current user
        if (resultData.user_id !== profile.id) {
          setError('No tienes permiso para ver este resultado');
          return;
        }
        
        setResult(resultData);
        
        // Load evaluation details
        const evalData = await evaluationsService.getById(resultData.evaluation_id);
        setEvaluation(evalData);
        
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
        setError('Error al cargar los resultados');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile?.id, id]);

  if (loading) {
    return (
      <AppShell
        breadcrumb={[{ label: "Participante" }, { label: "Mis Resultados" }]}
      >
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
      <AppShell
        breadcrumb={[{ label: "Participante" }, { label: "Mis Resultados" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button asChild>
              <Link to="/participant">
                <ArrowLeft className="size-4" /> Volver a Mis Evaluaciones
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
      
      const userAnswer = result.answers[questionId];
      const userAnswers = userAnswer ? String(userAnswer).split(',').map((a: string) => a.trim()) : [];
      const correctAnswers = question.correct_answer.split(',').map((a: string) => a.trim());
      
      // Verificar si todas las respuestas del usuario son correctas
      const allCorrect = userAnswers.length > 0 && 
        userAnswers.every((ans: string) => correctAnswers.includes(ans));
      // Verificar si el usuario seleccionó todas las respuestas correctas
      const allSelected = correctAnswers.every((ans: string) => userAnswers.includes(ans));
      const isCorrect = allCorrect && allSelected;
      
      // Verificar si es parcial (algunas correctas pero no todas)
      const hasSomeCorrect = userAnswers.length > 0 && 
        userAnswers.some((ans: string) => correctAnswers.includes(ans));
      const isPartial = hasSomeCorrect && !isCorrect;
      
      if (isCorrect) {
        correctCount++;
      } else if (isPartial) {
        partialCount++;
      } else {
        incorrectCount++;
      }
    });
  }

  return (
    <AppShell
      breadcrumb={[{ label: "Participante" }, { label: "Mis Resultados" }]}
      actions={
        <Button asChild variant="outline">
          <Link to="/participant">
            <ArrowLeft className="size-4" /> Volver a Mis Evaluaciones
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{evaluation?.title || 'Evaluación'}</h1>
          {evaluation?.description && (
            <p className="mt-2 text-sm text-muted-foreground">{evaluation.description}</p>
          )}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>Completada el {new Date(result.completed_at).toLocaleString('es-ES', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-4" />
              Tu Puntaje
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{result.score}%</div>
          </div>
          <div className="rounded-xl border border-border bg-emerald-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <CheckCircle className="size-4 text-emerald-600" />
              Correctas
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-emerald-700">{correctCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
              <TrendingUp className="size-4 text-amber-600" />
              Parciales
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-amber-700">{partialCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-red-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700">
              <XCircle className="size-4 text-red-600" />
              Incorrectas
            </div>
            <div className="mt-2 font-mono text-3xl font-bold text-red-700">{incorrectCount}</div>
          </div>
        </div>

        <div className={`rounded-xl border border-border bg-card p-6 shadow-sm ${
          passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {passed ? <CheckCircle className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
            Estado
          </div>
          <div className={`mt-2 font-mono text-2xl font-bold ${
            passed ? "text-emerald-700" : "text-red-700"
          }`}>
            {passed ? "APROBADO" : "REPROBADO"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <h2 className="font-bold">Detalle de Respuestas</h2>
            <p className="mt-1 text-xs text-muted-foreground">Revisa tus respuestas a cada pregunta</p>
          </div>
          <div className="p-6">
            {!result.answers || Object.keys(result.answers).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hay respuestas disponibles para este resultado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.keys(result.answers).map((questionId, qIndex) => {
                  const question = questionsMap[questionId];
                  if (!question) return null;

                  const userAnswer = result.answers[questionId];
                  const userAnswers = userAnswer ? String(userAnswer).split(',').map((a: string) => a.trim()) : [];
                  const correctAnswers = question.correct_answer.split(',').map((a: string) => a.trim());

                  const allCorrect = userAnswers.length > 0 &&
                    userAnswers.every((ans: string) => correctAnswers.includes(ans));
                  const allSelected = correctAnswers.every((ans: string) => userAnswers.includes(ans));
                  const isCorrect = allCorrect && allSelected;
                  const hasSomeCorrect = userAnswers.length > 0 &&
                    userAnswers.some((ans: string) => correctAnswers.includes(ans));
                  const isPartial = hasSomeCorrect && !isCorrect;

                  const statusConfig = isCorrect
                    ? { label: "Correcta", icon: <CheckCircle className="size-3" />, card: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" }
                    : isPartial
                    ? { label: "Parcial", icon: <TrendingUp className="size-3" />, card: "border-amber-200 bg-amber-50", badge: "bg-amber-100 text-amber-700" }
                    : { label: "Incorrecta", icon: <XCircle className="size-3" />, card: "border-red-200 bg-red-50", badge: "bg-red-100 text-red-700" };

                  return (
                    <div key={questionId} className={`rounded-lg border p-4 ${statusConfig.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <span className="text-xs text-muted-foreground">Pregunta {qIndex + 1}</span>
                          <p className="mt-1 font-medium text-sm">{question.question_text}</p>
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
