import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import React from "react";
import { resultsService, evaluationsService, questionsService } from "@/lib/services/evaluations";
import { ArrowLeft, TrendingUp, Users, Award, ChevronRight, CheckCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/evaluation-results/$id")({
  head: () => ({ meta: [{ title: "Resultados de Evaluación — EvalPro" }] }),
  component: EvaluationResultsPage,
});

function EvaluationResultsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ totalParticipants: 0, averageScore: 0, passRate: 0, bestScore: 0 });

  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  useEffect(() => {
    async function loadData() {
      if (!isAdmin || !id) return;
      
      try {
        setLoading(true);
        
        // Cargar evaluación
        const evalData = await evaluationsService.getById(id);
        setEvaluation(evalData);
        
        // Cargar resultados de esta evaluación
        const resultsData = await resultsService.getByEvaluationId(id);
        setResults(resultsData);
        
        // Recopilar todos los IDs de preguntas respondidas en todos los resultados
        const allQuestionIds = new Set<string>();
        resultsData.forEach((result: any) => {
          if (result.answers) {
            Object.keys(result.answers).forEach(qId => allQuestionIds.add(qId));
          }
        });
        
        // Cargar solo las preguntas que fueron respondidas
        if (allQuestionIds.size > 0) {
          const questionsData = await questionsService.getByIds(Array.from(allQuestionIds));
          const questionsById: Record<string, any> = {};
          questionsData.forEach((q: any) => {
            questionsById[q.id] = q;
          });
          setQuestionsMap(questionsById);
        }
        
        // Calcular estadísticas
        const totalParticipants = resultsData.length;
        const averageScore = totalParticipants > 0
          ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / totalParticipants)
          : 0;
        const passRate = totalParticipants > 0
          ? Math.round((resultsData.filter((r) => r.score >= 60).length / totalParticipants) * 100)
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
  }, [isAdmin, id]);

  if (loading) {
    return (
      <AppShell
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }, { label: "Resultados" }]}
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
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }, { label: "Resultados" }]}
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
      breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }, { label: "Resultados" }]}
      actions={
        <Button asChild variant="outline">
          <Link to="/evaluations">
            <ArrowLeft className="size-4" /> Volver a Evaluaciones
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
                    <th className="px-6 py-3 font-bold">Puntaje</th>
                    <th className="px-6 py-3 font-bold text-emerald-600">✓</th>
                    <th className="px-6 py-3 font-bold text-amber-600">~</th>
                    <th className="px-6 py-3 font-bold text-red-600">✗</th>
                    <th className="px-6 py-3 font-bold">Estado</th>
                    <th className="px-6 py-3 font-bold">Fecha</th>
                    <th className="px-6 py-3 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[...results].sort((a, b) => b.score - a.score).map((result: any) => {
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
                      <React.Fragment key={result.id}>
                        <tr className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                          <td className="px-6 py-4 font-medium">
                            {result.profiles?.full_name || 'Sin nombre'}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-accent">
                            {result.score}%
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-600">
                            {correctCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-amber-600">
                            {partialCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-red-600">
                            {incorrectCount}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-bold ${
                                result.score >= 60
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {result.score >= 60 ? "APROBADO" : "REPROBADO"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(result.completed_at).toLocaleString('es-ES', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value={`result-${result.id}`} className="border-none">
                                <AccordionTrigger className="py-2 px-3 text-xs font-medium hover:no-underline">
                                  Ver detalle
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4 pt-2">
                                    {!result.answers || Object.keys(result.answers).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No hay respuestas disponibles para este resultado</p>
                                    ) : (
                                      Object.keys(result.answers).map((questionId, qIndex) => {
                                        const question = questionsMap[questionId];
                                        if (!question) return null;
                                        
                                        const userAnswer = result.answers[questionId];
                                        const userAnswers = userAnswer ? String(userAnswer).split(',').map((a: string) => a.trim()) : [];
                                        const correctAnswers = question.correct_answer.split(',').map((a: string) => a.trim());
                                        
                                        // Verificar si todas las respuestas del usuario son correctas
                                        const allCorrect = userAnswers.length > 0 && 
                                          userAnswers.every((ans: string) => correctAnswers.includes(ans));
                                        // Verificar si el usuario seleccionó todas las respuestas correctas
                                        const allSelected = correctAnswers.every((ans: string) => userAnswers.includes(ans));
                                        const isCorrect = allCorrect && allSelected;
                                        
                                        return (
                                          <div key={questionId} className="rounded-lg border border-border bg-secondary/30 p-4">
                                            <div className="flex items-start gap-3">
                                              <div className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center ${
                                                isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                              }`}>
                                                {isCorrect ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                                              </div>
                                              <div className="flex-1 space-y-2">
                                                <div className="font-medium text-sm">
                                                  <span className="text-muted-foreground mr-2">Pregunta {qIndex + 1}:</span>
                                                  {question.question_text}
                                                </div>
                                                <div className="space-y-1">
                                                  {question.options.map((option: string, oIndex: number) => {
                                                    const isSelected = userAnswers.includes(String(oIndex));
                                                    const isOptionCorrect = correctAnswers.includes(String(oIndex));
                                                    
                                                    return (
                                                      <div
                                                        key={oIndex}
                                                        className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${
                                                          isSelected && isOptionCorrect
                                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                            : isSelected && !isOptionCorrect
                                                            ? "bg-red-100 text-red-800 border border-red-300"
                                                            : isOptionCorrect
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : "bg-background"
                                                        }`}
                                                      >
                                                        <div className={`size-4 rounded border-2 flex items-center justify-center ${
                                                          isSelected ? "border-current bg-current" : "border-muted"
                                                        }`}>
                                                          {isSelected && <div className="size-2 rounded-sm bg-white" />}
                                                        </div>
                                                        <span className="flex-1">{option}</span>
                                                        {isOptionCorrect && !isSelected && (
                                                          <span className="text-[10px] font-medium text-emerald-600">Correcta</span>
                                                        )}
                                                        {isSelected && isOptionCorrect && (
                                                          <span className="text-[10px] font-medium text-emerald-700">Tu respuesta ✓</span>
                                                        )}
                                                        {isSelected && !isOptionCorrect && (
                                                          <span className="text-[10px] font-medium text-red-700">Tu respuesta ✗</span>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
