import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, useLayout } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Bell, Menu, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { statsService } from "@/lib/services/stats";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EvalPro" },
      { name: "description", content: "Resumen de evaluaciones, participantes y preguntas generadas por IA." },
    ],
  }),
  component: Dashboard,
});

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[11px] font-bold"
      style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
    >
      <span className="inline-block size-[6px] rounded-full bg-current" />
      {children}
    </span>
  );
}

type NotifItem = { live: boolean; text: string; meta: string };

function DashboardHeader({ notifications }: { notifications: NotifItem[] }) {
  const { setMobileOpen } = useLayout();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notifOpen]);

  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      {/* Left: mobile menu button + title + subtitle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition hover:bg-[var(--sidebar-accent)] md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-[18px]" strokeWidth={1.5} />
        </button>
        <div>
          <h1
            className="font-display text-[30px] font-medium leading-none tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Dashboard
          </h1>
          <p className="mt-[6px] text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Lo que necesitas atender hoy.
          </p>
        </div>
      </div>

      {/* Right: bell + button */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative grid h-9 w-9 place-items-center rounded-[12px] transition-colors hover:bg-[var(--sidebar-accent)]"
            style={{ color: "var(--muted-foreground)" }}
            title="Notificaciones"
          >
            <Bell className="size-[20px]" strokeWidth={1.5} />
            {notifications.length > 0 && (
              <span
                className="absolute bottom-[7px] right-[7px] h-[7px] w-[7px] rounded-full ring-2 ring-[var(--background)]"
                style={{ background: "var(--accent)" }}
              />
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-[300px] overflow-hidden rounded-[16px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              <div
                className="border-b px-4 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="font-mono text-[10px] font-bold uppercase tracking-[.16em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Actividad Reciente
                </span>
              </div>

              {notifications.length === 0 ? (
                <div
                  className="px-4 py-6 text-center text-[13px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Sin actividad reciente
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((n, i) => (
                    <div
                      key={i}
                      className="flex gap-3 px-4 py-3"
                      style={{
                        borderBottom:
                          i < notifications.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <span
                        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: n.live ? "var(--accent)" : "var(--muted-foreground)",
                          opacity: n.live ? 1 : 0.35,
                          animation: n.live ? "pulse 1.6s ease infinite" : "none",
                        }}
                      />
                      <div>
                        <div
                          className="text-[13px] font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {n.text}
                        </div>
                        <div
                          className="mt-[2px] text-[11px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {n.meta}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nueva Evaluación */}
        <Button asChild className="hidden sm:flex">
          <Link to="/generate">
            <Sparkles className="size-[15px]" /> Nueva Evaluación
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Dashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  useEffect(() => {
    async function loadStats() {
      if (!isAdmin) return;

      try {
        setLoading(true);
        const data = await statsService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
        setError('Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [isAdmin]);

  const kpis = stats ? [
    { label: "Total Evaluaciones", value: String(stats.totalEvaluations), delta: "Evaluaciones creadas", highlight: false },
    { label: "Participantes", value: String(stats.totalParticipants), delta: "Usuarios registrados", highlight: false },
    { label: "Puntaje Promedio", value: String(stats.averageScore), suffix: "/100", delta: "Rendimiento global", highlight: true },
    { label: "Preguntas Totales", value: String(stats.totalQuestions), delta: "Generadas por IA", highlight: false },
  ] : [];

  const evaluations = stats?.recentEvaluations?.slice(0, 4).map((ev: any) => ({
    name: ev.title,
    participants: ev.participants,
    score: ev.averageScore > 0 ? `${ev.averageScore}%` : "--"
  })) || [];

  const activity = stats?.recentActivity?.slice(0, 4).map((act: any) => ({
    live: act.type === 'result',
    text: act.text,
    meta: act.meta
  })) || [];

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Dashboard" }]} showHeader={false}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div
              className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Cargando datos del dashboard...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb={[{ label: "Dashboard" }]} showHeader={false}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-[13px] mb-4" style={{ color: "var(--destructive)" }}>{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb={[{ label: "Dashboard" }]} showHeader={false}>
      <div className="flex flex-col gap-[28px]">
        {/* Page header */}
        <DashboardHeader notifications={activity} />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-[16px] lg:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-[20px] p-[22px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="font-mono text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "var(--muted-foreground)" }}>
                {k.label}
              </div>
              <div
                className="mt-[10px] font-display text-[34px] font-medium leading-none tracking-tight tabular-nums"
                style={{ color: k.highlight ? "var(--accent)" : "var(--foreground)" }}
              >
                {k.value}
                {k.highlight && k.suffix && (
                  <span className="text-[18px] font-normal" style={{ color: "var(--text-faint)" }}>
                    {k.suffix}
                  </span>
                )}
              </div>
              <div className="mt-[6px] text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid gap-[24px] lg:grid-cols-[2fr_1fr] items-start">
          {/* Left column */}
          <div className="flex flex-col gap-[24px]">
            {/* AI Generator card */}
            <div
              className="overflow-hidden rounded-[20px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex items-center justify-between px-[22px] py-[18px] border-b"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <div className="flex items-center gap-[10px]">
                  <Sparkles className="size-4" style={{ color: "var(--accent)" }} />
                  <h2 className="font-display text-[17px] font-medium m-0" style={{ color: "var(--foreground)" }}>
                    Generador Inteligente de Preguntas
                  </h2>
                </div>
                <span
                  className="rounded-full px-[10px] py-1 font-mono text-[9px] font-bold uppercase tracking-[.08em]"
                  style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
                >
                  Impulsado por GPT-4
                </span>
              </div>
              <div className="p-[22px]">
                <Link
                  to="/generate"
                  className="flex h-32 w-full flex-col items-center justify-center gap-[6px] rounded-[14px] border-2 border-dashed transition-colors"
                  style={{ borderColor: "var(--border-strong)", color: "var(--muted-foreground)" }}
                >
                  <span className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                    Arrastra documentación aquí para extraer preguntas
                  </span>
                  <span className="text-[11px]">Acepta PDF, DOCX, TXT — procesado por IA</span>
                </Link>
                <div className="mt-4 flex justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/generate">
                      Abrir generador <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent evaluations */}
            <div
              className="overflow-hidden rounded-[20px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex items-center justify-between px-[22px] py-[18px] border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="font-display text-[17px] font-medium m-0" style={{ color: "var(--foreground)" }}>
                  Evaluaciones Recientes
                </h2>
                <Link
                  to="/evaluations"
                  className="text-[13px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Ver todas
                </Link>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Nombre", "Participantes", "Estado", "Promedio"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-[22px] py-[11px] font-mono text-[9px] font-bold uppercase tracking-[.12em] ${i === 3 ? "text-right" : ""}`}
                        style={{ color: "var(--text-faint)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[14px]">
                  {evaluations.map((e: any, i: number) => (
                    <tr
                      key={e.name + i}
                      style={{ borderBottom: i < evaluations.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <td className="px-[22px] py-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                        {e.name}
                      </td>
                      <td className="px-[22px] py-[14px] font-mono text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                        {String(e.participants).padStart(2, "0")}
                      </td>
                      <td className="px-[22px] py-[14px]">
                        <StatusPill>Activa</StatusPill>
                      </td>
                      <td className="px-[22px] py-[14px] text-right font-display font-medium" style={{ color: "var(--accent)" }}>
                        {e.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-[24px]">
            {/* Activity panel */}
            <div className="rounded-[20px] p-[22px]" style={{ background: "#333333", color: "#F1F1F1" }}>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "rgba(241,241,241,0.5)" }}>
                Actividad en Tiempo Real
              </div>
              <div className="mt-[18px] flex flex-col gap-[16px]">
                {activity.map((a: any, i: number) => (
                  <div key={i} className="flex gap-[11px]">
                    <span
                      className="mt-[5px] size-2 shrink-0 rounded-full flex-shrink-0"
                      style={{
                        background: a.live ? "var(--accent)" : "rgba(241,241,241,0.3)",
                        animation: a.live ? "pulse 1.6s ease infinite" : "none",
                      }}
                    />
                    <div>
                      <div className="text-[13px] font-medium">{a.text}</div>
                      <div className="mt-[2px] text-[11px]" style={{ color: "rgba(241,241,241,0.5)" }}>{a.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/activity"
                className="mt-[18px] block w-full rounded-[8px] border py-[9px] text-center font-mono text-[9px] font-bold uppercase tracking-[.14em] transition-colors"
                style={{ borderColor: "rgba(241,241,241,0.15)", color: "rgba(241,241,241,0.7)" }}
              >
                Ver Registro Completo
              </Link>
            </div>

            {/* Prompt strategy */}
            <div
              className="rounded-[20px] p-[22px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="size-4" style={{ color: "var(--accent)" }} />
                <h3 className="font-display text-[16px] font-medium m-0" style={{ color: "var(--foreground)" }}>
                  Estrategia de Prompt
                </h3>
              </div>
              <div
                className="mb-4 rounded-[14px] overflow-hidden"
                style={{ aspectRatio: "16/7", background: "var(--surface-2)" }}
              >
                <svg viewBox="0 0 200 80" className="h-full w-full p-[14px]" style={{ color: "var(--accent)" }} preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    points="0,60 30,55 60,40 90,42 120,28 150,22 180,18 200,12"
                  />
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                    points="0,65 30,62 60,58 90,55 120,50 150,46 180,42 200,38"
                  />
                </svg>
              </div>
              <p className="text-[13px] leading-relaxed m-0" style={{ color: "var(--muted-foreground)" }}>
                El modelo actual utiliza{" "}
                <strong style={{ color: "var(--foreground)" }}>Extracción Semántica v4</strong>.
                La calidad de evaluación ha aumentado un 14% desde el último ajuste de prompt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
