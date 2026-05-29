import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — EvalPro" },
      { name: "description", content: "Inicia sesión en EvalPro, el sistema de evaluación de conocimiento con IA." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { signIn, loading, resetPassword, user, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      const role = profile?.role;
      nav({ to: role === "admin" || role === "both" ? "/dashboard" : "/participant" });
    }
  }, [user, profile, loading, nav]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!email || !password) {
      setError("Por favor, ingresa email y contraseña");
      setIsSubmitting(false);
      return;
    }

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      if (signInError.message.includes("Invalid login credentials")) {
        setError("Email o contraseña incorrectos. Verifica tus credenciales en Supabase.");
      } else if (signInError.message.includes("Email not confirmed")) {
        setError("Por favor, confirma tu email antes de iniciar sesión.");
      } else {
        setError(signInError.message);
      }
      setIsSubmitting(false);
      return;
    }

    // Fetch user profile to determine role
    const { data: profile } = await supabase
      ?.from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single() || { data: null };

    const userRole = profile?.role || 'participant';
    nav({ to: userRole === "admin" ? "/dashboard" : "/participant" });
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setIsResetting(true);

    if (!resetEmail) {
      setResetError("Por favor, ingresa tu email");
      setIsResetting(false);
      return;
    }

    const { error } = await resetPassword(resetEmail);

    if (error) {
      setResetError(error.message);
      setIsResetting(false);
      return;
    }

    setResetSuccess(true);
    setIsResetting(false);
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="flex flex-col p-8 md:p-12">
        <Link to="/dashboard" className="mb-16 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">EvalPro</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sistema de Evaluación v4
            </span>
          </div>
        </Link>

        <div className="mx-auto w-full max-w-sm flex-1 flex flex-col justify-center">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicia sesión para gestionar evaluaciones, generar preguntas y revisar resultados.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Correo
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="tu@empresa.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Contraseña
                </Label>
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="text-xs text-accent hover:underline"
                >
                  ¿Olvidaste?
                </button>
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          {showResetPassword && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
                <h3 className="mb-4 text-lg font-semibold">Recuperar contraseña</h3>
                {resetSuccess ? (
                  <div className="space-y-4">
                    <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                      Se ha enviado un email de recuperación a {resetEmail}. Revisa tu bandeja de entrada.
                    </div>
                    <Button
                      onClick={() => {
                        setShowResetPassword(false);
                        setResetSuccess(false);
                        setResetEmail("");
                      }}
                      className="w-full"
                    >
                      Cerrar
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    {resetError && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {resetError}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="tu@empresa.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={isResetting}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowResetPassword(false);
                          setResetEmail("");
                          setResetError(null);
                        }}
                        disabled={isResetting}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isResetting} className="flex-1">
                        {isResetting ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            EvalPro · Infraestructura segura de evaluación
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/50">
          SISTEMA // EMPRESARIAL
        </div>

        <div className="space-y-6 text-primary-foreground">
          <div className="inline-block rounded bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
            Impulsado por GPT-4
          </div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Convierte documentación en evaluaciones estructuradas en segundos.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/60">
            EvalPro extrae conocimiento de cualquier documento y genera evaluaciones calibradas —
            listas para enviar a tus participantes.
          </p>

          <div className="grid grid-cols-3 gap-4 border-t border-primary-foreground/10 pt-8">
            {[
              { v: "12.4K", l: "Usuarios" },
              { v: "45K+", l: "Preguntas" },
              { v: "98.2%", l: "Disponibilidad" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-xl font-bold">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-primary-foreground/50">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/40">
          © 2026 EvalPro
        </div>
      </div>
    </div>
  );
}
