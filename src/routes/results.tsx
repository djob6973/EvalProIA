import { createFileRoute, useNavigate, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toTitleCase } from "@/lib/utils";
import {
  Download, Users, CheckCircle2, Clock, Trophy, TrendingUp, ClipboardList,
  ChevronLeft, ChevronRight, ArrowRight, Filter,
} from "lucide-react";
import { resultsService, areasService, evaluationsService, getAllParticipants } from "@/lib/services/evaluations";
import type { Area, Evaluation } from "@/lib/services/evaluations";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "Resultados Globales — EvalPro" }] }), // static head, translated at runtime in component
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

type TrendPoint = { periodo: string; promedio: number; count: number };
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
    return {
      sortKey: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: toTitleCase(date.toLocaleDateString(locale, { month: "short", year: "2-digit" })),
    };
  }
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  return { sortKey: `${y}-Q${q}`, label: `T${q} ${String(y).slice(2)}` };
}

const SELECT_CLASS =
  "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-foreground " +
  "transition-colors hover:border-[var(--border-strong)] focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent/20 cursor-pointer";

const FILTER_LABEL_CLASS =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

// KPI_ITEMS labels are replaced dynamically in the component using t()
const KPI_ITEM_ICONS = [ClipboardList, Users, CheckCircle2, Clock, Trophy] as const;

const MAX_BAR_H = 140;
const PT_PAGE_SIZE = 10;

// formatRelativeDate is now a hook-friendly function defined inside the component to access t()

function ResultsPage() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/results/participant/")) return <Outlet />;
  return <ResultsPageContent />;
}

