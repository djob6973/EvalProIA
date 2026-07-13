import { useTranslation } from "react-i18next";
import { Sparkles, CircleCheck, TriangleAlert, BookOpen, ListChecks, Target } from "lucide-react";
import { ResultFeedback, MasteryLevel } from "@/lib/services/evaluations";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const MASTERY_DOT: Record<MasteryLevel, string> = {
  alto: "bg-green-500",
  medio: "bg-amber-500",
  bajo: "bg-red-500",
};

const MASTERY_TEXT: Record<MasteryLevel, string> = {
  alto: "text-green-700 dark:text-green-400",
  medio: "text-amber-700 dark:text-amber-400",
  bajo: "text-red-700 dark:text-red-400",
};

export function ResultFeedbackCard({ feedback }: { feedback: ResultFeedback }) {
  const { t } = useTranslation();
  const masteryLabel: Record<MasteryLevel, string> = {
    alto: t('myResults.feedbackMasteryHigh'),
    medio: t('myResults.feedbackMasteryMedium'),
    bajo: t('myResults.feedbackMasteryLow'),
  };
  const temasParaRepasar = feedback.dominio.filter((d) => d.nivel !== 'alto');

  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <Accordion type="single" collapsible>
        <AccordionItem value="feedback" className="border-b-0">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="flex flex-col items-start gap-1 text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-[#ED5650]" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-[#ED5650]">
                  {t('myResults.feedbackBadge')}
                </span>
              </div>
              <p className="font-display text-[17px] font-medium text-[var(--foreground)]">
                {t('myResults.feedbackTitle')}
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">

      {feedback.resumen && (
        <p className="mb-5 text-[13.5px] leading-relaxed text-[var(--muted-foreground)]">
          {feedback.resumen}
        </p>
      )}

      {feedback.fortalezas.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <CircleCheck className="size-4 text-green-600 dark:text-green-400" />
            <span className="text-[13px] font-medium text-green-700 dark:text-green-400">
              {t('myResults.feedbackStrengths')}
            </span>
          </div>
          <div className="space-y-2.5">
            {feedback.fortalezas.map((f, i) => (
              <div key={i}>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{f.competencia}</p>
                {f.detalles.length > 0 && (
                  <ul className="ml-1 list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                    {f.detalles.map((d, j) => <li key={j}>{d}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.mejoras.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
              {t('myResults.feedbackImprovements')}
            </span>
          </div>
          <div className="space-y-3">
            {feedback.mejoras.map((m, i) => (
              <div key={i}>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{m.competencia}</p>
                {m.explicacion && (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                    {m.explicacion}
                  </p>
                )}
                {m.practica && (
                  <p className="mt-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                    <span className="font-medium">{t('myResults.feedbackPracticeLabel')}:</span> {m.practica}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.dominio.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <ListChecks className="size-4 text-[var(--muted-foreground)]" />
            <span className="text-[13px] font-medium text-[var(--foreground)]">
              {t('myResults.feedbackMastery')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {feedback.dominio.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px]"
              >
                <span className={`size-1.5 rounded-full ${MASTERY_DOT[d.nivel]}`} />
                <span className="text-[var(--foreground)]">{d.competencia}</span>
                <span className={`font-medium ${MASTERY_TEXT[d.nivel]}`}>— {masteryLabel[d.nivel]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {temasParaRepasar.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[13px] font-medium text-blue-700 dark:text-blue-400">
              {t('myResults.feedbackTopics')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {temasParaRepasar.map((d, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[12px] text-blue-700 dark:text-blue-400"
              >
                {d.competencia}
              </span>
            ))}
          </div>
        </div>
      )}

      {feedback.recomendaciones.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Target className="size-4 text-[var(--muted-foreground)]" />
            <span className="text-[13px] font-medium text-[var(--foreground)]">
              {t('myResults.feedbackRecommendations')}
            </span>
          </div>
          <ul className="ml-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            {feedback.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {feedback.cierre && (
        <div className="rounded-lg border-l-[3px] border-[#ED5650] bg-[#ED5650]/5 px-3.5 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-[#ED5650]">
            {t('myResults.feedbackNextGoal')}
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{feedback.cierre}</p>
        </div>
      )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
