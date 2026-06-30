import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
      setError(t('setup.emailRequired'));
      return;
    }
    if (password.length < 6) {
      setError(t('setup.minChars'));
      return;
    }
    if (password !== confirm) {
      setError(t('setup.mismatch'));
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
        setError(data.error ?? t('setup.unexpectedError'));
        return;
      }
      setDone(true);
      setTimeout(() => nav({ to: "/dashboard" }), 1800);
    } catch {
      setError(t('setup.connectionError'));
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
              {t('common.appName')}
            </span>
            <span
              className="mt-0.5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t('common.appSubtitle')}
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
                {t('setup.checking')}
              </p>
            </div>
          ) : alreadyConfigured ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <ShieldCheck className="size-10" style={{ color: "#10B981" }} />
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  {t('setup.alreadyConfigured')}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {t('setup.alreadyConfiguredDesc')}
                </p>
              </div>
              <a
                href="/login"
                className="mt-2 inline-flex items-center justify-center rounded-[10px] px-5 py-2.5 text-sm font-medium transition-colors"
                style={{ background: "#333333", color: "#fff" }}
              >
                {t('setup.goToLogin')}
              </a>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="size-10" style={{ color: "#10B981" }} />
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  {t('setup.adminCreated')}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {t('setup.redirecting')}
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
                  {t('setup.badge')}
                </div>
                <h1 className="font-display text-[32px] font-medium leading-[1.25] tracking-[-0.01em]" style={{ color: "var(--foreground)" }}>
                  {t('setup.formTitle')}
                </h1>
                <p className="mt-1.5 text-[16px] font-normal leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {t('setup.formDesc')}
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

                <Field label={t('setup.fullName')}>
                  <input
                    type="text"
                    placeholder={t('setup.namePlaceholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label={t('setup.email')} required>
                  <input
                    type="email"
                    placeholder={t('setup.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    required
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label={t('setup.password')} required>
                  <input
                    type="password"
                    placeholder={t('setup.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </Field>

                <Field label={t('setup.confirmPassword')} required>
                  <input
                    type="password"
                    placeholder={t('setup.confirmPasswordPlaceholder')}
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
                  {submitting ? t('setup.creating') : t('setup.createButton')}
                </button>
              </form>
            </>
          )}
        </div>

        <p
          className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t('setup.footer')}
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
