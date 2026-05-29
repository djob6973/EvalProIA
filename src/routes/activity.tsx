import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { statsService } from "@/lib/services/stats";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Registro de Actividad — EvalPro" },
      { name: "description", content: "Historial completo de actividad en el sistema." },
    ],
  }),
  component: Activity,
});

function Activity() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isAdmin) {
      window.location.href = '/participant';
      return;
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    async function loadActivity() {
      if (!isAdmin) return;
      
      try {
        setLoading(true);
        const data = await statsService.getDashboardStats();
        setActivity(data.recentActivity || []);
      } catch (err) {
        console.error('Error loading activity:', err);
        setError('Error al cargar el registro de actividad');
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [isAdmin]);

  if (loading) {
    return (
      <AppShell
        breadcrumb={[{ label: "Sistema" }, { label: "Registro de Actividad" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando registro de actividad...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        breadcrumb={[{ label: "Sistema" }, { label: "Registro de Actividad" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-accent text-white rounded">
              Reintentar
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumb={[{ label: "Sistema" }, { label: "Registro de Actividad" }]}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <h2 className="font-bold text-lg">Registro Completo de Actividad</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Historial de todas las acciones realizadas en el sistema
            </p>
          </div>
          <div className="p-6">
            {activity.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hay actividad registrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((a: any, i: number) => (
                  <div key={i} className="flex gap-3 p-4 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors">
                    <div
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        a.type === 'result' ? "bg-emerald-500" : "bg-accent"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.text}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{a.meta}</div>
                      {a.timestamp && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(a.timestamp).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
