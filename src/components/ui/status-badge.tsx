import { cn } from "@/lib/utils";

type Status = "live" | "completed" | "in_progress" | "draft" | "closed" | "queued";

const styles: Record<Status, string> = {
  live: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-amber-100 text-amber-700",
  draft: "bg-amber-100 text-amber-700",
  closed: "bg-slate-100 text-slate-500",
  queued: "bg-slate-100 text-slate-500",
};

const labels: Record<Status, string> = {
  live: "ACTIVA",
  completed: "COMPLETADA",
  in_progress: "EN CURSO",
  draft: "BORRADOR",
  closed: "CERRADA",
  queued: "EN COLA",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wider",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
