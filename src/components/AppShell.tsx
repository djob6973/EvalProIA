import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
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

  // Handles runtime session expiry (token revoked while already on a page).
  // The router-level beforeLoad covers the initial navigation guard.
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <main className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md md:px-8">
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">/</span>}
                <span
                  className={
                    i === breadcrumb.length - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {b.label}
                </span>
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
