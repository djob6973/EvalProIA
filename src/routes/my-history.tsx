import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { resultsService } from "@/lib/services/evaluations";
import { Calendar, CheckCircle, Tag, Search, Filter, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/my-history")({
  head: () => ({ meta: [{ title: "Mi Historial — EvalPro" }] }),
  component: HistoryPage,
});

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monthKey(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

// ISO week number (1–53)
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// Monday of a given ISO week
function mondayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4); // Jan 4 always in week 1
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (week - 1) * 7);
  return weekStart;
}

function weekLabel(year: number, week: number): string {
  const d = mondayOfWeek(year, week);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function ScoreBadge({ score }: { score: number }) {
  const style =
    score >= 80
      ? { background: "#ECFDF5", color: "#065F46" }
      : score >= 60
      ? { background: "#FFFBEB", color: "#92400E" }
      : { background: "var(--coral-soft)", color: "var(--coral-text)" };
  return (
    <span
      className="rounded-full px-3 py-1 font-mono text-sm font-bold"
      style={style}
    >
      {score}%
    </span>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { promedio, count } = payload[0].payload;
  return (
    <div
      className="rounded-[12px] px-4 py-3 text-[13px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p className="font-medium" style={{ color: "var(--foreground)" }}>Semana del {label}</p>
      <p className="mt-1 font-mono font-bold" style={{ color: "var(--accent)" }}>{promedio}% promedio</p>
      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {count} evaluación{count !== 1 ? "es" : ""}
      </p>
    </div>
  );
}

function HistoryPage() {
  const { profile } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de tarjetas
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [filterMonth, setFilterMonth] = useState<string>("todos");
  const [query, setQuery] = useState("");

  // Filtro de gráfico
  const currentYear = new Date().getFullYear();
  const [chartYear, setChartYear] = useState<number>(currentYear);

  useEffect(() => {
    async function loadResults() {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const data = await resultsService.getByUserId(profile.id);
        setResults(data);
      } catch (err) {
        console.error("Error loading results:", err);
        setError("Error al cargar el historial");
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [profile?.id]);

  // KPIs
  const scores = results.map((r) => r.score).filter((s) => s !== null);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const kpis = [
    { label: "Completadas", value: String(results.length) },
    { label: "Puntaje Promedio", value: `${averageScore}%` },
    { label: "Mejor Puntaje", value: `${bestScore}%` },
  ];

  // Años disponibles para el gráfico
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    results.forEach((r) => {
      if (r.completed_at) years.add(new Date(r.completed_at).getFullYear());
    });
    if (years.size === 0) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [results, currentYear]);

  // Datos semanales para el gráfico
  const weeklyData = useMemo(() => {
    const yearResults = results.filter(
      (r) => r.completed_at && new Date(r.completed_at).getFullYear() === chartYear
    );

    const weekMap = new Map<number, number[]>();
    yearResults.forEach((r) => {
      const week = getISOWeek(new Date(r.completed_at));
      if (!weekMap.has(week)) weekMap.set(week, []);
      weekMap.get(week)!.push(r.score);
    });

    return Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, weekScores]) => ({
        label: weekLabel(chartYear, week),
        week,
        promedio: Math.round(
          weekScores.reduce((s, v) => s + v, 0) / weekScores.length
        ),
        count: weekScores.length,
      }));
  }, [results, chartYear]);

  const chartAverage =
    weeklyData.length > 0
      ? Math.round(
          weeklyData.reduce((s, d) => s + d.promedio, 0) / weeklyData.length
        )
      : 0;

  // Filtros de tarjetas
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    results.forEach((r) =>
      (r.evaluations?.categorias || []).forEach((c: string) => cats.add(c))
    );
    return Array.from(cats).sort();
  }, [results]);

  const allMonths = useMemo(() => {
    const months = new Map<string, string>();
    results.forEach((r) => {
      if (r.completed_at) {
        const key = monthKey(r.completed_at);
        if (!months.has(key)) months.set(key, monthLabel(key));
      }
    });
    return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [results]);

  const attemptInfo = useMemo(() => {
    const byEval: Record<string, any[]> = {};
    results.forEach((r: any) => {
      if (!byEval[r.evaluation_id]) byEval[r.evaluation_id] = [];
      byEval[r.evaluation_id].push(r);
    });
    const attemptMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};
    Object.entries(byEval).forEach(([evalId, evalResults]) => {
      const sorted = [...evalResults].sort(
        (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
      );
      totalMap[evalId] = sorted.length;
      sorted.forEach((r, index) => {
        attemptMap[r.id] = index + 1;
      });
    });
    return { attemptMap, totalMap };
  }, [results]);

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (query) {
        const title = r.evaluations?.title || "";
        if (!title.toLowerCase().includes(query.toLowerCase())) return false;
      }
      if (filterCategory !== "todas") {
        const cats: string[] = r.evaluations?.categorias || [];
        if (!cats.includes(filterCategory)) return false;
      }
      if (filterMonth !== "todos") {
        if (!r.completed_at || monthKey(r.completed_at) !== filterMonth) return false;
      }
      return true;
    });
  }, [results, query, filterCategory, filterMonth]);

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div
              className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Cargando historial...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
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
    <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
      <div className="flex flex-col gap-[28px]">
        {/* KPIs */}
        <div className="grid gap-[16px] sm:grid-cols-3">
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
              <div className="mt-[10px] font-display text-[34px] font-medium leading-none tracking-tight tabular-nums" style={{ color: "var(--foreground)" }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* Gráfico de promedio semanal */}
            <div
              className="overflow-hidden rounded-[20px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex items-center justify-between px-[22px] py-[18px] border-b flex-wrap gap-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-[10px]">
                  <TrendingUp className="size-4" style={{ color: "var(--accent)" }} />
                  <h2 className="font-display text-[17px] font-medium m-0" style={{ color: "var(--foreground)" }}>
                    Promedio semanal
                  </h2>
                  {weeklyData.length > 0 && (
                    <span
                      className="rounded-full px-[10px] py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.08em]"
                      style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
                    >
                      {chartAverage}% este año
                    </span>
                  )}
                </div>
                <select
                  value={chartYear}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  className="rounded-[8px] border px-3 py-1.5 text-[13px]"
                  style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--foreground)" }}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="p-[22px]">
                {weeklyData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                    Sin evaluaciones en {chartYear}.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine
                        y={chartAverage}
                        stroke="var(--border-strong)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.8}
                      />
                      <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "var(--accent)" }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-[10px]">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar evaluación…"
                  className="w-full rounded-[10px] border py-2 pl-9 pr-3 text-[13px]"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="flex items-center gap-[6px]">
                <Filter className="size-4" style={{ color: "var(--muted-foreground)" }} />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-[10px] border px-3 py-2 text-[13px]"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                >
                  <option value="todos">Todos los meses</option>
                  {allMonths.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              {allCategories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-[10px] border px-3 py-2 text-[13px]"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                >
                  <option value="todas">Todas las categorías</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
                {filtered.length} de {results.length}
              </span>
            </div>

            {/* Tarjetas de historial */}
            {filtered.length === 0 ? (
              <div
                className="rounded-[20px] p-10 text-center"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                  No hay resultados con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((result) => {
                  const cats: string[] = result.evaluations?.categorias || [];
                  const attemptNumber = attemptInfo.attemptMap[result.id] ?? 1;
                  const totalAttempts = attemptInfo.totalMap[result.evaluation_id] ?? 1;
                  const showAttemptBadge = totalAttempts > 1;
                  return (
                    <div
                      key={result.id}
                      className="flex flex-col gap-[14px] rounded-[20px] transition-shadow hover:shadow-md"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        padding: 22,
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-[15px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
                          {result.evaluations?.title || "Evaluación"}
                        </h3>
                        <ScoreBadge score={result.score} />
                      </div>

                      {(cats.length > 0 || showAttemptBadge) && (
                        <div className="flex flex-wrap gap-[6px]">
                          {showAttemptBadge && (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                              style={{ background: "#EFF6FF", color: "#1E40AF" }}
                            >
                              Intento {attemptNumber} de {totalAttempts}
                            </span>
                          )}
                          {cats.map((c) => (
                            <span
                              key={c}
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                              style={{ background: "var(--surface-2)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                            >
                              <Tag className="size-3" />
                              {c}
                            </span>
                          ))}
                        </div>
                      )}

                      <div
                        className="flex flex-col gap-[4px] border-t pt-[12px]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {result.evaluations?.created_at && (
                          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            <Calendar className="size-3 shrink-0" />
                            <span>Creada: {formatDateTime(result.evaluations.created_at)}</span>
                          </div>
                        )}
                        {result.completed_at && (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#059669" }}>
                            <CheckCircle className="size-3 shrink-0" />
                            <span>Presentada: {formatDateTime(result.completed_at)}</span>
                          </div>
                        )}
                      </div>

                      <Button asChild variant="outline" size="sm" className="w-full mt-auto">
                        <Link to="/my-results/$id" params={{ id: result.id }}>
                          Ver Resultados
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {results.length === 0 && (
          <div
            className="rounded-[20px] p-12 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
              No has completado ninguna evaluación todavía.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
