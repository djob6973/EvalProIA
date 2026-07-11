import { useTranslation } from "react-i18next";
import { Sparkles, CircleCheck, TriangleAlert, BookOpen } from "lucide-react";
import { ResultFeedback } from "@/lib/services/evaluations";

export function ResultFeedbackCard({ feedback }: { feedback: ResultFeedback }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="size-3.5 text-[#ED5650]" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-[#ED5650]">
          {t('myResults.feedbackBadge')}
        </span>
      </div>
      <p className="mb-4 font-display text-[17px] font-medium text-[var(--foreground)]">
        {t('myResults.feedbackTitle')}
      </p>

      {feedback.positivos.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <CircleCheck className="size-4 text-green-600 dark:text-green-400" />
            <span className="text-[13px] font-medium text-green-700 dark:text-green-400">
              {t('myResults.feedbackPositives')}
            </span>
          </div>
          <ul className="ml-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            {feedback.positivos.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {feedback.negativos.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
              {t('myResults.feedbackNegatives')}
            </span>
          </div>
          <ul className="ml-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            {feedback.negativos.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {feedback.temas.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[13px] font-medium text-blue-700 dark:text-blue-400">
              {t('myResults.feedbackTopics')}
            </span>
          </div>
          {feedback.temas_intro && (
            <p className="mb-2.5 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
              {feedback.temas_intro}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {feedback.temas.map((tema, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[12px] text-blue-700 dark:text-blue-400"
              >
                {tema}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
