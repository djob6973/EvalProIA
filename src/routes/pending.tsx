import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Acceso pendiente — EvalPro" }] }),
  component: PendingPage,
});

function PendingPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "Pendiente") {
      navigate({ to: "/dashboard" });
    }
  }, [profile, loading, navigate]);

  async function handleContinueAsParticipant() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch("/api/self-activate", { method: "POST" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al activar cuenta");
      }
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e.message);
      setActivating(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
        style={{ background: "#ED5650" }}
      >
        <Brain className="size-8 text-white" strokeWidth={1.5} />
      </div>

      {/* Brand */}
      <div className="mb-1 text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
        EvalPro
      </div>
      <div
        className="mb-8 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--muted-foreground)" }}
      >
        Sistema de Evaluación
      </div>

      {/* Card */}
      <div
        className="flex max-w-sm flex-col items-center gap-5 rounded-2xl border px-8 py-8"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "rgba(237,86,80,0.1)" }}
        >
          <Clock className="size-6" style={{ color: "#ED5650" }} strokeWidth={1.5} />
        </div>

        <div className="text-center">
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            Cuenta pendiente de aprobación
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Un administrador revisará tu acceso y te asignará un rol en breve.
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Si deseas puedes continuar con el rol{" "}
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Participante</span>,
            por favor haz clic en continuar.
          </p>

          {profile?.email && (
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Sesión iniciada como{" "}
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{profile.email}</span>
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          onClick={handleContinueAsParticipant}
          disabled={activating}
          className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#ED5650" }}
        >
          {activating ? "Activando..." : "Continuar como Participante"}
        </button>
      </div>

      <p className="mt-10 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
        EvalPro · Evaluaciones Inteligentes
      </p>
    </div>
  );
}
