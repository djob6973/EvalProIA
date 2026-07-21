import { CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export function getDificultadClass(dificultad: string): string {
  const d = (dificultad || "").toLowerCase();
  if (d.includes("fácil") || d.includes("facil") || d === "bajo")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (d.includes("medio") || d === "intermedio")
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (d.includes("difícil") || d.includes("dificil") || d === "alto")
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return "bg-secondary text-muted-foreground";
}

export function classifyAnswer(
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

export function QuestionResultCard({
  question,
  userAnswer,
  index,
  showOptions = true,
  showSelectedAnswer = true,
  showCorrectAnswer = true,
  showJustification = true,
}: {
  question: any;
  userAnswer: string | string[] | undefined;
  index: number;
  showOptions?: boolean;
  showSelectedAnswer?: boolean;
  showCorrectAnswer?: boolean;
  showJustification?: boolean;
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

          {showOptions && (
            <div className="space-y-1">
              {question.options.map((option: string, oIndex: number) => {
                const isSelected = showSelectedAnswer && userAnswers.includes(String(oIndex));
                const isOptionCorrect = showCorrectAnswer && correctAnswers.includes(String(oIndex));
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
          )}

          {showSelectedAnswer && showCorrectAnswer && isPartial && (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t('evalResults.partialDetail', { correct: selectedCorrectCount, total: correctAnswers.length })}
            </p>
          )}

          {showJustification && question.justificacion && (
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