function ResultsPageContent() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();

  function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t('common.today');
    if (days === 1) return t('common.yesterday');
    if (days < 7) return t('common.days_ago', { days });
    if (days < 30) return t('common.weeks_ago', { weeks: Math.floor(days / 7) });
    return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

  const KPI_ITEMS = [
    { label: t('results.totalEvaluations'), icon: KPI_ITEM_ICONS[0] },
    { label: t('results.totalSessions'), icon: KPI_ITEM_ICONS[1] },
    { label: t('results.approvalRate'), icon: KPI_ITEM_ICONS[2] },
    { label: t('results.avgDuration'), icon: KPI_ITEM_ICONS[3] },
    { label: t('results.bestScore'), icon: KPI_ITEM_ICONS[4] },
  ];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<RawResult[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [participants, setParticipants] = useState<
    { id: string; full_name: string | null; email: string; area_id: string | null }[]
  >([]);
  // Metrics tab filters
  const currentYear = new Date().getFullYear();
  const [mtFilterAreaId, setMtFilterAreaId] = useState<string>("all");
  const [mtFilterParticipantAreaId, setMtFilterParticipantAreaId] = useState<string>("all");
  const [mtFilterEvaluationId, setMtFilterEvaluationId] = useState<string>("all");
  const [mtFilterUserId, setMtFilterUserId] = useState<string>("all");
  const [mtFilterDateFrom, setMtFilterDateFrom] = useState(`${currentYear}-01-01`);
  const [mtFilterDateTo, setMtFilterDateTo] = useState(`${currentYear}-12-31`);
  const [mtChartView, setMtChartView] = useState<TrendView>("week");

  // Active tab
  const [activeTab, setActiveTab] = useState<"metrics" | "participants">("metrics");

  // Participant report filters
  const [ptFilterAreaId, setPtFilterAreaId] = useState("all");
  const [ptFilterUserId, setPtFilterUserId] = useState("all");
  const [ptFilterDateFrom, setPtFilterDateFrom] = useState(`${currentYear}-01-01`);
  const [ptFilterDateTo, setPtFilterDateTo] = useState(`${currentYear}-12-31`);
  const [ptPage, setPtPage] = useState(1);

  useEffect(() => { setPtPage(1); }, [ptFilterAreaId, ptFilterUserId, ptFilterDateFrom, ptFilterDateTo]);

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('results')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  useEffect(() => {
    async function loadResults() {
      if (!isAdmin) return;
      try {
        setLoading(true);
        const [rawResults, rawAreas, rawEvaluations, rawParticipants] = await Promise.all([
          resultsService.getAll(),
          areasService.getAll(),
          evaluationsService.getAll(),
          getAllParticipants(),
        ]);

        setAllResults(rawResults as RawResult[]);
        setAreas(rawAreas);
        setEvaluations(rawEvaluations);
        setParticipants(
          rawParticipants.map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            area_id: p.area_id,
          }))
        );
      } catch (err) {
        console.error("Error loading results:", err);
        setError(t('results.loadError'));
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [isAdmin]);

  const participantsById = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string | null; email: string; area_id: string | null }>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  // "none" is a sentinel for evaluations with no area assigned (area_id is null)
  const matchesMtEvalArea = (evalAreaId: string | null | undefined) =>
    mtFilterAreaId === "all" ? true : mtFilterAreaId === "none" ? !evalAreaId : evalAreaId === mtFilterAreaId;

  // Metrics tab: results filtered by the shared filter bar
  const metricsFiltered = useMemo(() => {
    return allResults.filter((r) => {
      if (!matchesMtEvalArea(r.evaluations?.area_id)) return false;
      if (mtFilterParticipantAreaId !== "all" && participantsById.get(r.user_id)?.area_id !== mtFilterParticipantAreaId) return false;
      if (mtFilterEvaluationId !== "all" && r.evaluation_id !== mtFilterEvaluationId) return false;
      if (mtFilterUserId !== "all" && r.user_id !== mtFilterUserId) return false;
      if (mtFilterDateFrom && new Date(r.completed_at) < new Date(mtFilterDateFrom)) return false;
      if (mtFilterDateTo && new Date(r.completed_at) > new Date(mtFilterDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [allResults, participantsById, mtFilterAreaId, mtFilterParticipantAreaId, mtFilterEvaluationId, mtFilterUserId, mtFilterDateFrom, mtFilterDateTo]);

  // Metrics tab: participant select only lists participants who actually have results under the current area/evaluation/date filters
  const mtParticipantOptions = useMemo(() => {
    const relevantUserIds = new Set(
      allResults
        .filter((r) => {
          if (!matchesMtEvalArea(r.evaluations?.area_id)) return false;
          if (mtFilterParticipantAreaId !== "all" && participantsById.get(r.user_id)?.area_id !== mtFilterParticipantAreaId) return false;
          if (mtFilterEvaluationId !== "all" && r.evaluation_id !== mtFilterEvaluationId) return false;
          if (mtFilterDateFrom && new Date(r.completed_at) < new Date(mtFilterDateFrom)) return false;
          if (mtFilterDateTo && new Date(r.completed_at) > new Date(mtFilterDateTo + "T23:59:59")) return false;
          return true;
        })
        .map((r) => r.user_id)
    );
    return participants.filter((p) => relevantUserIds.has(p.id));
  }, [allResults, participants, participantsById, mtFilterAreaId, mtFilterParticipantAreaId, mtFilterEvaluationId, mtFilterDateFrom, mtFilterDateTo]);

  // If the selected participant falls out of the available options (area filters changed), reset it
  useEffect(() => {
    if (mtFilterUserId !== "all" && !mtParticipantOptions.some((p) => p.id === mtFilterUserId)) {
      setMtFilterUserId("all");
    }
  }, [mtParticipantOptions, mtFilterUserId]);

  const stats = useMemo(() => {
    const total = metricsFiltered.length;
    const totalEvaluations = new Set(metricsFiltered.map((r) => r.evaluation_id)).size;
    const passRate = total > 0 ? Math.round((metricsFiltered.filter((r) => r.score >= 60).length / total) * 100) : 0;
    const bestScore = total > 0 ? Math.max(...metricsFiltered.map((r) => r.score)) : 0;
    const durations = metricsFiltered
      .filter((r) => r.started_at && r.completed_at)
      .map((r) => (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 60000)
      .filter((d) => d > 0 && d < 240);
    const avgDuration = durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : 0;
    return { totalEvaluations, totalSessions: total, passRate, avgDuration, bestScore };
  }, [metricsFiltered]);

  const distribution = useMemo(() => {
    const ranges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];
    return ranges.map((r) => ({
      range: r.range,
      count: metricsFiltered.filter((res) => res.score >= r.min && res.score <= r.max).length,
    }));
  }, [metricsFiltered]);

  const topPerformers = useMemo(() => {
    return [...metricsFiltered]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((res) => ({
        name: toTitleCase(res.profiles?.full_name) || res.profiles?.email || "Usuario",
        score: res.score,
        eval: res.evaluations?.title || "Evaluación",
      }));
  }, [metricsFiltered]);

  const trendData = useMemo<TrendPoint[]>(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    for (const r of metricsFiltered) {
      const { sortKey, label } = getTrendBucket(new Date(r.completed_at), mtChartView, i18n.language);
      const existing = map.get(sortKey) ?? { label, total: 0, count: 0 };
      map.set(sortKey, { label, total: existing.total + r.score, count: existing.count + 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, { label, total, count }]) => ({
        periodo: label,
        promedio: Math.round((total / count) * 10) / 10,
        count,
      }));
  }, [metricsFiltered, mtChartView, i18n.language]);

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
        const name = toTitleCase(p?.full_name || userResults[0]?.profiles?.full_name) || "Usuario";
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

  // Participant select only lists participants who actually have results under the current area/date filters
  const ptParticipantOptions = useMemo(() => {
    return participantStats.filter((p) => {
      if (ptFilterAreaId !== "all" && p.areaId !== ptFilterAreaId) return false;
      if (ptFilterDateFrom && new Date(p.lastActivity).getTime() < new Date(ptFilterDateFrom).getTime()) return false;
      if (ptFilterDateTo && new Date(p.lastActivity).getTime() > new Date(ptFilterDateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [participantStats, ptFilterAreaId, ptFilterDateFrom, ptFilterDateTo]);

  useEffect(() => {
    if (ptFilterUserId !== "all" && !ptParticipantOptions.some((p) => p.userId === ptFilterUserId)) {
      setPtFilterUserId("all");
    }
  }, [ptParticipantOptions, ptFilterUserId]);

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
    const headers = [
      t('results.csvParticipant'), t('results.csvEmail'), t('results.csvEvaluation'),
      t('results.csvArea'), t('results.csvScore'), t('results.csvStatus'), t('results.csvDate'),
    ];
    const rows = allResults.map((r) => {
      const area = areas.find((a) => a.id === r.evaluations?.area_id);
      return [
        r.profiles?.full_name || "",
        r.profiles?.email || "",
        r.evaluations?.title || "",
        area?.name || "",
        String(r.score),
        r.score >= 60 ? t('common.approved') : t('common.failed'),
        new Date(r.completed_at).toLocaleString("es-ES"),
      ];
    });
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv([headers, ...rows], `resultados-globales-${today}.csv`);
  }

  function exportParticipantsCsv() {
    const headers = [
      t('results.csvParticipant'), t('results.csvEmail'), t('results.csvArea'),
      t('results.colEvals'), t('results.colSessions'),
      t('results.colAvg'), t('results.colBest'), t('results.colLastActivity'),
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
    String(stats.totalEvaluations),
    String(stats.totalSessions),
    `${stats.passRate}%`,
    stats.avgDuration > 0 ? `${stats.avgDuration}m` : "—",
    `${stats.bestScore}/100`,
  ];

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('results.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">{t('results.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title={t('results.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        title={t('results.title')}
        actions={
          activeTab === "metrics" ? (
            <Button variant="outline" size="sm" onClick={exportResultsCsv} disabled={allResults.length === 0}>
              <Download className="size-4" /> {t('common.export_csv')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={exportParticipantsCsv} disabled={filteredParticipants.length === 0}>
              <Download className="size-4" /> {t('common.export_csv')}
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
              {tab === "metrics" ? t('results.tabMetrics') : t('results.tabParticipants')}
            </button>
          ))}
        </div>

        {/* ── MÉTRICAS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "metrics" && (
          <>
            {/* Filters */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-accent" strokeWidth={2.5} />
                  <span className="text-sm font-semibold text-foreground">{t('results.filters')}</span>
                </div>
                {(mtFilterAreaId !== "all" || mtFilterParticipantAreaId !== "all" || mtFilterEvaluationId !== "all" || mtFilterUserId !== "all" || mtFilterDateFrom || mtFilterDateTo) && (
                  <button
                    onClick={() => { setMtFilterAreaId("all"); setMtFilterParticipantAreaId("all"); setMtFilterEvaluationId("all"); setMtFilterUserId("all"); setMtFilterDateFrom(`${currentYear}-01-01`); setMtFilterDateTo(`${currentYear}-12-31`); }}
                    className="text-xs text-accent hover:underline"
                  >
                    {t('results.clearFilters')}
                  </button>
                )}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <div className="flex gap-2.5 rounded-lg border border-border bg-[var(--surface-2)] p-2.5" style={{ gridColumn: "span 2" }}>
                  <div className="min-w-0 flex-1">
                    <label className={FILTER_LABEL_CLASS}>{t('results.areaEvalLabel')}</label>
                    <select value={mtFilterAreaId} onChange={(e) => setMtFilterAreaId(e.target.value)} className={`${SELECT_CLASS} w-full`}>
                      <option value="all">{t('results.allAreas')}</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      <option value="none">{t('results.noArea')}</option>
                    </select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className={FILTER_LABEL_CLASS}>{t('results.areaParticipantLabel')}</label>
                    <select value={mtFilterParticipantAreaId} onChange={(e) => setMtFilterParticipantAreaId(e.target.value)} className={`${SELECT_CLASS} w-full`}>
                      <option value="all">{t('results.allAreas')}</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.evaluationLabel')}</label>
                  <select value={mtFilterEvaluationId} onChange={(e) => setMtFilterEvaluationId(e.target.value)} className={`${SELECT_CLASS} w-full`}>
                    <option value="all">{t('results.allEvaluations')}</option>
                    {evaluations.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.participantLabel')}</label>
                  <select value={mtFilterUserId} onChange={(e) => setMtFilterUserId(e.target.value)} className={`${SELECT_CLASS} w-full`}>
                    <option value="all">{t('results.allParticipants')}</option>
                    {mtParticipantOptions.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.from')}</label>
                  <input type="date" value={mtFilterDateFrom} onChange={(e) => setMtFilterDateFrom(e.target.value)} className={`${SELECT_CLASS} w-full`} />
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.to')}</label>
                  <input type="date" value={mtFilterDateTo} onChange={(e) => setMtFilterDateTo(e.target.value)} className={`${SELECT_CLASS} w-full`} />
                </div>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {KPI_ITEMS.map((k, i) => (
                <div key={k.label} className="dash-card p-[22px]">
                  <div className="flex items-center gap-1.5">
                    <k.icon className="size-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.5} />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "var(--muted-foreground)" }}>{k.label}</span>
                  </div>
                  <div className="mt-[10px] font-display text-[34px] font-medium leading-none tracking-tight tabular-nums" style={{ color: "var(--foreground)" }}>
                    {kpiValues[i]}
                  </div>
                </div>
              ))}
            </div>

            {/* Score trend chart */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t('results.trendTitle')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('results.trendDesc')}
                  </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-border bg-[var(--surface-2)] p-1">
                  {(["week", "month", "quarter"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setMtChartView(v)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        mtChartView === v
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v === "week" ? t('results.viewWeek') : v === "month" ? t('results.viewMonth') : t('results.viewQuarter')}
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
                    <p className="text-sm text-muted-foreground">{t('results.noData')}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="periodo"
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
                <h2 className="text-sm font-semibold text-foreground">{t('results.scoreDistribution')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('results.distributionDesc', { count: stats.totalSessions })}
                </p>
                {maxDist === 0 ? (
                  <div className="mt-6 flex h-36 items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('results.noSessions')}</p>
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
                <h2 className="text-sm font-semibold text-foreground">{t('results.topPerformers')}</h2>
                {topPerformers.length === 0 ? (
                  <div className="mt-6 flex h-28 items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('results.noTopData')}</p>
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
                          <div className="text-xs text-muted-foreground break-words" title={p.eval}>{p.eval}</div>
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
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-accent" strokeWidth={2.5} />
                  <span className="text-sm font-semibold text-foreground">{t('results.filters')}</span>
                </div>
                {(ptFilterAreaId !== "all" || ptFilterUserId !== "all" || ptFilterDateFrom || ptFilterDateTo) && (
                  <button
                    onClick={() => {
                      setPtFilterAreaId("all");
                      setPtFilterUserId("all");
                      setPtFilterDateFrom(`${currentYear}-01-01`);
                      setPtFilterDateTo(`${currentYear}-12-31`);
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    {t('results.clearFilters')}
                  </button>
                )}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.areaParticipantLabel')}</label>
                  <select
                    value={ptFilterAreaId}
                    onChange={(e) => setPtFilterAreaId(e.target.value)}
                    className={`${SELECT_CLASS} w-full`}
                  >
                    <option value="all">{t('results.allAreas')}</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.participantLabel')}</label>
                  <select
                    value={ptFilterUserId}
                    onChange={(e) => setPtFilterUserId(e.target.value)}
                    className={`${SELECT_CLASS} w-full`}
                  >
                    <option value="all">{t('results.allParticipants')}</option>
                    {ptParticipantOptions.map((p) => (
                      <option key={p.userId} value={p.userId}>{p.name || p.email}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.from')}</label>
                  <input
                    type="date"
                    value={ptFilterDateFrom}
                    onChange={(e) => setPtFilterDateFrom(e.target.value)}
                    className={`${SELECT_CLASS} w-full`}
                  />
                </div>
                <div className="min-w-0">
                  <label className={FILTER_LABEL_CLASS}>{t('results.to')}</label>
                  <input
                    type="date"
                    value={ptFilterDateTo}
                    onChange={(e) => setPtFilterDateTo(e.target.value)}
                    className={`${SELECT_CLASS} w-full`}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t('results.participantReport')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('results.participantDesc')}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t('results.participantCount', { count: filteredParticipants.length })}
                </span>
              </div>

              {filteredParticipants.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2.5 py-16">
                  <div className="grid size-10 place-items-center rounded-xl bg-[var(--surface-2)]">
                    <Users className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('results.noParticipants')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-[var(--surface-2)]">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colRank')}
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colParticipant')}
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                          {t('results.colArea')}
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colEvals')}
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colSessions')}
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colAvg')}
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                          {t('results.colBest')}
                        </th>

                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                          {t('results.colLastActivity')}
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('results.colActions')}
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
                    {t('results.page', { current: ptPage, total: ptTotalPages, count: filteredParticipants.length })}
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
