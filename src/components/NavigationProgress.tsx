import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

type Phase = "hidden" | "loading" | "done";

export function NavigationProgress() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  const [phase, setPhase] = useState<Phase>("hidden");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (isPending) {
      setPhase("loading");
    } else {
      setPhase((prev) => {
        if (prev === "loading") {
          timer.current = setTimeout(() => setPhase("hidden"), 350);
          return "done";
        }
        return prev;
      });
    }
    return () => clearTimeout(timer.current);
  }, [isPending]);

  if (phase === "hidden") return null;

  if (phase === "done") {
    return (
      <div className="fixed left-0 right-0 top-0 z-[100] h-[2px] bg-accent opacity-0 transition-opacity duration-300" />
    );
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[100] h-[2px] overflow-hidden">
      <div className="absolute h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
    </div>
  );
}
