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
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700"
      : score >= 60
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${color}`}>
      {score}%
    </span>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { promedio, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm">
      <p className="font-medium text-foreground">Semana del {label}</p>
      <p className="mt-1 font-mono font-bold text-accent">{promedio}% promedio</p>
      <p className="text-xs text-muted-foreground">
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
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando historial...</p>
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
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb={[{ label: "Participante" }, { label: "Mi Historial" }]}>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* Gráfico de promedio semanal */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-accent" />
                  <h2 className="text-sm font-semibold">Promedio semanal</h2>
                  {weeklyData.length > 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                      {chartAverage}% este año
                    </span>
                  )}
                </div>
                <select
                  value={chartYear}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {weeklyData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Sin evaluaciones en {chartYear}.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                      y={chartAverage}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="promedio"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(var(--accent))", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "hsl(var(--accent))" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Filtros de tarjetas */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar evaluación…"
                  className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className="size-4 text-muted-foreground" />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="todos">Todos los meses</option>
                  {allMonths.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {allCategories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="todas">Todas las categorías</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {filtered.length} de {results.length}
              </span>
            </div>

            {/* Tarjetas */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay resultados con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((result) => {
                  const cats: string[] = result.evaluations?.categorias || [];
                  return (
                    <div
                      key={result.id}
                      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight">
                          {result.evaluations?.title || "Evaluación"}
                        </h3>
                        <ScoreBadge score={result.score} />
                      </div>

                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {cats.map((c) => (
                            <span
                              key={c}
                              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              <Tag className="size-3" />
                              {c}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1 border-t border-border pt-3">
                        {result.evaluations?.created_at && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar className="size-3 shrink-0" />
                            <span>Creada: {formatDateTime(result.evaluations.created_at)}</span>
                          </div>
                        )}
                        {result.completed_at && (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
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
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No has completado ninguna evaluación todavía.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
