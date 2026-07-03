import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";

interface LayoutContextValue {
  setMobileOpen: (open: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({ setMobileOpen: () => {} });
export const useLayout = () => useContext(LayoutContext);

interface AppShellProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  showHeader?: boolean;
}

function SplashScreen() {
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

      {/* Marketing tagline */}
      <p
        className="max-w-sm text-[15px] leading-relaxed"
        style={{ color: "var(--muted-foreground)" }}
      >
        Convierte tus documentos en evaluaciones inteligentes para capacitar y medir el conocimiento de tu equipo.
      </p>

      {/* Spinner */}
      <div className="mt-10">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "#ED5650", borderTopColor: "transparent" }}
        />
      </div>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ep-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "dark" || (!stored && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ep-theme", next ? "dark" : "light");
  };

  if (loading) return <SplashScreen />;

  // In production the oauth2-proxy guarantees a user is always present.
  // In local dev without DEV_USER_EMAIL the user will be null — render nothing
  // so the beforeLoad redirect to /pending can handle navigation.
  if (!user) return null;

  return (
    <LayoutContext.Provider value={{ setMobileOpen }}>
      <NotificationProvider>
        <div className="min-h-screen w-full" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <AppSidebar
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            isDark={isDark}
            toggleTheme={toggleTheme}
          />
          <main className="md:pl-[272px]">
            <div className="overflow-y-auto">
              <div
                key={pathname}
                className="mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ maxWidth: "1180px", padding: "32px" }}
              >
                {children}
              </div>
            </div>
          </main>
        </div>
      </NotificationProvider>
    </LayoutContext.Provider>
  );
}
