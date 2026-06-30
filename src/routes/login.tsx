import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronsRight, Mail, Lock, Eye, EyeOff, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useSystemSettings } from "@/hooks/useSystemSettings";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — EvalPro" },
      { name: "description", content: "Inicia sesión en EvalPro, el sistema de evaluación de conocimiento con IA." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const { signIn, loading, user, profile } = useAuth();
  const { settings } = useSystemSettings();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const role = profile?.role;
      nav({ to: role !== "participant" ? "/dashboard" : "/participant" });
    }
  }, [user, profile, loading, nav]);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setEmail("");
    setPassword("");
    setFullName("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!email || !password) {
      setError(t('login.fillFields'));
      setIsSubmitting(false);
      return;
    }

    if (mode === "register") {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName: fullName || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t('login.errorCreating'));
          setIsSubmitting(false);
          return;
        }
        nav({ to: "/participant" });
      } catch {
        setError(t('login.connectionError'));
        setIsSubmitting(false);
      }
      return;
    }

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const userRole = data?.profile?.role || "participant";
    const defaultTo = userRole !== "participant" ? "/dashboard" : "/participant";
    const destination =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : defaultTo;
    nav({ to: destination as any });
  }

  const isLogin = mode === "login";

  const FEATURES = [
    t('login.feature1'),
    t('login.feature2'),
    t('login.feature3'),
  ];

  return (
    <div className="grid min-h-screen w-full animate-in fade-in duration-300 lg:grid-cols-2">
      {/* ── Left panel ─────────────────────────────────────────── */}
      <div className="flex flex-col bg-[#F5F5F5] dark:bg-background p-8 md:p-12">
        {/* Logo */}
        <Link to="/dashboard" className="mb-16 flex items-center gap-2.5">
          {settings.brand_logo ? (
            <img
              src={settings.brand_logo}
              alt="Logo"
              className="h-9 max-w-[80px] shrink-0 object-contain"
            />
          ) : (
            <div
              className="flex size-9 items-center justify-center rounded-[10px]"
              style={{ background: "#1C1C1E", color: "#fff" }}
            >
              <ChevronsRight className="size-4" strokeWidth={2.5} />
            </div>
          )}
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">EvalPro</span>
            <span className="mt-[3px] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {t('login.version')}
            </span>
          </div>
        </Link>

        {/* Form area */}
        <div className="mx-auto w-full max-w-[360px] flex-1 flex flex-col justify-center">
          <h1 className="font-display text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
            {isLogin ? t('login.welcome') : t('login.createAccount')}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {isLogin ? t('login.loginDesc') : t('login.registerDesc')}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Full name — register only */}
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                  {t('login.fullName')}
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                {t('login.corpEmail')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px] text-muted-foreground" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                  {t('login.password')}
                </Label>
                {isLogin && (
                  <button
                    type="button"
                    className="text-[12px] font-medium text-[#ED5650] hover:underline"
                  >
                    {t('login.forgotPassword')}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px] text-muted-foreground" strokeWidth={1.5} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="size-[15px]" strokeWidth={1.5} />
                    : <Eye className="size-[15px]" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Remember device */}
            {isLogin && (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-[#ED5650]"
                />
                <span className="text-[13px] text-muted-foreground">
                  {t('login.rememberDevice')}
                </span>
              </label>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full rounded-full py-5 text-[14px] font-semibold"
              style={{ background: "#ED5650", color: "#fff" }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isLogin ? t('login.loggingIn') : t('login.creating')
                : isLogin ? t('login.loginButton') : t('login.createAccount')}
            </Button>

            {/* SSO divider + button — login only */}
            {isLogin && (
              <>
                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[12px] text-muted-foreground">{t('login.or')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-transparent py-[10px] text-[13px] font-medium text-foreground transition hover:bg-accent"
                >
                  <Building2 className="size-[15px]" strokeWidth={1.5} />
                  {t('login.ssoButton')}
                </button>
              </>
            )}
          </form>

          {/* Switch mode */}
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            {isLogin ? t('login.noAccount') : t('login.haveAccount')}{" "}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="font-semibold underline underline-offset-4 text-foreground"
            >
              {isLogin ? t('login.register') : t('login.loginLink')}
            </button>
          </p>

          <p className="mt-10 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {t('login.footer')}
          </p>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-12"
        style={{ background: "#1C1C1E", color: "#F1F1F1" }}
      >
        {/* Chevron pattern background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
          {Array.from({ length: 7 }).map((_, row) => (
            <div key={row} className="flex" style={{ marginTop: row === 0 ? 80 : 0 }}>
              {Array.from({ length: 5 }).map((_, col) => (
                <span
                  key={col}
                  className="font-bold text-white/[0.035]"
                  style={{ fontSize: 120, lineHeight: 1.1, letterSpacing: '-0.02em' }}
                >
                  »
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Top label */}
        <div className="relative font-mono text-[10px] uppercase tracking-[.2em] text-white/40">
          {t('login.systemLabel')}
        </div>

        {/* Center content */}
        <div className="relative space-y-6">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(237,86,80,.18)", color: "#ED5650" }}
          >
            <span className="size-1.5 rounded-full bg-[#ED5650]" />
            {t('login.poweredBy')}
          </div>

          <h2 className="max-w-[480px] text-[48px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
            {t('login.tagline')}
          </h2>

          <div className="h-[3px] w-10 rounded-full bg-[#ED5650]" />

          <p className="max-w-[320px] text-[14px] leading-relaxed text-white/55">
            {t('login.description')}
          </p>

          <ul className="mt-2 space-y-3">
            {FEATURES.map((feat, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 font-bold text-[#ED5650] text-[13px]">{">>"}</span>
                <span className="text-[13px] text-white/70">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative font-mono text-[10px] uppercase tracking-widest text-white/30">
          {t('login.copyright')}
        </div>
      </div>
    </div>
  );
}
