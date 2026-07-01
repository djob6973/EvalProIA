import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronsRight, Mail, Lock, Eye, EyeOff, Check, ArrowLeft } from "lucide-react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
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
    setConfirmPassword("");
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
      if (password !== confirmPassword) {
        setError(t('login.passwordMismatch'));
        setIsSubmitting(false);
        return;
      }
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
    t('login.feature4'),
  ];

  return (
    <div className="grid min-h-screen w-full animate-in fade-in duration-300 lg:grid-cols-2">
      {/* ── Left panel ─────────────────────────────────────────── */}
      <div className="flex flex-col bg-[#F5F5F5] dark:bg-background p-6 sm:p-8 md:p-12">
        {/* Logo / Back */}
        {isLogin ? (
          <Link to="/dashboard" className="mb-10 flex items-center gap-2.5 sm:mb-16">
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
        ) : (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="mb-10 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground sm:mb-16"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            {t('login.back')}
          </button>
        )}

        {/* Form area */}
        <div className="mx-auto w-full max-w-[360px] flex-1 flex flex-col justify-start">
          <h1 className="font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground sm:text-[26px]">
            {isLogin ? t('login.welcome') : t('login.createAccount')}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {isLogin ? t('login.loginDesc') : t('login.registerDesc')}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
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
                  className="h-11 rounded-xl border-transparent bg-white shadow-sm"
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
                  className="h-11 rounded-xl border-transparent bg-white pl-9 shadow-sm"
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
                  className="h-11 rounded-xl border-transparent bg-white pl-9 pr-9 shadow-sm"
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

            {/* Confirm password — register only */}
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
                  {t('login.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('login.passwordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-transparent bg-white shadow-sm"
                />
              </div>
            )}

            {/* Remember device */}
            {isLogin && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberDevice}
                  onClick={() => setRememberDevice((v) => !v)}
                  className={
                    "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] transition-colors " +
                    (rememberDevice ? "bg-[#ED5650]" : "border border-input bg-white")
                  }
                >
                  {rememberDevice && <Check className="size-3 text-white" strokeWidth={3} />}
                </button>
                <span className="text-[13px] text-muted-foreground">
                  {t('login.rememberDevice')}
                </span>
              </label>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full rounded-full py-3.5 text-[14px] font-semibold"
              style={{ background: "#F09692", color: "#fff" }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isLogin ? t('login.loggingIn') : t('login.creating')
                : isLogin ? t('login.loginButton') : t('login.createAccount')}
            </Button>

          </form>

          {/* Switch mode */}
          {isLogin && (
            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              {t('login.noAccount')}{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[#ED5650]"
              >
                {t('login.register')}
              </button>
            </p>
          )}
        </div>

        <p className="text-left font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {t('login.footer')}
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-start px-8 pb-8 pt-12 lg:px-12 lg:pb-12 xl:pt-20"
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
        <div className="relative font-mono text-[10px] uppercase tracking-[.2em] text-white/40 mb-6 lg:mb-10">
          {t('login.systemLabel')}
        </div>

        {/* Hero content */}
        <div className="relative max-w-[420px] space-y-4 xl:max-w-[560px]">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(237,86,80,.18)", color: "#ED5650" }}
          >
            <span className="size-1.5 rounded-full bg-[#ED5650]" />
            {t('login.poweredBy')}
          </div>

          <h2 className="max-w-full text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-white xl:max-w-[480px] xl:text-[30px]" style={{ whiteSpace: 'pre-line' }}>
            {t('login.tagline')}
          </h2>

          <div className="h-[3px] w-10 rounded-full bg-[#ED5650]" />

          <p className="max-w-full text-[13px] leading-relaxed text-white/55 xl:max-w-[360px]">
            {t('login.description')}
          </p>

          <ul className="space-y-3 pt-1">
            {FEATURES.map((feat, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 font-bold text-[#ED5650] text-[13px]">{">>"}</span>
                <span className="text-[13px] text-white/70">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative mt-auto font-mono text-[10px] uppercase tracking-widest text-white/30">
          {t('login.copyright')}
        </div>
      </div>
    </div>
  );
}
