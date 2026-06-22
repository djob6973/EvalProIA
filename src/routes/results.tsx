import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { Download, Users, CheckCircle2, Clock, Trophy, TrendingUp } from "lucide-react";
import { resultsService, areasService, getAllParticipants } from "@/lib/services/evaluations";
import type { Area } from "@/lib/services/evaluations";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "Resultados Globales — EvalPro" }] }),
  component: ResultsPage,
});

type RawResult = {
  id: string;
  user_id: string;
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

function ResultsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "both";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<RawResult[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [participants, setParticipants] = useState<
    { id: string; full_name: string | null; email: string }[]
  >([]);
  const [distribution, setDistribution] = useState<
    Array<{ range: string; count: number }>
  >([]);
  const [topPerformers, setTopPerformers] = useState<
    Array<{ name: string; score: number; eval: string }>
  >([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    passRate: 0,
    avgDuration: 0,
    bestScore: 0,
  });

  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterAreaId, setFilterAreaId] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");

  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
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
            count: rawResults.filter(
              (res: any) => res.score >= r.min && res.score <= r.max
            ).length,
          }))
        );

        const sorted = [...rawResults]
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 4);
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
            ? Math.round(
                (rawResults.filter((r: any) => r.score >= 60).length / total) * 100
              )
            : 0;
        const bestScore =
          total > 0 ? Math.max(...rawResults.map((r: any) => r.score)) : 0;
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
            ? Math.round(
                (durations.reduce((sum: number, d: number) => sum + d, 0) /
                  durations.length) *
                  10
              ) / 10
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
    const years = new Set(
      allResults.map((r) => new Date(r.completed_at).getFullYear())
    );
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [allResults, currentYear]);

  const weeklyData = useMemo<WeekPoint[]>(() => {
    const filtered = allResults.filter((r) => {
      const date = new Date(r.completed_at);
      if (date.getFullYear() !== filterYear) return false;
      if (filterAreaId !== "all" && r.evaluations?.area_id !== filterAreaId)
        return false;
      if (filterUserId !== "all" && r.user_id !== filterUserId) return false;
      return true;
    });

    const map = new Map<string, { total: number; count: number }>();
    for (const r of filtered) {
      const label = getISOWeekLabel(new Date(r.completed_at));
      const existing = map.get(label) ?? { total: 0, count: 0 };
      map.set(label, {
        total: existing.total + r.score,
        count: existing.count + 1,
      });
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
    const headers = [
      "Participante",
      "Email",
      "Evaluación",
      "Área",
      "Puntaje",
      "Estado",
      "Fecha Completado",
    ];
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

  const maxDist =
    distribution.length > 0 ? Math.max(...distribution.map((d) => d.count)) : 0;

  const kpiValues = [
    String(stats.totalSessions),
    `${stats.passRate}%`,
    stats.avgDuration > 0 ? `${stats.avgDuration}m` : "—",
    `${stats.bestScore}/100`,
  ];

  if (loading) {
    return (
      <AppShell
        breadcrumb={[
          { label: "Herramientas" },
          { label: "Resultados Globales" },
        ]}
      >
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
      <AppShell
        breadcrumb={[
          { label: "Herramientas" },
          { label: "Resultados Globales" },
        ]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumb={[
        { label: "Herramientas" },
        { label: "Resultados Globales" },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={exportResultsCsv}
          disabled={allResults.length === 0}
        >
          <Download className="size-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="space-y-5">
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
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    {k.label}
                  </span>
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
              <h2 className="text-sm font-semibold text-foreground">
                Promedio Semanal
              </h2>
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
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                value={filterAreaId}
                onChange={(e) => setFilterAreaId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="all">Todas las áreas</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="all">Todos los participantes</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
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
                <p className="text-sm text-muted-foreground">
                  Sin datos para los filtros seleccionados.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeklyData}
                  margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
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
                    formatter={(value: number, _name: string, entry: any) => [
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
                    activeDot={{
                      r: 6,
                      fill: "var(--accent)",
                      stroke: "var(--card)",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distribution + Top performers */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Distribution */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold text-foreground">
              Distribución de Puntajes
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A lo largo de las {stats.totalSessions}{" "}
              {stats.totalSessions === 1 ? "sesión completada" : "sesiones completadas"}.
            </p>

            {maxDist === 0 ? (
              <div className="mt-6 flex h-36 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Sin sesiones completadas aún.
                </p>
              </div>
            ) : (
              <div className="mt-6 flex items-end gap-3">
                {distribution.map((d) => {
                  const barH =
                    maxDist > 0
                      ? Math.max((d.count / maxDist) * MAX_BAR_H, d.count > 0 ? 6 : 0)
                      : 0;
                  return (
                    <div
                      key={d.range}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
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
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {d.range}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top performers */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Mejores Participantes
            </h2>

            {topPerformers.length === 0 ? (
              <div className="mt-6 flex h-28 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Sin datos disponibles.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {topPerformers.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
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
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.eval}
                      </div>
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
      </div>
    </AppShell>
  );
}
