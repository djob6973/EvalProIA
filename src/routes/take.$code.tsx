import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
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
  const [currentAttempt, setCurrentAttempt] = useState<number>(1);

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
          setError('Esta evaluación ha sido desactivada por el administrador.');
          setLoading(false);
          return;
        }
        if (expired) {
          setError(`Esta evaluación venció el ${new Date(evalData.fecha_vencimiento!).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`);
          setLoading(false);
          return;
        }

        // Verificar autorización del participante
        const isAdminUser = profile.role !== 'participant';
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

        // Verificar límite de intentos (solo participantes)
        if (!isAdminUser) {
          const intentosPermitidos = evalData.intentos_permitidos ?? 1;
          const intentosUsados = await resultsService.getCountByUserAndEvaluation(profile.id, code);
          if (intentosUsados >= intentosPermitidos) {
            const plural = intentosPermitidos === 1 ? 'intento' : 'intentos';
            setError(`Has utilizado tus ${intentosPermitidos} ${plural} disponibles para esta evaluación.`);
            setLoading(false);
            return;
          }
          setCurrentAttempt(intentosUsados + 1);
        }

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
          const questionOrder: string[] = Array.isArray(progress?.question_order)
            ? progress.question_order
            : (typeof progress?.question_order === 'string' ? JSON.parse(progress.question_order) : []);
          if (progress && questionOrder.length > 0) {
            questionsData = await questionsService.getByIds(questionOrder);
          } else {
            // Query with filters at DB level — avoids downloading the full question bank
            const filteredQuestions = await questionsService.getFiltered({
              categorias: evalData.categorias,
              dificultad: evalData.config?.dificultad,
            });

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
      const rawOrder = existingProgress.question_order;
      const savedOrder: string[] = Array.isArray(rawOrder) ? rawOrder : (typeof rawOrder === 'string' ? JSON.parse(rawOrder) : []);
      
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
      const savedResult = await resultsService.create({
        user_id: profile.id,
        evaluation_id: code,
        score: Math.round(score),
        answers: answers as any,
        started_at: startedAt
      });

      // Eliminar progreso guardado
      await evaluationProgressService.delete(profile.id, code);

      // Redirigir a la página de resultados del intento
      navigate({ to: "/my-results/$id", params: { id: savedResult.id } });
    } catch (err) {
      console.error('Error submitting evaluation:', err);
      setError('Error al enviar la evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Tomar Evaluación" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div
              className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Cargando evaluación...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !evaluation) {
    return (
      <AppShell>
        <PageHeader title="Tomar Evaluación" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-[13px] mb-4" style={{ color: "var(--destructive)" }}>{error || 'Evaluación no encontrada'}</p>
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
      <AppShell>
        <PageHeader
          title={evaluation.title}
          actions={
            <Button variant="outline" asChild>
              <Link to="/participant">
                <ArrowLeft className="size-4" /> Volver
              </Link>
            </Button>
          }
        />
        <div className="mx-auto max-w-[640px]">
          <div
            className="overflow-hidden rounded-[20px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-6 px-[22px] py-[22px] border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="min-w-0">
                <span
                  className="font-mono text-[10px] font-bold uppercase tracking-[.1em]"
                  style={{ background: "var(--coral-soft)", color: "var(--coral-text)", borderRadius: 6, padding: "2px 8px" }}
                >
                  {code}
                </span>
                <h2 className="font-display mt-[10px] text-[22px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
                  {evaluation.title}
                </h2>
                {evaluation.description && (
                  <p className="mt-[6px] text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                    {evaluation.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col gap-[6px] text-right text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                {evaluation.tiempo_limite > 0 && (
                  <div className="flex items-center justify-end gap-[6px]">
                    <Clock className="size-4" /> {evaluation.tiempo_limite} min
                  </div>
                )}
                <div className="flex items-center justify-end gap-[6px]">
                  <FileText className="size-4" /> {questions.length} preguntas
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-[12px] sm:grid-cols-2 px-[22px] pt-[18px]">
              <div
                className="rounded-[12px] p-[14px]"
                style={{ background: "var(--coral-soft)" }}
              >
                <div className="text-[12px] font-medium" style={{ color: "var(--coral-text)" }}>Peso por pregunta</div>
                <div className="font-display text-[20px] font-medium mt-[2px]" style={{ color: "var(--coral-text)" }}>
                  {pesoPorPregunta}% cada una
                </div>
              </div>
              {evaluation.config?.porcentaje_aprobacion != null && (
                <div
                  className="rounded-[12px] p-[14px]"
                  style={{ background: "#ECFDF5" }}
                >
                  <div className="text-[12px] font-medium" style={{ color: "#065F46" }}>Puntaje para aprobar</div>
                  <div className="font-display text-[20px] font-medium mt-[2px]" style={{ color: "#065F46" }}>
                    {evaluation.config.porcentaje_aprobacion}% o más
                  </div>
                </div>
              )}
              {(evaluation.intentos_permitidos ?? 1) > 1 && (
                <div
                  className="rounded-[12px] p-[14px]"
                  style={{ background: "#EFF6FF" }}
                >
                  <div className="text-[12px] font-medium" style={{ color: "#1E40AF" }}>Intento</div>
                  <div className="font-display text-[20px] font-medium mt-[2px]" style={{ color: "#1E40AF" }}>
                    {currentAttempt} de {evaluation.intentos_permitidos}
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div
              className="mx-[22px] mt-[16px] rounded-[12px] p-[16px] text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="mb-[8px] font-mono text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: "var(--text-faint)" }}>
                Antes de comenzar
              </div>
              <ul className="flex flex-col gap-[5px]" style={{ color: "var(--muted-foreground)" }}>
                {[
                  "Asegúrate de tener una conexión estable.",
                  "Lee cada pregunta cuidadosamente antes de responder.",
                  "En preguntas de selección múltiple, marca todas las opciones correctas.",
                  "Solo dispones de un envío por intento.",
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-[8px]">
                    <span className="mt-[4px] size-[5px] shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-[12px] px-[22px] py-[22px] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-[6px]">
                {evaluation.categorias && evaluation.categorias.length > 0 ? (
                  evaluation.categorias.map((c: string) => (
                    <span
                      key={c}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px]"
                      style={{ background: "var(--surface-2)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                    >
                      <Tag className="size-3" /> {c}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Sin categorías</span>
                )}
              </div>
              {existingProgress ? (
                <div className="flex gap-[10px]">
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
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [lockedQuestions, setLockedQuestions] = useState<Set<string>>(
    () => new Set(Object.keys(initialState?.answers || {}))
  );
  const [showLockedMessage, setShowLockedMessage] = useState(false);
  const q = questions[i];
  const progress = ((i + 1) / questions.length) * 100;

  // Refs para que el intervalo del timer siempre acceda a los valores más recientes
  // sin necesitar estar en sus dependencias (evita reiniciar el countdown en cada respuesta)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  // Kept as a ref so the save effect doesn't depend on timeRemaining,
  // which changes every second and would trigger a DB write per tick.
  const timeRemainingRef = useRef(timeRemaining);
  timeRemainingRef.current = timeRemaining;

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

  // Save progress when the question index or answers change (2 s debounce).
  // timeRemaining is intentionally excluded from deps — it changes every second via
  // the timer and would cause a Supabase write per tick. We read the latest value
  // through timeRemainingRef at the moment the save actually fires.
  useEffect(() => {
    if (!userId || !code) return;

    const saveProgress = async () => {
      try {
        await evaluationProgressService.update(userId, code, {
          current_question_index: i,
          answers,
          time_remaining: timeRemainingRef.current,
        });
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    };

    const saveTimer = setTimeout(saveProgress, 2000);
    return () => clearTimeout(saveTimer);
  }, [i, answers, userId, code]);

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

  const isLocked = lockedQuestions.has(q.id);

  const lockCurrentIfAnswered = () => {
    const currentAnswers = answers[q.id];
    const hasCurrentAnswer = isMultipleChoice
      ? ((currentAnswers as string[]) || []).length > 0
      : currentAnswers !== undefined;
    if (hasCurrentAnswer && !lockedQuestions.has(q.id)) {
      setLockedQuestions(prev => new Set([...prev, q.id]));
    }
  };

  // Manejar selección de respuesta
  const handleSelectOption = (optionIndex: number) => {
    if (isLocked) {
      setShowLockedMessage(true);
      setTimeout(() => setShowLockedMessage(false), 3000);
      return;
    }
    if (isMultipleChoice) {
      const currentAnswers = (answers[q.id] as string[]) || [];
      const optionStr = optionIndex.toString();
      const newAnswers = currentAnswers.includes(optionStr)
        ? currentAnswers.filter(idx => idx !== optionStr)
        : [...currentAnswers, optionStr];
      setAnswers({ ...answers, [q.id]: newAnswers });
    } else {
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
    <AppShell>
      <PageHeader
        title={`Pregunta ${i + 1} de ${questions.length}`}
        actions={
          <div className="flex items-center gap-[10px]">
            {tiempoLimite && tiempoLimite > 0 && (
              <div
                className="flex items-center gap-[6px] rounded-full border px-[12px] py-[6px] font-mono text-[12px] font-bold"
                style={
                  isTimeWarning
                    ? { borderColor: "var(--destructive)", background: "var(--coral-soft)", color: "var(--coral-text)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }
                }
              >
                <Clock className="size-3.5" />
                {formatTime(timeRemaining)}
              </div>
            )}
            <div
              className="flex items-center gap-[6px] rounded-full border px-[12px] py-[6px] font-mono text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}
            >
              <FileText className="size-3.5" />
              {nombre}
            </div>
          </div>
        }
      />
      <div className="mx-auto max-w-[640px] flex flex-col gap-[20px]">
        {/* Progress bar */}
        <div>
          <div className="mb-[8px] flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
              Pregunta {i + 1} de {questions.length}
            </span>
            <span className="font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-[4px] overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "var(--accent)" }}
            />
          </div>
        </div>

        {/* Question card */}
        <div
          className="rounded-[20px] p-[22px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {q.contexto && (
            <div
              className="mb-[16px] rounded-[12px] p-[14px] text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              <div className="mb-[4px] font-mono text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: "var(--text-faint)" }}>
                Contexto
              </div>
              {q.contexto}
            </div>
          )}
          <div className="flex items-start gap-[10px] flex-wrap mb-[18px]">
            <h2 className="flex-1 text-[17px] font-medium leading-snug" style={{ color: "var(--foreground)" }}>
              {q.question_text}
            </h2>
            {isMultipleChoice && (
              <span
                className="shrink-0 rounded-full px-[10px] py-[3px] font-mono text-[9px] font-bold uppercase tracking-[.1em]"
                style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
              >
                Selección Múltiple
              </span>
            )}
          </div>
          <div className="flex flex-col gap-[10px]">
            {q.options.map((opt: string, idx: number) => {
              const isSelected = isMultipleChoice
                ? (answers[q.id] as string[] || []).includes(idx.toString())
                : answers[q.id] === idx.toString();

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={submitting}
                  className="flex w-full items-center gap-[14px] rounded-[12px] border px-[16px] py-[12px] text-left text-[14px] transition-all"
                  style={
                    isLocked
                      ? isSelected
                        ? { borderColor: "var(--accent)", background: "var(--coral-soft)", color: "var(--foreground)", cursor: "not-allowed", opacity: 0.85 }
                        : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted-foreground)", cursor: "not-allowed", opacity: 0.45 }
                      : isSelected
                        ? { borderColor: "var(--accent)", background: "var(--coral-soft)", color: "var(--foreground)" }
                        : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--foreground)", opacity: submitting ? 0.5 : 1 }
                  }
                >
                  <div
                    className="grid size-[26px] shrink-0 place-items-center rounded-[7px] font-mono text-[11px] font-bold"
                    style={
                      isSelected
                        ? { background: "var(--accent)", color: "#fff", border: "none" }
                        : { background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--muted-foreground)" }
                    }
                  >
                    {isMultipleChoice ? (
                      isSelected ? (
                        <CheckCircle className="size-[14px]" />
                      ) : (
                        <div className="size-[10px] rounded-full border-2 border-current" />
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
          {showLockedMessage && (
            <div
              className="mt-[10px] rounded-[10px] px-[14px] py-[10px] text-[13px] font-medium"
              style={{ background: "var(--coral-soft)", color: "var(--coral-text)", border: "1px solid var(--accent)" }}
            >
              Las respuestas marcadas no pueden ser modificadas.
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0 || submitting}
          >
            <ArrowLeft className="size-4" /> Anterior
          </Button>
          {i < questions.length - 1 ? (
            <Button onClick={() => setShowNextConfirm(true)} disabled={!hasAnswer || submitting}>
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
        open={showNextConfirm}
        title="¿Confirmar respuesta?"
        description="Una vez que avances, tu respuesta quedará bloqueada y no podrás modificarla. ¿Deseas continuar?"
        confirmLabel="Sí, continuar"
        onConfirm={() => { setShowNextConfirm(false); lockCurrentIfAnswered(); setI(i + 1); }}
        onCancel={() => setShowNextConfirm(false)}
      />
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
