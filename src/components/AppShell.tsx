import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Menu } from "lucide-react";

interface LayoutContextValue {
  setMobileOpen: (open: boolean) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({ setMobileOpen: () => {} });
export const useLayout = () => useContext(LayoutContext);

interface AppShellProps {
  breadcrumb: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
  showHeader?: boolean;
}

export function AppShell({ breadcrumb, actions, children, showHeader = true }: AppShellProps) {
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
          {showHeader && (
            <header
              className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 px-4 md:px-8"
              style={{
                background: "color-mix(in srgb, var(--surface) 85%, transparent)",
                backdropFilter: "blur(10px)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="grid place-items-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--sidebar-accent)] md:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu className="size-[18px]" />
                </button>
                <nav className="hidden items-center gap-[10px] text-[14px] md:flex">
                  {breadcrumb.map((b, i) => (
                    <span key={i} className="flex items-center gap-[10px]">
                      {i > 0 && (
                        <span style={{ color: "var(--text-faint)" }}>/</span>
                      )}
                      <span
                        style={
                          i === breadcrumb.length - 1
                            ? { fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--foreground)" }
                            : { color: "var(--muted-foreground)" }
                        }
                      >
                        {b.label}
                      </span>
                    </span>
                  ))}
                </nav>
              </div>
              {actions && (
                <div className="flex items-center gap-[10px]">
                  {actions}
                </div>
              )}
            </header>
          )}

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
