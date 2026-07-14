import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { resultsService, etiquetasService, type Etiqueta } from "@/lib/services/evaluations";
import { Calendar, CheckCircle, Tag, Search, Filter, TrendingUp, ClipboardList, Trophy } from "lucide-react";
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

type TrendView = "week" | "month" | "quarter";

function getISOWeekInfo(date: Date): { year: number; week: number; label: string } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getFullYear(), week, label: `S${week}` };
}

function getTrendBucket(date: Date, view: TrendView, locale: string): { sortKey: string; label: string } {
  if (view === "week") {
    const { year, week, label } = getISOWeekInfo(date);
    return { sortKey: `${year}-${String(week).padStart(2, "0")}`, label };
  }
  if (view === "month") {
    const y = date.getFullYear();
    const m = date.getMonth();
    const raw = date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
    return {
      sortKey: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
    };
  }
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  return { sortKey: `${y}-Q${q}`, label: `T${q} ${String(y).slice(2)}` };
}

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

const FILTER_LABEL = "mb-1 block text-[10px] font-semibold uppercase tracking-wide" as const;

function HistoryPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const [results, setResults] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart + KPI filters
  const currentYear = new Date().getFullYear();
  const [chartFilterFrom, setChartFilterFrom] = useState(`${currentYear}-01-01`);
  const [chartFilterTo, setChartFilterTo] = useState(`${currentYear}-12-31`);
  const [chartFilterCategoria, setChartFilterCategoria] = useState<string>("todas");
  const [chartFilterEtiqueta, setChartFilterEtiqueta] = useState<string>("todas");
  const [chartView, setChartView] = useState<TrendView>("week");

  // Card-only filters
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [filterMonth, setFilterMonth] = useState<string>("todos");
  const [filterEtiqueta, setFilterEtiqueta] = useState<string>("todas");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const [data, tags] = await Promise.all([
          resultsService.getByUserId(profile.id),
          etiquetasService.getAll(),
        ]);
        setResults(data);
        setEtiquetas(tags);
      } catch (err) {
        console.error("Error loading results:", err);
        setError(t('myHistory.loadError'));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile?.id]);

  // All categories (from all results, for filter dropdowns)
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    results.forEach((r) =>
      (r.evaluations?.categorias || []).forEach((c: string) => cats.add(c))
    );
    return Array.from(cats).sort();
  }, [results]);

  // Results filtered by chart/KPI filters
  const chartFiltered = useMemo(() => {
    return results.filter((r) => {
      if (!r.completed_at) return false;
      const d = new Date(r.completed_at);
      if (chartFilterFrom && d < new Date(chartFilterFrom)) return false;
      if (chartFilterTo && d > new Date(chartFilterTo + "T23:59:59")) return false;
      if (chartFilterCategoria !== "todas") {
        const cats: string[] = r.evaluations?.categorias || [];
        if (!cats.includes(chartFilterCategoria)) return false;
      }
      if (chartFilterEtiqueta !== "todas") {
        if (r.etiqueta_id !== chartFilterEtiqueta) return false;
      }
      return true;
    });
  }, [results, chartFilterFrom, chartFilterTo, chartFilterCategoria, chartFilterEtiqueta]);

  // KPIs from chartFiltered
  const scores = chartFiltered.map((r) => r.score).filter((s) => s !== null);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

  const kpis = [
    { label: t('myHistory.completed'), value: String(chartFiltered.length), Icon: ClipboardList },
    { label: t('myHistory.avgScore'), value: `${averageScore}%`, Icon: TrendingUp },
    { label: t('myHistory.bestScore'), value: `${bestScore}%`, Icon: Trophy },
  ];

  // Trend data for chart
  const trendData = useMemo(() => {
    const buckets = new Map<string, { label: string; scores: number[] }>();
    chartFiltered.forEach((r) => {
      if (!r.completed_at || r.score == null) return;
      const { sortKey, label } = getTrendBucket(new Date(r.completed_at), chartView, i18n.language);
      if (!buckets.has(sortKey)) buckets.set(sortKey, { label, scores: [] });
      buckets.get(sortKey)!.scores.push(r.score);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, { label, scores: s }]) => ({
        periodo: label,
        promedio: Math.round(s.reduce((acc, v) => acc + v, 0) / s.length),
        count: s.length,
      }));
  }, [chartFiltered, chartView, i18n.language]);

  const chartAverage =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, d) => s + d.promedio, 0) / trendData.length)
      : 0;

  // Months for card filter
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

  // Card-only filtered results
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
      if (filterEtiqueta !== "todas") {
        if (r.etiqueta_id !== filterEtiqueta) return false;
      }
      return true;
    });
  }, [results, query, filterCategory, filterMonth, filterEtiqueta]);

  const SELECT_STYLE = {
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--foreground)",
  } as const;

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('myHistory.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div
              className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent mx-auto"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{t('myHistory.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title={t('myHistory.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-[13px] mb-4" style={{ color: "var(--destructive)" }}>{error}</p>
            <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={t('myHistory.title')} subtitle={t('myHistory.subtitle')} />
      <div className="flex flex-col gap-[28px]">

        {/* ── Filter bar (affects KPIs + chart) ── */}
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-accent" strokeWidth={2.5} />
              <span className="text-sm font-semibold text-foreground">{t('myHistory.filters')}</span>
            </div>
            {(chartFilterFrom !== `${currentYear}-01-01` || chartFilterTo !== `${currentYear}-12-31` || chartFilterCategoria !== "todas" || chartFilterEtiqueta !== "todas") && (
              <button
                onClick={() => { setChartFilterFrom(`${currentYear}-01-01`); setChartFilterTo(`${currentYear}-12-31`); setChartFilterCategoria("todas"); setChartFilterEtiqueta("todas"); }}
                className="text-xs text-accent hover:underline"
              >
                {t('myHistory.clearFilters')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-[16px] border-t border-border pt-3">
            <div className="flex flex-col gap-[4px] min-w-[130px]">
              <span className={FILTER_LABEL} style={{ color: "var(--muted-foreground)" }}>{t('myHistory.filterFrom')}</span>
              <input
                type="date"
                value={chartFilterFrom}
                onChange={(e) => setChartFilterFrom(e.target.value)}
                className="rounded-[8px] border px-3 py-1.5 text-[13px]"
                style={SELECT_STYLE}
              />
            </div>
            <div className="flex flex-col gap-[4px] min-w-[130px]">
              <span className={FILTER_LABEL} style={{ color: "var(--muted-foreground)" }}>{t('myHistory.filterTo')}</span>
              <input
                type="date"
                value={chartFilterTo}
                onChange={(e) => setChartFilterTo(e.target.value)}
                className="rounded-[8px] border px-3 py-1.5 text-[13px]"
                style={SELECT_STYLE}
              />
            </div>
            {allCategories.length > 0 && (
              <div className="flex flex-col gap-[4px] min-w-[150px]">
                <span className={FILTER_LABEL} style={{ color: "var(--muted-foreground)" }}>{t('myHistory.filterCategoria')}</span>
                <select
                  value={chartFilterCategoria}
                  onChange={(e) => setChartFilterCategoria(e.target.value)}
                  className="rounded-[8px] border px-3 py-1.5 text-[13px]"
                  style={SELECT_STYLE}
                >
                  <option value="todas">{t('myHistory.allCategories')}</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {etiquetas.length > 0 && (
              <div className="flex flex-col gap-[4px] min-w-[150px]">
                <span className={FILTER_LABEL} style={{ color: "var(--muted-foreground)" }}>{t('myHistory.filterEtiqueta')}</span>
                <select
                  value={chartFilterEtiqueta}
                  onChange={(e) => setChartFilterEtiqueta(e.target.value)}
                  className="rounded-[8px] border px-3 py-1.5 text-[13px]"
                  style={SELECT_STYLE}
                >
                  <option value="todas">{t('myHistory.allEtiquetas')}</option>
                  {etiquetas.map((et) => (
                    <option key={et.id} value={et.id}>{et.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI cards (react to filters) ── */}
        <div className="grid gap-[16px] sm:grid-cols-3">
          {kpis.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-[20px] p-[22px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-[8px]">
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-[10px]"
                  style={{ background: "var(--coral-soft)" }}
                >
                  <Icon className="size-4" style={{ color: "var(--coral-text)" }} strokeWidth={1.8} />
                </div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "var(--muted-foreground)" }}>
                  {label}
                </div>
              </div>
              <div className="mt-[12px] font-display text-[34px] font-medium leading-none tracking-tight tabular-nums" style={{ color: "var(--foreground)" }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <>
            {/* ── Trend chart ── */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
                <div className="flex items-center gap-[10px]">
                  <TrendingUp className="size-4" style={{ color: "var(--accent)" }} />
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('myHistory.weeklyAvg')}</h2>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {t('myHistory.trendDesc')}
                    </p>
                  </div>
                  {trendData.length > 0 && (
                    <span
                      className="rounded-full px-[10px] py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.08em]"
                      style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
                    >
                      {t('myHistory.yearlyAvg', { pct: chartAverage })}
                    </span>
                  )}
                </div>
                {/* Semana / Mes / Trimestre toggle */}
                <div className="flex gap-1 rounded-lg border border-border bg-[var(--surface-2)] p-1">
                  {(["week", "month", "quarter"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        chartView === v
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v === "week" ? t('myHistory.viewWeek') : v === "month" ? t('myHistory.viewMonth') : t('myHistory.viewQuarter')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 px-2 pb-4">
                {trendData.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5">
                    <div className="grid size-10 place-items-center rounded-xl bg-[var(--surface-2)]">
                      <TrendingUp className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('myHistory.noData')}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="periodo"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        axisLine={{ stroke: "var(--border)" }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
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
                          `${value}% · ${entry.payload.count} ${entry.payload.count === 1 ? t('myHistory.session') : t('myHistory.sessions')}`,
                          t('myHistory.avgScore'),
                        ]}
                      />
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

            {/* ── Card filters ── */}
            <div className="flex flex-wrap items-center gap-[10px]">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('myHistory.searchPlaceholder')}
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
                  <option value="todos">{t('myHistory.allMonths')}</option>
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
                  <option value="todas">{t('myHistory.allCategories')}</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              {etiquetas.length > 0 && (
                <select
                  value={filterEtiqueta}
                  onChange={(e) => setFilterEtiqueta(e.target.value)}
                  className="rounded-[10px] border px-3 py-2 text-[13px]"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                >
                  <option value="todas">{t('myHistory.allEtiquetas')}</option>
                  {etiquetas.map((et) => (
                    <option key={et.id} value={et.id}>{et.nombre}</option>
                  ))}
                </select>
              )}
              <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--text-faint)" }}>
                {t('myHistory.countOf', { count: filtered.length, total: results.length })}
              </span>
            </div>

            {/* ── History cards ── */}
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
                  {t('myHistory.noFiltered')}
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
                              {t('myHistory.attemptOf', { n: attemptNumber, total: totalAttempts })}
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
                            <span>{t('evaluations.created')} {formatDateTime(result.evaluations.created_at)}</span>
                          </div>
                        )}
                        {result.completed_at && (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#059669" }}>
                            <CheckCircle className="size-3 shrink-0" />
                            <span>{t('participant.submitted')} {formatDateTime(result.completed_at)}</span>
                          </div>
                        )}
                      </div>

                      <Button asChild variant="outline" size="sm" className="w-full mt-auto">
                        <Link to="/my-results/$id" params={{ id: result.id }}>
                          {t('myHistory.viewResults')}
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
              {t('myHistory.noCompleted')}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
