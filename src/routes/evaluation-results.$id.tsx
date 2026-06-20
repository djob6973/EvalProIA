import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { resultsService, evaluationsService, questionsService } from "@/lib/services/evaluations";
import { ArrowLeft, TrendingUp, Users, Award, CheckCircle, XCircle, Download, ChevronDown, ChevronRight, Clock } from "lucide-react";

export const Route = createFileRoute("/evaluation-results/$id")({
  head: () => ({ meta: [{ title: "Resultados de Evaluación — EvalPro" }] }),
  component: EvaluationResultsPage,
});

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

function EvaluationResultsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "both";
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ totalParticipants: 0, averageScore: 0, passRate: 0, bestScore: 0 });
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;
      if (!isAdmin) {
        navigate({ to: "/participant" });
        return;
      }
      if (!id) return;

      try {
        setLoading(true);

        const evalData = await evaluationsService.getById(id);
        setEvaluation(evalData);

        const resultsData = await resultsService.getByEvaluationId(id);
        setResults(resultsData);

        const allQuestionIds = new Set<string>();
        resultsData.forEach((result: any) => {
          if (result.answers) {
            Object.keys(result.answers).forEach((qId) => allQuestionIds.add(qId));
          }
        });

        if (allQuestionIds.size > 0) {
          const questionsData = await questionsService.getByIds(Array.from(allQuestionIds));
          const questionsById: Record<string, any> = {};
          questionsData.forEach((q: any) => {
            questionsById[q.id] = q;
          });
          setQuestionsMap(questionsById);
        }

        const totalParticipants = resultsData.length;
        const averageScore =
          totalParticipants > 0
            ? Math.round(resultsData.reduce((sum: number, r: any) => sum + r.score, 0) / totalParticipants)
            : 0;
        const passingThreshold = evalData?.config?.porcentaje_aprobacion ?? 60;
        const passRate =
          totalParticipants > 0
            ? Math.round(
                (resultsData.filter((r: any) => r.score >= passingThreshold).length / totalParticipants) * 100
              )
            : 0;
        const bestScore =
          totalParticipants > 0 ? Math.max(...resultsData.map((r: any) => r.score)) : 0;

        setStats({ totalParticipants, averageScore, passRate, bestScore });
      } catch (err) {
        console.error("Error loading evaluation results:", err);
        setError("Error al cargar los resultados de la evaluación");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile, isAdmin, id, navigate]);

  const questionAnalytics = useMemo(() => {
    if (!results.length || !Object.keys(questionsMap).length) return [];

    const qStats: Record<string, { questionId: string; text: string; attempts: number; correct: number }> = {};

    results.forEach((r: any) => {
      if (!r.answers) return;
      Object.keys(r.answers).forEach((qId) => {
        const q = questionsMap[qId];
        if (!q) return;
        if (!qStats[qId]) {
          qStats[qId] = { questionId: qId, text: q.question_text, attempts: 0, correct: 0 };
        }
        const userAns = r.answers[qId]
          ? String(r.answers[qId])
              .split(",")
              .map((a: string) => a.trim())
          : [];
        const correctAns = q.correct_answer.split(",").map((a: string) => a.trim());
        const allCorrect = userAns.length > 0 && userAns.every((a: string) => correctAns.includes(a));
        const allSelected = correctAns.every((a: string) => userAns.includes(a));
        qStats[qId].attempts++;
        if (allCorrect && allSelected) qStats[qId].correct++;
      });
    });

    return Object.values(qStats)
      .map((s) => ({
        ...s,
        errorRate: s.attempts > 0 ? Math.round(((s.attempts - s.correct) / s.attempts) * 100) : 0,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);
  }, [results, questionsMap]);

  function downloadCsv(rows: string[][], filename: string) {
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const content = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportResultsCsv() {
    const passing = evaluation?.config?.porcentaje_aprobacion ?? 60;
    const headers = [
      "Participante",
      "Email",
      "Puntaje",
      "Estado",
      "Correctas",
      "Parciales",
      "Incorrectas",
      "Tiempo",
      "Fecha Completado",
    ];
    const rows = results.map((r: any) => {
      let correct = 0,
        partial = 0,
        incorrect = 0;
      if (r.answers) {
        Object.keys(r.answers).forEach((qId) => {
          const q = questionsMap[qId];
          if (!q) return;
          const userAns = r.answers[qId]
            ? String(r.answers[qId])
                .split(",")
                .map((a: string) => a.trim())
            : [];
          const correctAns = q.correct_answer.split(",").map((a: string) => a.trim());
          const allCorrect = userAns.length > 0 && userAns.every((a: string) => correctAns.includes(a));
          const allSelected = correctAns.every((a: string) => userAns.includes(a));
          const isCorrect = allCorrect && allSelected;
          const hasSome = userAns.length > 0 && userAns.some((a: string) => correctAns.includes(a));
          if (isCorrect) correct++;
          else if (hasSome) partial++;
          else incorrect++;
        });
      }
      return [
        r.profiles?.full_name || "",
        r.profiles?.email || "",
        String(r.score),
        r.score >= passing ? "APROBADO" : "REPROBADO",
        String(correct),
        String(partial),
        String(incorrect),
        formatDuration(r.started_at, r.completed_at),
        new Date(r.completed_at).toLocaleString("es-ES"),
      ];
    });
    const safe = (evaluation?.title || id).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv([headers, ...rows], `resultados-${safe}-${today}.csv`);
  }

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }, { label: "Resultados" }]}>
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
      <AppShell breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }, { label: "Resultados" }]}>
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportResultsCsv} disabled={results.length === 0}>
            <Download className="size-4" /> Exportar CSV
          </Button>
          <Button asChild variant="outline">
            <Link to="/evaluations">
              <ArrowLeft className="size-4" /> Volver a Evaluaciones
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{evaluation?.title || "Evaluación"}</h1>
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
          <div className="overflow-x-auto">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground p-6">
                <p>No hay resultados registrados para esta evaluación</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-bold">Participante</th>
                    <th className="px-6 py-3 font-bold">Puntaje</th>
                    <th className="px-6 py-3 font-bold text-emerald-600 dark:text-emerald-400">✓</th>
                    <th className="px-6 py-3 font-bold text-amber-600 dark:text-amber-400">~</th>
                    <th className="px-6 py-3 font-bold text-red-600 dark:text-red-400">✗</th>
                    <th className="px-6 py-3 font-bold">Estado</th>
                    <th className="px-6 py-3 font-bold">Fecha</th>
                    <th className="px-6 py-3 font-bold">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> Tiempo
                      </span>
                    </th>
                    <th className="px-6 py-3 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[...results].sort((a, b) => b.score - a.score).map((result: any) => {
                    let correctCount = 0;
                    let partialCount = 0;
                    let incorrectCount = 0;

                    if (result.answers && Object.keys(result.answers).length > 0) {
                      Object.keys(result.answers).forEach((questionId) => {
                        const question = questionsMap[questionId];
                        if (!question) return;
                        const userAnswer = result.answers[questionId];
                        const userAnswers = userAnswer
                          ? String(userAnswer)
                              .split(",")
                              .map((a: string) => a.trim())
                          : [];
                        const correctAnswers = question.correct_answer
                          .split(",")
                          .map((a: string) => a.trim());
                        const allCorrect =
                          userAnswers.length > 0 &&
                          userAnswers.every((ans: string) => correctAnswers.includes(ans));
                        const allSelected = correctAnswers.every((ans: string) =>
                          userAnswers.includes(ans)
                        );
                        const isCorrect = allCorrect && allSelected;
                        const hasSomeCorrect =
                          userAnswers.length > 0 &&
                          userAnswers.some((ans: string) => correctAnswers.includes(ans));
                        const isPartial = hasSomeCorrect && !isCorrect;
                        if (isCorrect) correctCount++;
                        else if (isPartial) partialCount++;
                        else incorrectCount++;
                      });
                    }

                    const isExpanded = expandedResultId === result.id;
                    const passing = evaluation?.config?.porcentaje_aprobacion ?? 60;

                    return (
                      <React.Fragment key={result.id}>
                        <tr
                          className={`border-b border-border/50 hover:bg-secondary/40 transition-colors ${
                            isExpanded ? "bg-secondary/20" : ""
                          }`}
                        >
                          <td className="px-6 py-4 font-medium">
                            {result.profiles?.full_name || "Sin nombre"}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-accent">{result.score}%</td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {correctCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                            {partialCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-red-600 dark:text-red-400">
                            {incorrectCount}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-bold ${
                                result.score >= passing
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              }`}
                            >
                              {result.score >= passing ? "APROBADO" : "REPROBADO"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {new Date(result.completed_at).toLocaleString("es-ES", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                            {formatDuration(result.started_at, result.completed_at)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setExpandedResultId(isExpanded ? null : result.id)}
                              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border hover:bg-secondary transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="size-3" /> Ocultar
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="size-3" /> Ver detalle
                                </>
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50">
                            <td colSpan={9} className="px-6 py-5 bg-secondary/10">
                              <div className="space-y-3">
                                {!result.answers || Object.keys(result.answers).length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    No hay respuestas disponibles para este resultado
                                  </p>
                                ) : (
                                  Object.keys(result.answers).map((questionId, qIndex) => {
                                    const question = questionsMap[questionId];
                                    if (!question) return null;

                                    const userAnswer = result.answers[questionId];
                                    const userAnswers = userAnswer
                                      ? String(userAnswer)
                                          .split(",")
                                          .map((a: string) => a.trim())
                                      : [];
                                    const correctAnswers = question.correct_answer
                                      .split(",")
                                      .map((a: string) => a.trim());

                                    const allCorrect =
                                      userAnswers.length > 0 &&
                                      userAnswers.every((ans: string) => correctAnswers.includes(ans));
                                    const allSelected = correctAnswers.every((ans: string) =>
                                      userAnswers.includes(ans)
                                    );
                                    const isCorrect = allCorrect && allSelected;
                                    const hasSomeCorrect =
                                      userAnswers.length > 0 &&
                                      userAnswers.some((ans: string) => correctAnswers.includes(ans));
                                    const isPartial = hasSomeCorrect && !isCorrect;

                                    const selectedCorrectCount = userAnswers.filter((a: string) =>
                                      correctAnswers.includes(a)
                                    ).length;

                                    return (
                                      <div
                                        key={questionId}
                                        className="rounded-lg border border-border bg-card p-4"
                                      >
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
                                            {/* Número, texto y badge de dificultad */}
                                            <div className="flex flex-wrap items-start gap-2">
                                              <div className="font-medium text-sm flex-1">
                                                <span className="text-muted-foreground mr-1">
                                                  Pregunta {qIndex + 1}:
                                                </span>
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

                                            {/* Contexto */}
                                            {question.contexto && (
                                              <p
                                                className="rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
                                                style={{
                                                  borderColor: "var(--accent)",
                                                  background: "var(--secondary)",
                                                  color: "var(--muted-foreground)",
                                                }}
                                              >
                                                <strong style={{ color: "var(--foreground)" }}>
                                                  Contexto:
                                                </strong>{" "}
                                                {question.contexto}
                                              </p>
                                            )}

                                            {/* Opciones */}
                                            <div className="space-y-1">
                                              {question.options.map((option: string, oIndex: number) => {
                                                const isSelected = userAnswers.includes(String(oIndex));
                                                const isOptionCorrect = correctAnswers.includes(
                                                  String(oIndex)
                                                );

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
                                                        isSelected
                                                          ? "border-current bg-current"
                                                          : "border-muted"
                                                      }`}
                                                    >
                                                      {isSelected && (
                                                        <div className="size-2 rounded-sm bg-white" />
                                                      )}
                                                    </div>
                                                    <span className="flex-1">{option}</span>
                                                    {isOptionCorrect && !isSelected && (
                                                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                        Correcta
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

                                            {/* Detalle respuestas parciales */}
                                            {isPartial && (
                                              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                {selectedCorrectCount} de {correctAnswers.length} opciones
                                                correctas seleccionadas
                                              </p>
                                            )}

                                            {/* Justificación */}
                                            {question.justificacion && (
                                              <p
                                                className="mt-1 rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
                                                style={{
                                                  borderColor: "var(--accent)",
                                                  background: "var(--secondary)",
                                                  color: "var(--muted-foreground)",
                                                }}
                                              >
                                                <strong style={{ color: "var(--foreground)" }}>
                                                  Justificación:
                                                </strong>{" "}
                                                {question.justificacion}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Analytics por pregunta */}
        {questionAnalytics.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <h2 className="font-bold">Analytics por Pregunta</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Preguntas ordenadas de mayor a menor tasa de error — identifica los conceptos más débiles del
                equipo
              </p>
            </div>
            <div className="divide-y divide-border">
              {questionAnalytics.map((qa, idx) => {
                const errorColor =
                  qa.errorRate >= 70
                    ? "bg-red-500"
                    : qa.errorRate >= 40
                    ? "bg-amber-400"
                    : "bg-emerald-400";
                const errorLabel =
                  qa.errorRate >= 70
                    ? "text-red-600"
                    : qa.errorRate >= 40
                    ? "text-amber-600"
                    : "text-emerald-600";
                return (
                  <div key={qa.questionId} className="flex items-start gap-4 p-4">
                    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{qa.text}</p>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full rounded-full transition-all ${errorColor}`}
                            style={{ width: `${qa.errorRate}%` }}
                          />
                        </div>
                        <span className={`w-24 shrink-0 font-mono text-xs font-bold ${errorLabel}`}>
                          {qa.errorRate}% errores
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {qa.attempts - qa.correct}/{qa.attempts} participantes
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
