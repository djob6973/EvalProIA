import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

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

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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

  return (
    <div className="grid min-h-screen w-full animate-in fade-in duration-300 lg:grid-cols-2">
      <div className="flex flex-col p-8 md:p-12">
        <Link to="/dashboard" className="mb-16 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md" style={{ background: "#333333", color: "#fff" }}>
            <Brain className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">EvalPro</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t('login.version')}
            </span>
          </div>
        </Link>

        <div className="mx-auto w-full max-w-sm flex-1 flex flex-col justify-center">
          <h1 className="font-display text-[32px] font-medium leading-[1.25] tracking-[-0.01em]" style={{ color: "var(--foreground)" }}>
            {isLogin ? t('login.welcome') : t('login.createAccount')}
          </h1>
          <p className="mt-2 text-[16px] font-normal" style={{ color: "var(--muted-foreground)" }}>
            {isLogin ? t('login.loginDesc') : t('login.registerDesc')}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('login.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('login.password')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? isLogin ? t('login.loggingIn') : t('login.creating')
                : isLogin ? t('login.loginButton') : t('login.createAccount')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isLogin ? t('login.noAccount') : t('login.haveAccount')}{" "}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="font-medium underline underline-offset-4"
              style={{ color: "var(--foreground)" }}
            >
              {isLogin ? t('login.register') : t('login.loginLink')}
            </button>
          </p>

          <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('login.footer')}
          </p>
        </div>
      </div>

      <div
        className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "#333333", color: "#F1F1F1" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          {t('login.systemLabel')}
        </div>

        <div className="space-y-6">
          <div
            className="inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(237,86,80,.2)", color: "#ED5650" }}
          >
            {t('login.poweredBy')}
          </div>
          <h2 className="max-w-md text-3xl font-bold leading-tight text-white">
            {t('login.tagline')}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/60">
            {t('login.description')}
          </p>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          {t('login.copyright')}
        </div>
      </div>
    </div>
  );
}
