import { ReactNode, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";

interface AppShellProps {
  breadcrumb: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ breadcrumb, actions, children }: AppShellProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Handles runtime session expiry (token revoked while already on a page).
  // The router-level beforeLoad covers the initial navigation guard.
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

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
    <div className="min-h-screen w-full" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <AppSidebar />
      <main className="md:pl-[260px]">
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 px-8"
          style={{
            background: "color-mix(in srgb, var(--surface) 85%, transparent)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <nav className="flex items-center gap-[10px] text-[14px]">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-[10px]">
                {i > 0 && (
                  <span style={{ color: "var(--text-faint)" }}>/</span>
                )}
                <span
                  style={
                    i === breadcrumb.length - 1
                      ? { fontWeight: 700, color: "var(--foreground)" }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  {b.label}
                </span>
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-[10px]">{actions}</div>
        </header>

        {/* Content */}
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
  );
}
