import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArrowLeft, ArrowRight, Clock, FileText, Play, Tag, CheckCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { evaluationsService, questionsService, resultsService, calculateEvaluationScore, evaluationProgressService, evaluationParticipantsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/take/$code")({
  head: () => ({ meta: [{ title: "Realizar Evaluación — EvalPro" }] }),
  component: TakeEvaluationRoute,
});

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function TakeEvaluationRoute() {
  const { code } = useParams({ from: "/take/$code" });
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [started, setStarted] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [existingProgress, setExistingProgress] = useState<any>(null);

  // Cargar evaluación y preguntas
  useEffect(() => {
    async function loadEvaluation() {
      if (!code || !profile?.id) return;
      
      try {
        setLoading(true);
        // Cargar evaluación
        const evalData = await evaluationsService.getById(code);

        // Verificar si la evaluación está activa y no ha vencido
        const expired = evalData.fecha_vencimiento && new Date(evalData.fecha_vencimiento) < new Date();
        if (evalData.activa === false) {
          setError('Esta evaluación no está disponible en este momento.');
          setLoading(false);
          return;
        }
        if (expired) {
          setError(`Esta evaluación venció el ${new Date(evalData.fecha_vencimiento!).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`);
          setLoading(false);
          return;
        }

        // Verificar autorización del participante
        const isAdminUser = profile.role === 'admin' || profile.role === 'both';
        if (!isAdminUser) {
          const assignedIds = await evaluationParticipantsService.getByUserId(profile.id);
          const isDirectlyAssigned = assignedIds.includes(code);
          const isAreaMatch = evalData.area_id && evalData.area_id === profile.area_id;

          if (!isDirectlyAssigned && !isAreaMatch) {
            setError('No tienes autorización para realizar esta evaluación.');
            setLoading(false);
            return;
          }
        }

        setEvaluation(evalData);

        // Verificar si existe progreso previo
        const progress = await evaluationProgressService.getByUserAndEvaluation(profile.id, code);
        if (progress) {
          setExistingProgress(progress);
        }

        // Cargar preguntas asociadas a la evaluación
        let questionsData = await questionsService.getByEvaluationId(code);

        // Si no hay preguntas directamente asociadas, cargar del banco de preguntas
        if (questionsData.length === 0) {
          // Al reanudar, cargar exactamente las preguntas del progreso guardado
          // para que los IDs coincidan con question_order y answers
          if (progress && progress.question_order && progress.question_order.length > 0) {
            questionsData = await questionsService.getByIds(progress.question_order);
          } else {
            const allQuestions = await questionsService.getAll();

            // Filtrar por categorías si están especificadas
            let filteredQuestions = allQuestions;
            const categorias = evalData.categorias;
            if (categorias && categorias.length > 0) {
              filteredQuestions = allQuestions.filter(q =>
                q.categoria && categorias.includes(q.categoria)
              );
            }

            // Filtrar por dificultad si no es "mixto"
            if (evalData.config?.dificultad && evalData.config.dificultad !== 'mixto') {
              filteredQuestions = filteredQuestions.filter(q =>
                q.dificultad === evalData.config.dificultad
              );
            }

            // Mezclar y limitar según num_preguntas
            const shuffled = shuffleArray(filteredQuestions);
            const numPreguntas = evalData.config?.num_preguntas || shuffled.length;
            questionsData = shuffled.slice(0, numPreguntas);
          }
        }
        
        setQuestions(questionsData);
      } catch (err) {
        console.error('Error loading evaluation:', err);
        setError('Error al cargar la evaluación');
      } finally {
        setLoading(false);
      }
    }

    loadEvaluation();
  }, [code, profile?.id]);

  const handleStart = async (isResume = false) => {
    let limitedQuestions;
    let initialAnswers = {};
    let initialQuestionIndex = 0;
    let initialTimeRemaining = evaluation.tiempo_limite ? evaluation.tiempo_limite * 60 : 0;

    if (isResume && existingProgress) {
      // Reanudar desde progreso existente
      initialAnswers = existingProgress.answers;
      initialQuestionIndex = existingProgress.current_question_index;
      initialTimeRemaining = existingProgress.time_remaining;

      // Cargar preguntas específicas por ID desde el orden guardado
      const savedOrder = existingProgress.question_order || [];
      
      // Crear mapa de todas las preguntas disponibles
      const questionMap = new Map(questions.map(q => [q.id, q]));

      // Reconstruir preguntas EXACTAMENTE en el orden guardado
      const orderedQuestions: any[] = [];
      savedOrder.forEach((id: string) => {
        const q = questionMap.get(id);
        if (q) {
          orderedQuestions.push(q);
        }
      });

      // Separar preguntas respondidas y no respondidas
      const answeredQuestions: any[] = [];
      const unansweredQuestions: any[] = [];

      orderedQuestions.forEach((q: any) => {
        const hasAnswer = (initialAnswers as Record<string, string | string[]>)[q.id] !== undefined &&
                          (initialAnswers as Record<string, string | string[]>)[q.id] !== null &&
                          (initialAnswers as Record<string, string | string[]>)[q.id] !== '' &&
                          !(Array.isArray((initialAnswers as Record<string, string | string[]>)[q.id]) && (initialAnswers as Record<string, string | string[]>)[q.id].length === 0);

        if (hasAnswer) {
          answeredQuestions.push(q);
        } else {
          unansweredQuestions.push(q);
        }
      });

      // Mezclar solo las preguntas no respondidas
      const shuffledUnanswered = shuffleArray(unansweredQuestions);

      // Combinar: respondidas en orden original + no respondidas mezcladas
      limitedQuestions = [...answeredQuestions, ...shuffledUnanswered];

      // Siempre apuntar a la primera pregunta no respondida para evitar saltar
      // preguntas que quedaron antes en el nuevo orden mezclado
      initialQuestionIndex = answeredQuestions.length;

    } else {
      // Iniciar nueva evaluación
      const shuffled = shuffleArray(questions);
      const numPreguntas = evaluation.config?.num_preguntas || questions.length;
      limitedQuestions = shuffled.slice(0, numPreguntas);

      // Crear registro de progreso inicial
      if (profile?.id && code) {
        try {
          // Si hay progreso previo (reinicio), eliminarlo antes de crear el nuevo
          if (existingProgress) {
            await evaluationProgressService.delete(profile.id, code);
          }
          await evaluationProgressService.create({
            user_id: profile.id,
            evaluation_id: code,
            current_question_index: 0,
            answers: {},
            time_remaining: initialTimeRemaining,
            question_order: limitedQuestions.map(q => q.id)
          });
        } catch (err) {
          console.error('Error creating progress:', err);
        }
      }
    }

    setShuffledQuestions(limitedQuestions);
    setStarted(true);

    // Pasar el estado inicial al QuizRunner
    setQuizInitialState({
      answers: initialAnswers,
      currentQuestionIndex: initialQuestionIndex,
      timeRemaining: initialTimeRemaining
    });
  };

  const [quizInitialState, setQuizInitialState] = useState<any>(null);

  const handleSubmit = async (answers: Record<string, string | string[]>) => {
    if (!profile?.id || !code) return;
    
    try {
      setSubmitting(true);
      
      // Calcular puntaje con reglas anti-gaming, pasando las preguntas mezcladas para mantener consistencia de IDs
      const score = await calculateEvaluationScore(code, answers, shuffledQuestions);
      
      // Obtener started_at del progreso de evaluación
      const progress = await evaluationProgressService.getByUserAndEvaluation(profile.id, code);
      const startedAt = progress?.started_at || new Date().toISOString();
      
      // Guardar resultado
      await resultsService.create({
        user_id: profile.id,
        evaluation_id: code,
        score: Math.round(score),
        answers: answers as any,
        started_at: startedAt
      });
      
      // Eliminar progreso guardado
      await evaluationProgressService.delete(profile.id, code);
      
      // Redirigir al historial
      navigate({ to: "/my-history" });
    } catch (err) {
      console.error('Error submitting evaluation:', err);
      setError('Error al enviar la evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        breadcrumb={[
          { label: "Participante" },
          { label: "Tomar Evaluación" },
        ]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando evaluación...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !evaluation) {
    return (
      <AppShell
        breadcrumb={[
          { label: "Participante" },
          { label: "Tomar Evaluación" },
        ]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error || 'Evaluación no encontrada'}</p>
            <Button asChild>
              <Link to="/participant">
                <ArrowLeft className="size-4" /> Volver
              </Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!started) {
    // Usar config.num_preguntas de la evaluación para calcular el peso
    const numPreguntas = evaluation.config?.num_preguntas || questions.length;
    const pesoPorPregunta = numPreguntas > 0 ? (100 / numPreguntas).toFixed(2) : "0.00";
    
    return (
      <AppShell
        breadcrumb={[
          { label: "Participante" },
          { label: "Tomar Evaluación" },
          { label: evaluation.title },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/participant">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          </Button>
        }
      >
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {code}
                </span>
                <h2 className="mt-1 text-xl font-bold">{evaluation.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{evaluation.description}</p>
              </div>
              <div className="shrink-0 space-y-2 text-right text-sm text-muted-foreground">
                {evaluation.tiempo_limite > 0 && (
                  <div className="flex items-center justify-end gap-2">
                    <Clock className="size-4" /> {evaluation.tiempo_limite} min
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <FileText className="size-4" /> {questions.length} preguntas
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-accent/10 p-4 text-sm">
                <div className="mb-1 font-medium text-foreground">Peso por pregunta</div>
                <div className="font-mono font-bold text-accent">{pesoPorPregunta}% cada una</div>
              </div>
              {evaluation.config?.porcentaje_aprobacion != null && (
                <div className="rounded-lg bg-emerald-500/10 p-4 text-sm">
                  <div className="mb-1 font-medium text-foreground">Puntaje para aprobar</div>
                  <div className="font-mono font-bold text-emerald-600">{evaluation.config.porcentaje_aprobacion}% o más</div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
              <div className="mb-2 font-medium text-foreground">Antes de comenzar</div>
              <ul className="list-inside list-disc space-y-1">
                <li>Asegúrate de tener una conexión estable.</li>
                <li>Lee cada pregunta cuidadosamente antes de responder.</li>
                <li>En preguntas de selección múltiple, marca todas las opciones correctas.</li>
                <li>Solo dispones de un envío por intento.</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {evaluation.categorias && evaluation.categorias.length > 0 ? (
                  evaluation.categorias.map((c: string) => (
                    <span
                      key={c}
                      className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Tag className="size-3" /> {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Sin categorías</span>
                )}
              </div>
              {existingProgress ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStart(true)}
                    disabled={questions.length === 0}
                  >
                    <RefreshCw className="size-4" /> Reanudar
                  </Button>
                  <Button
                    onClick={() => handleStart(false)}
                    disabled={questions.length === 0}
                  >
                    <Play className="size-4" /> Iniciar de nuevo
                  </Button>
                </div>
              ) : (
                <Button onClick={() => handleStart()} disabled={questions.length === 0}>
                  <Play className="size-4" /> Iniciar evaluación
                </Button>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <QuizRunner 
      code={code} 
      nombre={evaluation.title} 
      questions={shuffledQuestions} 
      onSubmit={handleSubmit}
      submitting={submitting}
      tiempoLimite={evaluation.tiempo_limite}
      initialState={quizInitialState}
      userId={profile?.id}
    />
  );
}

function QuizRunner({ 
  code, 
  nombre, 
  questions, 
  onSubmit,
  submitting,
  tiempoLimite,
  initialState,
  userId 
}: { 
  code: string; 
  nombre: string; 
  questions: any[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  submitting: boolean;
  tiempoLimite?: number;
  initialState?: { answers: Record<string, string | string[]>; currentQuestionIndex: number; timeRemaining: number };
  userId?: string;
}) {
  const [i, setI] = useState(initialState?.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialState?.answers || {});
  const [timeRemaining, setTimeRemaining] = useState<number>(initialState?.timeRemaining || (tiempoLimite ? tiempoLimite * 60 : 0));
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const q = questions[i];
  const progress = ((i + 1) / questions.length) * 100;

  // Refs para que el intervalo del timer siempre acceda a los valores más recientes
  // sin necesitar estar en sus dependencias (evita reiniciar el countdown en cada respuesta)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Timer effect
  useEffect(() => {
    if (!tiempoLimite || tiempoLimite <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmitRef.current(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tiempoLimite]);

  // Save progress periodically
  useEffect(() => {
    if (!userId || !code) return;

    const saveProgress = async () => {
      try {
        await evaluationProgressService.update(userId, code, {
          current_question_index: i,
          answers: answers,
          time_remaining: timeRemaining
        });
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    };

    // Save immediately when answers or index changes
    const saveTimer = setTimeout(saveProgress, 1000);

    return () => clearTimeout(saveTimer);
  }, [i, answers, timeRemaining, userId, code, tiempoLimite]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine if timer is in warning state (less than 2 minutes)
  const isTimeWarning = tiempoLimite && timeRemaining > 0 && timeRemaining <= 120;

  // Determinar tipo de pregunta (única o múltiple)
  const isMultipleChoice = q.correct_answer?.includes(',');
  const correctAnswers = q.correct_answer?.split(',').map((a: string) => a.trim()) || [];

  // Manejar selección de respuesta
  const handleSelectOption = (optionIndex: number) => {
    if (isMultipleChoice) {
      // Selección múltiple
      const currentAnswers = (answers[q.id] as string[]) || [];
      const optionStr = optionIndex.toString();
      const newAnswers = currentAnswers.includes(optionStr)
        ? currentAnswers.filter(idx => idx !== optionStr)
        : [...currentAnswers, optionStr];
      setAnswers({ ...answers, [q.id]: newAnswers });
    } else {
      // Selección única
      setAnswers({ ...answers, [q.id]: optionIndex.toString() });
    }
  };

  // Verificar si la pregunta actual tiene respuesta
  const hasAnswer = isMultipleChoice 
    ? ((answers[q.id] as string[]) || []).length > 0
    : answers[q.id] !== undefined;

  const handleSubmitEvaluation = () => {
    onSubmit(answers);
  };

  return (
    <AppShell
      breadcrumb={[
        { label: "Participante" },
        { label: code },
        { label: `Pregunta ${i + 1}` },
      ]}
      actions={
        <div className="flex items-center gap-3">
          {tiempoLimite && tiempoLimite > 0 && (
            <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs ${
              isTimeWarning 
                ? 'border-destructive bg-destructive/10 text-destructive animate-pulse' 
                : 'border-border bg-card'
            }`}>
              <Clock className="size-3.5" />
              {formatTime(timeRemaining)}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs">
            <FileText className="size-3.5 text-muted-foreground" />
            {nombre}
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-widest">
              {nombre} · Pregunta {i + 1} de {questions.length}
            </span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          {q.contexto && (
            <div className="mb-4 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
              <div className="mb-1 font-medium text-foreground">Contexto</div>
              {q.contexto}
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-bold leading-snug">{q.question_text}</h2>
            {isMultipleChoice && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                Selección Múltiple
              </span>
            )}
          </div>
          <div className="mt-6 space-y-3">
            {q.options.map((opt: string, idx: number) => {
              const isSelected = isMultipleChoice
                ? (answers[q.id] as string[] || []).includes(idx.toString())
                : answers[q.id] === idx.toString();
              
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={submitting}
                  className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                    isSelected
                      ? "border-accent bg-accent/5 text-foreground"
                      : "border-border bg-card hover:border-foreground/20 hover:bg-secondary/40"
                  } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`grid size-6 shrink-0 place-items-center rounded-md border font-mono text-xs ${
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isMultipleChoice ? (
                      isSelected ? (
                        <CheckCircle className="size-4" />
                      ) : (
                        <div className="size-3 rounded-full border-2 border-current" />
                      )
                    ) : (
                      String.fromCharCode(65 + idx)
                    )}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0 || submitting}
          >
            <ArrowLeft className="size-4" /> Anterior
          </Button>
          {i < questions.length - 1 ? (
            <Button onClick={() => setI(i + 1)} disabled={!hasAnswer || submitting}>
              Siguiente <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={!hasAnswer || submitting}
            >
              {submitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 size-4" /> Enviar Evaluación
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showSubmitConfirm}
        title="¿Enviar evaluación?"
        description="Una vez enviada no podrás modificar tus respuestas. ¿Deseas continuar?"
        confirmLabel="Enviar Evaluación"
        loading={submitting}
        onConfirm={() => { setShowSubmitConfirm(false); onSubmit(answers); }}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </AppShell>
  );
}
