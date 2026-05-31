import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
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

  // Filters
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

        // Stats based on all results
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
            name:
              res.profiles?.full_name || res.profiles?.email || "Usuario",
            score: res.score,
            eval: res.evaluations?.title || "Evaluación",
          }))
        );

        const total = rawResults.length;
        const passRate =
          total > 0
            ? Math.round(
                (rawResults.filter((r: any) => r.score >= 60).length /
                  total) *
                  100
              )
            : 0;
        const bestScore =
          total > 0
            ? Math.max(...rawResults.map((r: any) => r.score))
            : 0;
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
                (durations.reduce(
                  (sum: number, d: number) => sum + d,
                  0
                ) /
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

  // Derive available years from results
  const availableYears = useMemo(() => {
    const years = new Set(
      allResults.map((r) => new Date(r.completed_at).getFullYear())
    );
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [allResults, currentYear]);

  // Weekly trend data after filters
  const weeklyData = useMemo<WeekPoint[]>(() => {
    const filtered = allResults.filter((r) => {
      const date = new Date(r.completed_at);
      if (date.getFullYear() !== filterYear) return false;
      if (
        filterAreaId !== "all" &&
        r.evaluations?.area_id !== filterAreaId
      )
        return false;
      if (filterUserId !== "all" && r.user_id !== filterUserId) return false;
      return true;
    });

    // Group by ISO week number within the year
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

  const max =
    distribution.length > 0
      ? Math.max(...distribution.map((d) => d.count))
      : 0;

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
            <p className="text-sm text-muted-foreground">
              Cargando resultados...
            </p>
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
      <div className="space-y-6">
        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { l: "Sesiones Totales", v: String(stats.totalSessions) },
            { l: "Tasa de Aprobación", v: `${stats.passRate}%` },
            {
              l: "Duración Promedio",
              v: stats.avgDuration > 0 ? `${stats.avgDuration}m` : "N/A",
            },
            { l: "Mejor Puntaje", v: `${stats.bestScore}/100` },
          ].map((k) => (
            <div
              key={k.l}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {k.l}
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{k.v}</div>
            </div>
          ))}
        </div>

        {/* Weekly trend chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">Promedio Semanal</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Promedio de puntaje por semana del año seleccionado.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Year */}
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Area */}
              <select
                value={filterAreaId}
                onChange={(e) => setFilterAreaId(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">Todas las áreas</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* Participant */}
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
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

          <div className="mt-6 h-64">
            {weeklyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin datos para los filtros seleccionados.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeklyData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="semana"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, _name: string, entry: any) => [
                      `${value}% (${entry.payload.count} sesiones)`,
                      "Promedio",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="promedio"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--accent))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distribution + Top performers */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <h2 className="font-bold">Distribución de Puntajes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A lo largo de las últimas {stats.totalSessions} sesiones
              completadas.
            </p>
            <div className="mt-6 flex h-56 items-end gap-4">
              {distribution.map((d) => (
                <div
                  key={d.range}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-accent/20 transition-all hover:bg-accent/40"
                      style={{
                        height: `${max > 0 ? (d.count / max) * 100 : 0}%`,
                      }}
                    >
                      <div className="h-full w-full rounded-t border-t-2 border-accent" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {d.range}
                  </div>
                  <div className="font-mono text-xs font-bold">{d.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-bold">Mejores Participantes</h2>
            <ul className="mt-4 space-y-3">
              {topPerformers.map((p, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-xs font-bold">
                    {i === 0 ? "👑" : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.eval}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-accent">
                    {p.score}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
