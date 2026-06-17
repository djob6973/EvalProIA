import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Status = "live" | "completed" | "in_progress" | "draft" | "closed" | "queued";

const styles: Record<Status, CSSProperties> = {
  live: { background: "var(--coral-soft)", color: "var(--coral-text)" },
  completed: { background: "#dcfce7", color: "#166534" },
  in_progress: { background: "#fef9c3", color: "#854d0e" },
  draft: { background: "#fef9c3", color: "#854d0e" },
  closed: { background: "var(--surface-2)", color: "var(--muted-foreground)" },
  queued: { background: "var(--surface-2)", color: "var(--muted-foreground)" },
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
        "inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[11px] font-bold",
        className,
      )}
      style={styles[status]}
    >
      <span className="inline-block size-[6px] rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
