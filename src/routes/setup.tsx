import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Configuración inicial — EvalPro" },
      { name: "description", content: "Crea el primer administrador de EvalPro." },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const nav = useNavigate();

  const [checking, setChecking] = useState(true);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data: { needed: boolean }) => {
        if (!data.needed) setAlreadyConfigured(true);
      })
      .catch(() => setAlreadyConfigured(false))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("El email y la contraseña son obligatorios.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Ocurrió un error inesperado.");
        return;
      }
      setDone(true);
      setTimeout(() => nav({ to: "/dashboard" }), 1800);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-[10px]"
            style={{ background: "#333333", color: "#fff" }}
          >
            <Brain className="size-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              EvalPro
            </span>
            <span
              className="mt-0.5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              Sistema de Evaluación
            </span>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "32px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Verificando estado del sistema…
              </p>
            </div>
          ) : alreadyConfigured ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <ShieldCheck className="size-10" style={{ color: "#10B981" }} />
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Sistema ya configurado
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Ya existe al menos un administrador. Esta página no está disponible.
                </p>
              </div>
              <a
                href="/login"
                className="mt-2 inline-flex items-center justify-center rounded-[10px] px-5 py-2.5 text-sm font-medium transition-colors"
                style={{ background: "#333333", color: "#fff" }}
              >
                Ir al login
              </a>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="size-10" style={{ color: "#10B981" }} />
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  ¡Administrador creado!
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Redirigiendo al panel…
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
                >
                  <ShieldCheck className="size-3" />
                  Configuración inicial
                </div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                  Crear administrador
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  Esta página solo está disponible cuando no hay usuarios registrados. Crea la cuenta administradora del sistema.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <div
                    className="rounded-[10px] p-3 text-sm"
                    style={{ background: "rgba(237,86,80,.12)", color: "var(--coral-text)" }}
                  >
                    {error}
                  </div>
                )}

                <Field label="Nombre completo">
                  <input
                    type="text"
                    placeholder="Ej. David Ortega"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label="Correo electrónico" required>
                  <input
                    type="email"
                    placeholder="admin@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    required
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label="Contraseña" required>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label="Confirmar contraseña" required>
                  <input
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={submitting}
                    required
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ background: "#333333", color: "#fff" }}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Creando cuenta…" : "Crear administrador"}
                </button>
              </form>
            </>
          )}
        </div>

        <p
          className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          EvalPro · Configuración del sistema
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  padding: "8px 12px",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="block font-mono text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
        {required && <span style={{ color: "var(--coral-text)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
