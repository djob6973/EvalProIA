import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
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

const SPLASH_COLS = 9;
const SPLASH_ROWS = 7;

function SplashScreen() {
  const { settings } = useSystemSettings();
  const brandLogo = settings.brand_logo ?? null;

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "#111111" }}
    >
      {/* Tiled Brain icon background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${SPLASH_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${SPLASH_ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: SPLASH_COLS * SPLASH_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            <Brain className="size-10 text-[#ED5650]" strokeWidth={1} style={{ opacity: 0.18 }} />
          </div>
        ))}
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo + wordmark */}
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={brandLogo ? { background: "transparent" } : { background: "#ED5650" }}
          >
            {brandLogo
              ? <img src={brandLogo} alt="Logo" className="h-10 w-10 object-contain" />
              : <Brain className="size-5 text-white" strokeWidth={1.5} />}
          </div>
          <div className="text-left">
            <div className="text-lg font-bold leading-none text-white">EvalPro</div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-white/40">
              Sistema de Evaluación
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p className="max-w-[340px] text-[22px] font-bold leading-snug text-white">
          Convierte tus documentos en evaluaciones inteligentes para capacitar y medir el conocimiento de tu equipo.
        </p>

        {/* Accent divider */}
        <div
          className="mt-6 h-[3px] w-16 rounded-full"
          style={{ background: "#ED5650" }}
        />

        {/* Spinner */}
        <div className="mt-8">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2"
            style={{ borderColor: "rgba(237,86,80,0.3)", borderTopColor: "#ED5650" }}
          />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { user, profile, loading } = useAuth();
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

  // Pendiente users are redirected to /pending by beforeLoad.
  // Return null here to avoid flashing the app shell during that redirect.
  if (!user || profile?.role === 'Pendiente') return null;

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
