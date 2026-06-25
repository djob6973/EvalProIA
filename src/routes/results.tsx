import { createFileRoute, useNavigate, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import {
  Download, Users, CheckCircle2, Clock, Trophy, TrendingUp,
  ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";
import { resultsService, areasService, getAllParticipants } from "@/lib/services/evaluations";
import type { Area } from "@/lib/services/evaluations";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "Resultados Globales — EvalPro" }] }),
  component: ResultsPage,
});

type RawResult = {
  id: string;
  user_id: string;
  evaluation_id: string;
  score: number;
  completed_at: string;
  started_at: string;
  evaluations: { title: string; area_id: string | null };
  profiles: { full_name: string | null; email: string };
};

type WeekPoint = { semana: string; promedio: number; count: number };

function getISOWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `S${weekNo}`;
}

const SELECT_CLASS =
  "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-foreground " +
  "transition-colors hover:border-[var(--border-strong)] focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent/20 cursor-pointer";

const KPI_ITEMS = [
  { label: "Sesiones Totales", icon: Users },
  { label: "Tasa de Aprobación", icon: CheckCircle2 },
  { label: "Duración Promedio", icon: Clock },
  { label: "Mejor Puntaje", icon: Trophy },
] as const;

const MAX_BAR_H = 140;
const PT_PAGE_SIZE = 10;

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

function ResultsPage() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/results/participant/")) return <Outlet />;
  return <ResultsPageContent />;
}

function ResultsPageContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "both";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<RawResult[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [participants, setParticipants] = useState<
    { id: string; full_name: string | null; email: string; area_id: string | null }[]
  >([]);
  const [distribution, setDistribution] = useState<Array<{ range: string; count: number }>>([]);
  const [topPerformers, setTopPerformers] = useState<Array<{ name: string; score: number; eval: string }>>([]);
  const [stats, setStats] = useState({ totalSessions: 0, passRate: 0, avgDuration: 0, bestScore: 0 });

  // Metrics tab filters
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterAreaId, setFilterAreaId] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");

  // Active tab
  const [activeTab, setActiveTab] = useState<"metrics" | "participants">("metrics");

  // Participant report filters
  const [ptFilterAreaId, setPtFilterAreaId] = useState("all");
  const [ptFilterUserId, setPtFilterUserId] = useState("all");
  const [ptFilterDateFrom, setPtFilterDateFrom] = useState("");
  const [ptFilterDateTo, setPtFilterDateTo] = useState("");
  const [ptPage, setPtPage] = useState(1);

  useEffect(() => { setPtPage(1); }, [ptFilterAreaId, ptFilterUserId, ptFilterDateFrom, ptFilterDateTo]);

  useEffect(() => {
    if (profile && !isAdmin) navigate({ to: "/participant" });
  }, [profile, isAdmin, navigate]);

  useEffect(() => {
    async function loadResults() {
      if (!isAdmin) return;
      try {
        setLoading(true);
        const [rawResults, rawAreas, rawParticipants] = await Promise.all([
          resultsService.getAll(),
          areasService.getAll(),
          getAllParticipants(),
        ]);

        setAllResults(rawResults as RawResult[]);
        setAreas(rawAreas);
        setParticipants(
          rawParticipants.map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            area_id: p.area_id,
          }))
        );

        const ranges = [
          { range: "0-20", min: 0, max: 20 },
          { range: "21-40", min: 21, max: 40 },
          { range: "41-60", min: 41, max: 60 },
          { range: "61-80", min: 61, max: 80 },
          { range: "81-100", min: 81, max: 100 },
        ];
        setDistribution(
          ranges.map((r) => ({
            range: r.range,
            count: rawResults.filter((res: any) => res.score >= r.min && res.score <= r.max).length,
          }))
        );

        const sorted = [...rawResults].sort((a: any, b: any) => b.score - a.score).slice(0, 4);
        setTopPerformers(
          sorted.map((res: any) => ({
            name: res.profiles?.full_name || res.profiles?.email || "Usuario",
            score: res.score,
            eval: res.evaluations?.title || "Evaluación",
          }))
        );

        const total = rawResults.length;
        const passRate =
          total > 0
            ? Math.round((rawResults.filter((r: any) => r.score >= 60).length / total) * 100)
            : 0;
        const bestScore = total > 0 ? Math.max(...rawResults.map((r: any) => r.score)) : 0;
        const durations = rawResults
          .filter((r: any) => r.started_at && r.completed_at)
          .map((r: any) => {
            const start = new Date(r.started_at).getTime();
            const end = new Date(r.completed_at).getTime();
            return (end - start) / (1000 * 60);
          })
          .filter((d: number) => d > 0 && d < 240);
        const avgDuration =
          durations.length > 0
            ? Math.round((durations.reduce((s: number, d: number) => s + d, 0) / durations.length) * 10) / 10
            : 0;
        setStats({ totalSessions: total, passRate, avgDuration, bestScore });
      } catch (err) {
        console.error("Error loading results:", err);
        setError("Error al cargar los resultados");
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [isAdmin]);

  const availableYears = useMemo(() => {
    const years = new Set(allResults.map((r) => new Date(r.completed_at).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [allResults, currentYear]);

  const weeklyData = useMemo<WeekPoint[]>(() => {
    const filtered = allResults.filter((r) => {
      const date = new Date(r.completed_at);
      if (date.getFullYear() !== filterYear) return false;
      if (filterAreaId !== "all" && r.evaluations?.area_id !== filterAreaId) return false;
      if (filterUserId !== "all" && r.user_id !== filterUserId) return false;
      return true;
    });
    const map = new Map<string, { total: number; count: number }>();
    for (const r of filtered) {
      const label = getISOWeekLabel(new Date(r.completed_at));
      const existing = map.get(label) ?? { total: 0, count: 0 };
      map.set(label, { total: existing.total + r.score, count: existing.count + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.replace("S", ""), 10);
        return n(a[0]) - n(b[0]);
      })
      .map(([semana, { total, count }]) => ({
        semana,
        promedio: Math.round((total / count) * 10) / 10,
        count,
      }));
  }, [allResults, filterYear, filterAreaId, filterUserId]);

  // ── Participant report data ────────────────────────────────────────────────

  const participantStats = useMemo(() => {
    const byUser = new Map<string, RawResult[]>();
    for (const r of allResults) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r);
      byUser.set(r.user_id, arr);
    }
    return Array.from(byUser.entries())
      .map(([userId, userResults]) => {
        const p = participants.find((x) => x.id === userId);
        const name = p?.full_name || userResults[0]?.profiles?.full_name || "Usuario";
        const email = p?.email || userResults[0]?.profiles?.email || "";
        const areaId = p?.area_id ?? null;
        const areaName = areaId ? (areas.find((a) => a.id === areaId)?.name ?? null) : null;
        const scores = userResults.map((r) => r.score);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const bestScore = Math.max(...scores);
        const evalIds = new Set(userResults.map((r) => r.evaluation_id));
        const lastActivity = userResults.reduce(
          (latest, r) => (r.completed_at > latest ? r.completed_at : latest),
          userResults[0].completed_at
        );
        return {
          userId, name, email, areaId, areaName,
          evalCount: evalIds.size,
          sessionCount: userResults.length,
          avgScore, bestScore,
          passRate: Math.round(
            (userResults.filter((r) => r.score >= 60).length / userResults.length) * 100
          ),
          lastActivity,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [allResults, participants, areas]);

  const filteredParticipants = useMemo(() => {
    return participantStats.filter((p) => {
      if (ptFilterAreaId !== "all" && p.areaId !== ptFilterAreaId) return false;
      if (ptFilterUserId !== "all" && p.userId !== ptFilterUserId) return false;
      if (ptFilterDateFrom) {
        if (new Date(p.lastActivity).getTime() < new Date(ptFilterDateFrom).getTime()) return false;
      }
      if (ptFilterDateTo) {
        if (new Date(p.lastActivity).getTime() > new Date(ptFilterDateTo + "T23:59:59").getTime()) return false;
      }
      return true;
    });
  }, [participantStats, ptFilterAreaId, ptFilterUserId, ptFilterDateFrom, ptFilterDateTo]);

  const ptTotalPages = Math.ceil(filteredParticipants.length / PT_PAGE_SIZE);
  const ptPageData = filteredParticipants.slice(
    (ptPage - 1) * PT_PAGE_SIZE,
    ptPage * PT_PAGE_SIZE
  );

  // ── Utilities ────────────────────────────────────────────────────────────

  function downloadCsv(rows: string[][], filename: string) {
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const content = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportResultsCsv() {
    const headers = ["Participante", "Email", "Evaluación", "Área", "Puntaje", "Estado", "Fecha Completado"];
    const rows = allResults.map((r) => {
      const area = areas.find((a) => a.id === r.evaluations?.area_id);
      return [
        r.profiles?.full_name || "",
        r.profiles?.email || "",
        r.evaluations?.title || "",
        area?.name || "",
        String(r.score),
        r.score >= 60 ? "APROBADO" : "REPROBADO",
        new Date(r.completed_at).toLocaleString("es-ES"),
      ];
    });
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv([headers, ...rows], `resultados-globales-${today}.csv`);
  }

  function exportParticipantsCsv() {
    const headers = [
      "Participante", "Email", "Área", "Evaluaciones", "Sesiones",
      "Promedio", "Mejor Puntaje", "Última Actividad",
    ];
    const rows = filteredParticipants.map((p) => [
      p.name, p.email, p.areaName ?? "",
      String(p.evalCount), String(p.sessionCount),
      `${p.avgScore}%`, `${p.bestScore}%`,
      new Date(p.lastActivity).toLocaleDateString("es-ES"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv([headers, ...rows], `reporte-participantes-${today}.csv`);
  }

  const maxDist = distribution.length > 0 ? Math.max(...distribution.map((d) => d.count)) : 0;

  const kpiValues = [
    String(stats.totalSessions),
    `${stats.passRate}%`,
    stats.avgDuration > 0 ? `${stats.avgDuration}m` : "—",
    `${stats.bestScore}/100`,
  ];

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Resultados Globales" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando resultados...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Resultados Globales" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        title="Resultados Globales"
        actions={
          activeTab === "metrics" ? (
            <Button variant="outline" size="sm" onClick={exportResultsCsv} disabled={allResults.length === 0}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={exportParticipantsCsv} disabled={filteredParticipants.length === 0}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          )
        }
      />
      <div className="space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm w-fit">
          {(["metrics", "participants"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
              }`}
            >
              {tab === "metrics" ? "Métricas" : "Por Participante"}
            </button>
          ))}
        </div>

        {/* ── MÉTRICAS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "metrics" && (
          <>
            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KPI_ITEMS.map((k, i) => (
                <div
                  key={k.label}
                  className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
                  <div className="px-5 py-5 pl-6">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <k.icon className="size-3.5 shrink-0 text-accent" strokeWidth={2.5} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">{k.label}</span>
                    </div>
                    <div className="mt-2.5 font-mono text-3xl font-bold tracking-tight text-foreground">
                      {kpiValues[i]}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Weekly trend chart */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5 pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Promedio Semanal</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Promedio de puntaje por semana del año seleccionado.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(Number(e.target.value))}
                    className={SELECT_CLASS}
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={filterAreaId}
                    onChange={(e) => setFilterAreaId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="all">Todas las áreas</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="all">Todos los participantes</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="h-64 px-2 pb-4">
                {weeklyData.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5">
                    <div className="grid size-10 place-items-center rounded-xl bg-[var(--surface-2)]">
                      <TrendingUp className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="semana"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          color: "var(--foreground)",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                        }}
                        cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                        formatter={(value: number, _n: string, entry: any) => [
                          `${value} pts · ${entry.payload.count} ${entry.payload.count === 1 ? "sesión" : "sesiones"}`,
                          "Promedio",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--card)", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Distribution + Top performers */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
                <h2 className="text-sm font-semibold text-foreground">Distribución de Puntajes</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A lo largo de las {stats.totalSessions}{" "}
                  {stats.totalSessions === 1 ? "sesión completada" : "sesiones completadas"}.
                </p>
                {maxDist === 0 ? (
                  <div className="mt-6 flex h-36 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sin sesiones completadas aún.</p>
                  </div>
                ) : (
                  <div className="mt-6 flex items-end gap-3">
                    {distribution.map((d) => {
                      const barH =
                        maxDist > 0
                          ? Math.max((d.count / maxDist) * MAX_BAR_H, d.count > 0 ? 6 : 0)
                          : 0;
                      return (
                        <div key={d.range} className="flex flex-1 flex-col items-center gap-1.5">
                          <span
                            className="font-mono text-xs font-bold text-accent transition-opacity"
                            style={{ opacity: d.count > 0 ? 1 : 0 }}
                          >
                            {d.count}
                          </span>
                          <div
                            className="w-full rounded-t bg-accent/15 border-t-2 border-accent transition-all duration-500 hover:bg-accent/30"
                            style={{ height: `${barH}px` }}
                          />
                          <span className="font-mono text-[10px] text-muted-foreground">{d.range}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Mejores Participantes</h2>
                {topPerformers.length === 0 ? (
                  <div className="mt-6 flex h-28 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-border">
                    {topPerformers.map((p, i) => (
                      <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            i === 0
                              ? "bg-[var(--coral-soft)] text-[var(--coral-text)]"
                              : "bg-[var(--surface-2)] text-muted-foreground"
                          }`}
                        >
                          {i === 0 ? "👑" : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{p.eval}</div>
                        </div>
                        <div
                          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                            i === 0
                              ? "bg-[var(--coral-soft)] text-[var(--coral-text)]"
                              : "bg-[var(--surface-2)] text-foreground"
                          }`}
                        >
                          {p.score}%
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── POR PARTICIPANTE TAB ──────────────────────────────────────────── */}
        {activeTab === "participants" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Filtros
                </span>
                <select
                  value={ptFilterAreaId}
                  onChange={(e) => setPtFilterAreaId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="all">Todas las áreas</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select
                  value={ptFilterUserId}
                  onChange={(e) => setPtFilterUserId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="all">Todos los participantes</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Desde</span>
                  <input
                    type="date"
                    value={ptFilterDateFrom}
                    onChange={(e) => setPtFilterDateFrom(e.target.value)}
                    className={SELECT_CLASS}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Hasta</span>
                  <input
                    type="date"
                    value={ptFilterDateTo}
                    onChange={(e) => setPtFilterDateTo(e.target.value)}
                    className={SELECT_CLASS}
                  />
                </div>
                {(ptFilterAreaId !== "all" || ptFilterUserId !== "all" || ptFilterDateFrom || ptFilterDateTo) && (
                  <button
                    onClick={() => {
                      setPtFilterAreaId("all");
                      setPtFilterUserId("all");
                      setPtFilterDateFrom("");
                      setPtFilterDateTo("");
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Rendimiento por Participante</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Promedio de puntaje sobre todas las evaluaciones realizadas.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {filteredParticipants.length}{" "}
                  {filteredParticipants.length === 1 ? "participante" : "participantes"}
                </span>
              </div>

              {filteredParticipants.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2.5 py-16">
                  <div className="grid size-10 place-items-center rounded-xl bg-[var(--surface-2)]">
                    <Users className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No se encontraron participantes con los filtros seleccionados.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-[var(--surface-2)]">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Participante
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                          Área
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Evals.
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Sesiones
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Promedio
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          Mejor
                        </th>

                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                          Última act.
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ptPageData.map((p, idx) => {
                        const globalRank = (ptPage - 1) * PT_PAGE_SIZE + idx + 1;
                        const isPassing = p.avgScore >= 60;
                        return (
                          <tr
                            key={p.userId}
                            className="hover:bg-[var(--surface-2)] transition-colors"
                          >
                            <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                              {globalRank}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-foreground">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.email}</div>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell">
                              {p.areaName ? (
                                <span className="rounded-full bg-[var(--surface-2)] border border-border px-2.5 py-0.5 text-xs text-foreground">
                                  {p.areaName}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-sm text-foreground">
                              {p.evalCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-sm text-foreground">
                              {p.sessionCount}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`font-mono text-sm font-bold ${
                                  isPassing ? "text-[var(--coral-text)]" : "text-muted-foreground"
                                }`}
                              >
                                {p.avgScore}%
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-sm text-foreground hidden lg:table-cell">
                              {p.bestScore}%
                            </td>

                            <td className="px-4 py-3.5 text-center text-xs text-muted-foreground hidden xl:table-cell">
                              {formatRelativeDate(p.lastActivity)}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Link
                                to="/results/participant/$userId"
                                params={{ userId: p.userId }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:border-accent"
                              >
                                Ver detalle <ArrowRight className="size-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {ptTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-3">
                  <span className="text-xs text-muted-foreground">
                    Página {ptPage} de {ptTotalPages} ·{" "}
                    {filteredParticipants.length} participantes
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={ptPage === 1}
                      onClick={() => setPtPage((p) => p - 1)}
                      className="grid size-7 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    {Array.from({ length: ptTotalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === ptTotalPages || Math.abs(p - ptPage) <= 1)
                      .reduce<(number | "…")[]>((acc, p, i, arr) => {
                        if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "…" ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPtPage(p as number)}
                            className={`grid size-7 place-items-center rounded-lg text-xs font-medium transition-colors ${
                              ptPage === p
                                ? "bg-accent text-accent-foreground"
                                : "border border-border text-muted-foreground hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      disabled={ptPage === ptTotalPages}
                      onClick={() => setPtPage((p) => p + 1)}
                      className="grid size-7 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
