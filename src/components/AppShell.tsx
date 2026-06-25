import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";

interface LayoutContextValue {
  setMobileOpen: (open: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({ setMobileOpen: () => {} });
export const useLayout = () => useContext(LayoutContext);

interface AppShellProps {
  children: ReactNode;
  // Legacy props accepted but no longer rendered — use PageHeader inside children instead
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  showHeader?: boolean;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!user) return null;

  return (
    <LayoutContext.Provider value={{ setMobileOpen }}>
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
    </LayoutContext.Provider>
  );
}
