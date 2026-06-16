import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { Brain } from "lucide-react";
import { NavigationProgress } from "@/components/NavigationProgress";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with branding */}
      <header className="flex items-center gap-2.5 border-b border-border px-8 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">EvalPro</span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sistema de Evaluación
            </span>
          </div>
        </Link>
      </header>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm text-center">
          <div className="mb-6 inline-block rounded-md bg-accent/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-accent">
            Error 404
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Página no encontrada
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            La ruta que buscas no existe o fue movida. Verifica la URL o vuelve al inicio.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ir al inicio
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Volver atrás
            </button>
          </div>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            EvalPro · Infraestructura segura de evaluación
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal. Puedes intentar recargar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

const PUBLIC_PATHS = ["/login"];

// Module-level cache — avoids hitting the DB on every navigation.
// Invalidated on sign-out (userId changes) or after 5 minutes.
let profileCache: { userId: string; expiresAt: number } | null = null;
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    // Only runs in the browser (supabase client is null on SSR)
    if (!supabase) return;
    if (PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      profileCache = null;
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname + location.searchStr },
      });
    }

    // Skip the DB round-trip if we verified this user recently
    const now = Date.now();
    if (profileCache?.userId === session.user.id && now < profileCache.expiresAt) {
      return;
    }

    // Verify the user's profile still exists — catches deleted users whose JWT hasn't expired yet
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile) {
      profileCache = null;
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }

    profileCache = { userId: session.user.id, expiresAt: now + PROFILE_CACHE_TTL };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EvalPro — Evaluación de Conocimiento con IA" },
      { name: "description", content: "Plataforma empresarial de evaluación que convierte documentos en evaluaciones calibradas usando IA." },
      { property: "og:title", content: "EvalPro — Evaluación de Conocimiento con IA" },
      { property: "og:description", content: "Plataforma empresarial de evaluación que convierte documentos en evaluaciones calibradas usando IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProgress />
      <Outlet />
    </QueryClientProvider>
  );
}
