import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

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
  const nav = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const { signIn, loading, user, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const role = profile?.role;
      nav({ to: role === "admin" || role === "both" ? "/dashboard" : "/participant" });
    }
  }, [user, profile, loading, nav]);

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
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const userRole = data?.profile?.role || "participant";
    const defaultTo = userRole === "admin" || userRole === "both" ? "/dashboard" : "/participant";
    const destination =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : defaultTo;
    nav({ to: destination as any });
  }

  return (
    <div className="grid min-h-screen w-full animate-in fade-in duration-300 lg:grid-cols-2">
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
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Contraseña
              </Label>
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
        </div>

        <div className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/40">
          © 2026 EvalPro
        </div>
      </div>
    </div>
  );
}
