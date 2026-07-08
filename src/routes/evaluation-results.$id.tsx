import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { resultsService, evaluationsService, questionsService, areasService, getAnswerStatus } from "@/lib/services/evaluations";
import { ArrowLeft, TrendingUp, Users, Award, CheckCircle, XCircle, Download, ChevronDown, ChevronRight, Clock, CalendarDays, Building2, Hash, Percent, RefreshCw, CalendarCheck, CalendarOff, ImageDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/evaluation-results/$id")({
  head: () => ({ meta: [{ title: "Resultados de Evaluación — EvalPro" }] }),
  component: EvaluationResultsPage,
});

function formatDuration(startedAt: string, completedAt: string): string {
  if (!startedAt || !completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const EVALPRO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ED5650" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function drawResultsCard(
  canvas: HTMLCanvasElement,
  ev: any,
  areaObj: any | null,
  resultsData: any[],
  stats: { totalParticipants: number; averageScore: number; passRate: number; bestScore: number },
  analytics: { text: string; errorRate: number; attempts: number }[],
  passingThreshold: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = 800;
  const PAD = 32;
  const ACCENT = "#ED5650";
  const SW = W - PAD * 2;

  const hasDesc = !!ev?.description;
  const hasArea = !!areaObj?.name;
  const hasDates = !!(ev?.created_at || ev?.fecha_vencimiento);
  const rows = resultsData;
  const qRows = analytics;

  let H = 68;
  H += 28;
  if (hasDesc) H += 22;
  if (hasArea) H += 22;
  H += 16 + 96 + 8;
  if (hasDates) H += 64 + 8;
  H += 16 + 12 + 96 + 8;
  if (rows.length > 0) H += 16 + 12 + 28 + rows.length * 40 + 8;
  if (qRows.length > 0) H += 16 + 12 + qRows.length * 44 + 8;
  H += 60;

  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(2, 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, 5, H);
  const barGrad = ctx.createLinearGradient(5, 0, 24, 0);
  barGrad.addColorStop(0, "rgba(237,86,80,0.09)");
  barGrad.addColorStop(1, "transparent");
  ctx.fillStyle = barGrad;
  ctx.fillRect(5, 0, 19, H);

  function trunc(text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  function secLabel(label: string, y: number) {
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y);
    const lw = ctx.measureText(label).width + 10;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD + lw, y - 4);
    ctx.lineTo(W - PAD, y - 4);
    ctx.stroke();
  }

  function statsBox(y: number, items: { label: string; value: string; color: string }[]) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(PAD, y, SW, 96, 14);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(PAD, y, SW, 96, 14);
    ctx.stroke();
    const col = SW / items.length;
    items.forEach((item, i) => {
      const cx = PAD + i * col + col / 2;
      if (i > 0) {
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD + i * col, y + 14);
        ctx.lineTo(PAD + i * col, y + 82);
        ctx.stroke();
      }
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(item.label, cx, y + 26);
      ctx.font = "bold 22px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = item.color;
      ctx.fillText(item.value, cx, y + 70);
    });
    ctx.textAlign = "left";
  }

  // Header (0–68)
  const LOGO_H = 38;
  const bLabel = "INFORME";
  ctx.font = "bold 10px system-ui";
  const bW = ctx.measureText(bLabel).width + 20;
  const bX = W - bW - PAD;
  ctx.font = "bold 19px 'Space Grotesk', system-ui, sans-serif";
  const evalW = ctx.measureText("Eval").width;
  const blockW = LOGO_H + 10 + evalW + ctx.measureText("Pro").width;
  const blockX = bX - 20 - blockW;

  try {
    const blob = new Blob([EVALPRO_LOGO_SVG], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const logo = await loadImage(url);
    ctx.drawImage(logo, blockX, 14, LOGO_H, LOGO_H);
    URL.revokeObjectURL(url);
  } catch { /* skip */ }

  const txtX = blockX + LOGO_H + 10;
  ctx.font = "bold 19px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  ctx.fillText("Eval", txtX, 38);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Pro", txtX + evalW, 38);

  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.roundRect(bX, 20, bW, 21, 10);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bX, 20, bW, 21, 10);
  ctx.stroke();
  ctx.font = "bold 10px system-ui";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.fillText(bLabel, bX + bW / 2, 33);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 68);
  ctx.lineTo(W - PAD, 68);
  ctx.stroke();

  // Title + description + area
  let y = 68;
  const createdDate = ev?.created_at ? new Date(ev.created_at) : null;
  const weekNum = createdDate ? getISOWeek(createdDate) : null;

  y += 28;
  ctx.textAlign = "left";
  let pillW = 0;
  if (weekNum) {
    ctx.font = "bold 11px system-ui, sans-serif";
    pillW = ctx.measureText(`Semana ${weekNum}`).width + 20 + 10;
  }
  ctx.font = "bold 21px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(trunc(ev?.title || "Evaluación", W - PAD * 2 - pillW), PAD, y);

  if (weekNum) {
    const wLabel = `Semana ${weekNum}`;
    ctx.font = "bold 11px system-ui, sans-serif";
    const wW = ctx.measureText(wLabel).width + 20;
    const px = W - PAD - wW;
    ctx.fillStyle = "#FFE7E6";
    ctx.beginPath();
    ctx.roundRect(px, y - 16, wW, 22, 11);
    ctx.fill();
    ctx.strokeStyle = "#FBBDB9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, y - 16, wW, 22, 11);
    ctx.stroke();
    ctx.fillStyle = "#B13833";
    ctx.textAlign = "center";
    ctx.fillText(wLabel, px + wW / 2, y);
    ctx.textAlign = "left";
  }

  if (hasDesc) {
    y += 22;
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(trunc(ev.description, W - PAD * 2), PAD, y);
  }

  if (hasArea) {
    y += 22;
    ctx.font = "11px system-ui, sans-serif";
    const aw = ctx.measureText(areaObj.name).width + 16;
    ctx.fillStyle = "rgba(109,40,217,0.1)";
    ctx.beginPath();
    ctx.roundRect(PAD, y - 14, aw, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#7c3aed";
    ctx.fillText(areaObj.name, PAD + 8, y);
  }

  // Config stats
  y += 16;
  statsBox(y, [
    { label: "APROBACIÓN", value: ev?.config?.porcentaje_aprobacion != null ? `${ev.config.porcentaje_aprobacion}%` : "—", color: "#059669" },
    { label: "PREGUNTAS",  value: ev?.config?.num_preguntas != null ? String(ev.config.num_preguntas) : "—", color: "#2563eb" },
    { label: "TIEMPO",     value: ev?.tiempo_limite > 0 ? `${ev.tiempo_limite} min` : "Sin límite", color: "#d97706" },
    { label: "INTENTOS",   value: ev?.intentos_permitidos != null ? String(ev.intentos_permitidos) : "—", color: "#7c3aed" },
  ]);
  y += 96 + 8;

  // Dates
  if (hasDates) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(PAD, y, SW, 64, 12);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(PAD, y, SW, 64, 12);
    ctx.stroke();

    const LY = y + 22;
    const VY = y + 50;

    if (createdDate && ev?.fecha_vencimiento) {
      ctx.beginPath();
      ctx.moveTo(W / 2, y + 12);
      ctx.lineTo(W / 2, y + 52);
      ctx.stroke();
    }

    if (createdDate) {
      const dStr = createdDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      const cxd = ev?.fecha_vencimiento ? PAD + SW / 4 : W / 2;
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("CREADA", cxd, LY);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText(dStr, cxd, VY);
    }

    if (ev?.fecha_vencimiento) {
      const vStr = new Date(ev.fecha_vencimiento).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      const vx = createdDate ? W - PAD - SW / 4 : W / 2;
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("VENCE", vx, LY);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText(vStr, vx, VY);
    }
    ctx.textAlign = "left";
    y += 64 + 8;
  }

  // Results metrics
  y += 16;
  secLabel("RESULTADOS GENERALES", y);
  y += 12;
  statsBox(y, [
    { label: "PARTICIPANTES",   value: String(stats.totalParticipants), color: "#2563eb" },
    { label: "PROMEDIO",        value: `${stats.averageScore}%`,        color: "#d97706" },
    { label: "TASA APROBACIÓN", value: `${stats.passRate}%`,            color: "#059669" },
    { label: "MEJOR PUNTAJE",   value: `${stats.bestScore}%`,           color: "#7c3aed" },
  ]);
  y += 96 + 8;

  // Participants table
  if (rows.length > 0) {
    y += 16;
    secLabel("DETALLE POR PARTICIPANTE", y);
    y += 12;

    const COLS = [220, 76, 76, 110, 76, 178];
    const HDRS = ["PARTICIPANTE", "INTENTO", "PUNTAJE", "ESTADO", "TIEMPO", "FECHA"];

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(PAD, y, SW, 28);
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let hx = PAD + 8;
    HDRS.forEach((h, i) => {
      ctx.textAlign = i === 0 ? "left" : "center";
      ctx.fillText(h, i === 0 ? hx : hx + COLS[i] / 2, y + 18);
      hx += COLS[i];
    });

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y + 28);
    ctx.lineTo(W - PAD, y + 28);
    ctx.stroke();
    y += 28;

    rows.forEach((r: any, idx: number) => {
      const ry = y;
      if (idx % 2 === 0) {
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(PAD, ry, SW, 40);
      }
      const approved = r.score >= passingThreshold;
      let rx = PAD + 8;
      const ty = ry + 25;

      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.textAlign = "left";
      ctx.fillText(trunc(r.profiles?.full_name || "Sin nombre", COLS[0] - 16), rx, ty);
      rx += COLS[0];

      const iLabel = `Intento ${r.attemptNumber}`;
      ctx.font = "bold 9px system-ui, sans-serif";
      const iW = ctx.measureText(iLabel).width + 12;
      ctx.fillStyle = "rgba(37,99,235,0.1)";
      ctx.beginPath();
      ctx.roundRect(rx + COLS[1] / 2 - iW / 2, ry + 12, iW, 16, 8);
      ctx.fill();
      ctx.fillStyle = "#2563eb";
      ctx.textAlign = "center";
      ctx.fillText(iLabel, rx + COLS[1] / 2, ry + 23);
      rx += COLS[1];

      ctx.font = "bold 14px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = approved ? "#059669" : "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText(`${r.score}%`, rx + COLS[2] / 2, ty);
      rx += COLS[2];

      const eLabel = approved ? "APROBADO" : "REPROBADO";
      ctx.font = "bold 8px system-ui, sans-serif";
      const eW = ctx.measureText(eLabel).width + 14;
      ctx.fillStyle = approved ? "rgba(5,150,105,0.1)" : "rgba(239,68,68,0.1)";
      ctx.beginPath();
      ctx.roundRect(rx + COLS[3] / 2 - eW / 2, ry + 10, eW, 18, 4);
      ctx.fill();
      ctx.fillStyle = approved ? "#059669" : "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText(eLabel, rx + COLS[3] / 2, ry + 23);
      rx += COLS[3];

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(formatDuration(r.started_at, r.completed_at), rx + COLS[4] / 2, ty);
      rx += COLS[4];

      const ds = r.completed_at
        ? new Date(r.completed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
        : "—";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(ds, rx + COLS[5] / 2, ty);

      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, ry + 40);
      ctx.lineTo(W - PAD, ry + 40);
      ctx.stroke();

      y += 40;
    });
    y += 8;
  }

  // Analytics
  if (qRows.length > 0) {
    y += 16;
    secLabel("ANALYTICS POR PREGUNTA", y);
    y += 12;

    qRows.forEach((q: any, idx: number) => {
      const ry = y;
      if (idx % 2 === 0) {
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(PAD, ry, SW, 44);
      }
      const errColor = q.errorRate >= 70 ? "#ef4444" : q.errorRate >= 40 ? "#d97706" : "#059669";

      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText(String(idx + 1), PAD + 8, ry + 18);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText(trunc(q.text, SW - 120), PAD + 24, ry + 18);

      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = errColor;
      ctx.textAlign = "right";
      ctx.fillText(`${q.errorRate}% errores`, W - PAD - 8, ry + 18);

      const BX = PAD + 24;
      const BW = SW - 100;
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.roundRect(BX, ry + 26, BW, 6, 3);
      ctx.fill();
      const fw = BW * (q.errorRate / 100);
      if (fw > 0) {
        ctx.fillStyle = errColor;
        ctx.beginPath();
        ctx.roundRect(BX, ry + 26, fw, 6, 3);
        ctx.fill();
      }

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "right";
      ctx.fillText(`${q.attempts} part.`, W - PAD - 8, ry + 38);

      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, ry + 44);
      ctx.lineTo(W - PAD, ry + 44);
      ctx.stroke();

      y += 44;
    });
    y += 8;
  }

  // Footer
  const fY = H - 60;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, fY, W, 60);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, fY);
  ctx.lineTo(W, fY);
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(PAD, fY + 31, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "left";
  ctx.fillText("evalpro.apps.dataico.world", PAD + 12, fY + 35);
  ctx.fillStyle = "#cbd5e1";
  ctx.textAlign = "right";
  ctx.fillText("Informe desde EvalPro", W - PAD, fY + 35);
  ctx.textAlign = "left";
}

function getDificultadClass(dificultad: string): string {
  const d = (dificultad || "").toLowerCase();
  if (d.includes("fácil") || d.includes("facil") || d === "bajo")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (d.includes("medio") || d === "intermedio")
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (d.includes("difícil") || d.includes("dificil") || d === "alto")
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return "bg-secondary text-muted-foreground";
}

function EvaluationResultsPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  useEffect(() => {
    if (!profile || !isAdmin) return;
    if (!permLoading && !canAccess('results')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [area, setArea] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ totalParticipants: 0, averageScore: 0, passRate: 0, bestScore: 0 });
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [attemptFilter, setAttemptFilter] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;
      if (!isAdmin) {
        navigate({ to: "/participant" });
        return;
      }
      if (!id) return;

      try {
        setLoading(true);

        const [evalData, areasData, resultsData] = await Promise.all([
          evaluationsService.getById(id),
          areasService.getAll(),
          resultsService.getByEvaluationId(id),
        ]);
        setEvaluation(evalData);
        setArea(areasData.find((a: any) => a.id === evalData.area_id) ?? null);
        setResults(resultsData);

        const allQuestionIds = new Set<string>();
        resultsData.forEach((result: any) => {
          if (result.answers) {
            Object.keys(result.answers).forEach((qId) => allQuestionIds.add(qId));
          }
        });

        if (allQuestionIds.size > 0) {
          const questionsData = await questionsService.getByIds(Array.from(allQuestionIds));
          const questionsById: Record<string, any> = {};
          questionsData.forEach((q: any) => {
            questionsById[q.id] = q;
          });
          setQuestionsMap(questionsById);
        }

        const totalParticipants = resultsData.length;
        const averageScore =
          totalParticipants > 0
            ? Math.round(resultsData.reduce((sum: number, r: any) => sum + r.score, 0) / totalParticipants)
            : 0;
        const passingThreshold = evalData?.config?.porcentaje_aprobacion ?? 60;
        const passRate =
          totalParticipants > 0
            ? Math.round(
                (resultsData.filter((r: any) => r.score >= passingThreshold).length / totalParticipants) * 100
              )
            : 0;
        const bestScore =
          totalParticipants > 0 ? Math.max(...resultsData.map((r: any) => r.score)) : 0;

        setStats({ totalParticipants, averageScore, passRate, bestScore });
      } catch (err) {
        console.error("Error loading evaluation results:", err);
        setError(t('evalResults.loadError'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile, isAdmin, id, navigate]);

  const resultsWithAttempt = useMemo(() => {
    const byUser: Record<string, any[]> = {};
    results.forEach((r: any) => {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    });
    const attemptNumberById: Record<string, number> = {};
    Object.values(byUser).forEach((userResults) => {
      [...userResults]
        .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
        .forEach((r, index) => {
          attemptNumberById[r.id] = index + 1;
        });
    });
    return results.map((r: any) => ({ ...r, attemptNumber: attemptNumberById[r.id] ?? 1 }));
  }, [results]);

  const maxAttemptNumber = useMemo(() => {
    return resultsWithAttempt.reduce((max, r) => Math.max(max, r.attemptNumber), 0);
  }, [resultsWithAttempt]);

  const displayResults = useMemo(() => {
    if (attemptFilter === null) return resultsWithAttempt;
    return resultsWithAttempt.filter((r) => r.attemptNumber === attemptFilter);
  }, [resultsWithAttempt, attemptFilter]);

  const questionAnalytics = useMemo(() => {
    if (!results.length || !Object.keys(questionsMap).length) return [];

    const qStats: Record<string, { questionId: string; text: string; attempts: number; correct: number }> = {};

    results.forEach((r: any) => {
      if (!r.answers) return;
      Object.keys(r.answers).forEach((qId) => {
        const q = questionsMap[qId];
        if (!q) return;
        if (!qStats[qId]) {
          qStats[qId] = { questionId: qId, text: q.question_text, attempts: 0, correct: 0 };
        }
        const userAns = r.answers[qId]
          ? String(r.answers[qId])
              .split(",")
              .map((a: string) => a.trim())
          : [];
        const correctAns = q.correct_answer.split(",").map((a: string) => a.trim());
        const allCorrect = userAns.length > 0 && userAns.every((a: string) => correctAns.includes(a));
        const allSelected = correctAns.every((a: string) => userAns.includes(a));
        qStats[qId].attempts++;
        if (allCorrect && allSelected) qStats[qId].correct++;
      });
    });

    return Object.values(qStats)
      .map((s) => ({
        ...s,
        errorRate: s.attempts > 0 ? Math.round(((s.attempts - s.correct) / s.attempts) * 100) : 0,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);
  }, [results, questionsMap]);

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
    const passing = evaluation?.config?.porcentaje_aprobacion ?? 60;
    const headers = [
      "Participante",
      "Email",
      "Intento",
      "Puntaje",
      "Estado",
      "Correctas",
      "Parciales",
      "Incorrectas",
      "Tiempo",
      "Fecha Completado",
    ];
    const rows = resultsWithAttempt.map((r: any) => {
      let correct = 0,
        partial = 0,
        incorrect = 0;
      if (r.answers) {
        Object.keys(r.answers).forEach((qId) => {
          const q = questionsMap[qId];
          if (!q) return;
          const userAns = r.answers[qId]
            ? String(r.answers[qId])
                .split(",")
                .map((a: string) => a.trim())
            : [];
          const correctAns = q.correct_answer.split(",").map((a: string) => a.trim());
          const allCorrect = userAns.length > 0 && userAns.every((a: string) => correctAns.includes(a));
          const allSelected = correctAns.every((a: string) => userAns.includes(a));
          const isCorrect = allCorrect && allSelected;
          const hasSome = userAns.length > 0 && userAns.some((a: string) => correctAns.includes(a));
          if (isCorrect) correct++;
          else if (hasSome) partial++;
          else incorrect++;
        });
      }
      return [
        r.profiles?.full_name || "",
        r.profiles?.email || "",
        `Intento ${r.attemptNumber}`,
        String(r.score),
        r.score >= passing ? "APROBADO" : "REPROBADO",
        String(correct),
        String(partial),
        String(incorrect),
        formatDuration(r.started_at, r.completed_at),
        new Date(r.completed_at).toLocaleString("es-ES"),
      ];
    });
    const safe = (evaluation?.title || id).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv([headers, ...rows], `resultados-${safe}-${today}.csv`);
  }

  async function exportImage() {
    if (capturing) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      await drawResultsCard(
        canvas,
        evaluation,
        area,
        resultsWithAttempt,
        stats,
        questionAnalytics,
        evaluation?.config?.porcentaje_aprobacion ?? 60
      );
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      const safe = (evaluation?.title || id).replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      a.download = `resultados-${safe}-${today}.png`;
      a.click();
    } catch (err) {
      console.error("Error al generar imagen:", err);
    } finally {
      setCapturing(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t('evalResults.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">{t('evalResults.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title={t('evalResults.title')} />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={evaluation?.title || t('evalResults.title')}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportResultsCsv} disabled={results.length === 0}>
              <Download className="size-4" /> {t('common.export_csv')}
            </Button>
            <Button variant="outline" size="sm" onClick={exportImage} disabled={capturing || loading}>
              <ImageDown className="size-4" />
              {capturing ? t('common.generating') : t('common.export_png')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/evaluations">
                <ArrowLeft className="size-4" /> {t('evalResults.backToEvals')}
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{evaluation?.title || t('nav.evaluations')}</h1>
          {evaluation?.description && (
            <p className="mt-2 text-sm text-muted-foreground">{evaluation.description}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('evalResults.infoTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <CalendarDays className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('common.week')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.created_at
                    ? t('evalResults.weekN', { n: getISOWeek(new Date(evaluation.created_at)) })
                    : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <Building2 className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('common.area')}</p>
                <p className="text-sm font-semibold">{area?.name ?? t('evalResults.notDefined')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <Hash className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.numQuestions')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.config?.num_preguntas != null ? evaluation.config.num_preguntas : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <Percent className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.approvalPct')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.config?.porcentaje_aprobacion != null
                    ? `${evaluation.config.porcentaje_aprobacion}%`
                    : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <Clock className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.timeLimit')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.tiempo_limite != null
                    ? t('evalResults.minutesLimit', { n: evaluation.tiempo_limite })
                    : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <RefreshCw className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.attemptsAllowed')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.intentos_permitidos != null ? evaluation.intentos_permitidos : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <CalendarCheck className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.createdAt')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.created_at
                    ? new Date(evaluation.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--coral-soft)" }}>
                <CalendarOff className="size-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('evalResults.expiresAt')}</p>
                <p className="text-sm font-semibold">
                  {evaluation?.fecha_vencimiento
                    ? new Date(evaluation.fecha_vencimiento).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : t('evalResults.notDefined')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="size-4" />
              {t('common.participants')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.totalParticipants}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-4" />
              {t('common.average')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.averageScore}%</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4" />
              {t('results.approvalRate')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.passRate}%</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Award className="size-4" />
              {t('results.bestScore')}
            </div>
            <div className="mt-2 font-mono text-3xl font-bold">{stats.bestScore}%</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">{t('results.participantReport')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{t('evalResults.participantReportDesc')}</p>
              </div>
              {maxAttemptNumber > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('evalResults.filterAttempt')}</span>
                  <button
                    onClick={() => setAttemptFilter(null)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                      attemptFilter === null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {t('evalResults.allAttempts', { count: resultsWithAttempt.length })}
                  </button>
                  {Array.from({ length: maxAttemptNumber }, (_, i) => i + 1).map((n) => {
                    const count = resultsWithAttempt.filter((r) => r.attemptNumber === n).length;
                    return (
                      <button
                        key={n}
                        onClick={() => setAttemptFilter(n)}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                          attemptFilter === n
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                        }`}
                      >
                        {t('evalResults.attemptN', { n, count })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground p-6">
                <p>{t('evalResults.noResults')}</p>
              </div>
            ) : displayResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground p-6">
                <p>{t('evalResults.noResultsFiltered', { n: attemptFilter })}</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 font-bold">{t('evalResults.colParticipant')}</th>
                    {maxAttemptNumber > 1 && <th className="px-6 py-3 font-bold">{t('evalResults.colAttempt')}</th>}
                    <th className="px-6 py-3 font-bold">{t('evalResults.colScore')}</th>
                    <th className="px-6 py-3 font-bold text-emerald-600 dark:text-emerald-400">✓</th>
                    <th className="px-6 py-3 font-bold text-amber-600 dark:text-amber-400">~</th>
                    <th className="px-6 py-3 font-bold text-red-600 dark:text-red-400">✗</th>
                    <th className="px-6 py-3 font-bold">{t('evalResults.colStatus')}</th>
                    <th className="px-6 py-3 font-bold">{t('evalResults.colDate')}</th>
                    <th className="px-6 py-3 font-bold">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {t('evalResults.colTime')}
                      </span>
                    </th>
                    <th className="px-6 py-3 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[...displayResults].sort((a, b) => b.score - a.score).map((result: any) => {
                    let correctCount = 0;
                    let partialCount = 0;
                    let incorrectCount = 0;

                    if (result.answers && Object.keys(result.answers).length > 0) {
                      Object.keys(result.answers).forEach((questionId) => {
                        const question = questionsMap[questionId];
                        if (!question) return;
                        const status = getAnswerStatus(question, result.answers[questionId]);
                        if (status === "correct") correctCount++;
                        else if (status === "partial") partialCount++;
                        else incorrectCount++;
                      });
                    }

                    const isExpanded = expandedResultId === result.id;
                    const passing = evaluation?.config?.porcentaje_aprobacion ?? 60;

                    return (
                      <React.Fragment key={result.id}>
                        <tr
                          className={`border-b border-border/50 hover:bg-secondary/40 transition-colors ${
                            isExpanded ? "bg-secondary/20" : ""
                          }`}
                        >
                          <td className="px-6 py-4 font-medium">
                            {result.profiles?.full_name || "Sin nombre"}
                          </td>
                          {maxAttemptNumber > 1 && (
                            <td className="px-6 py-4">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                {t('evalResults.attemptBadge', { n: result.attemptNumber })}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4 font-mono font-bold text-accent">{result.score}%</td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {correctCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                            {partialCount}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm font-bold text-red-600 dark:text-red-400">
                            {incorrectCount}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-bold ${
                                result.score >= passing
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              }`}
                            >
                              {result.score >= passing ? t('common.approved') : t('common.failed')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {new Date(result.completed_at).toLocaleString("es-ES", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                            {formatDuration(result.started_at, result.completed_at)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setExpandedResultId(isExpanded ? null : result.id)}
                              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border hover:bg-secondary transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="size-3" /> {t('common.hide')}
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="size-3" /> {t('participant.viewDetail')}
                                </>
                              )}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50">
                            <td colSpan={maxAttemptNumber > 1 ? 10 : 9} className="px-6 py-5 bg-secondary/10">
                              <div className="space-y-3">
                                {!result.answers || Object.keys(result.answers).length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    {t('evalResults.noAnswers')}
                                  </p>
                                ) : (
                                  Object.keys(result.answers).map((questionId, qIndex) => {
                                    const question = questionsMap[questionId];
                                    if (!question) return null;

                                    const userAnswer = result.answers[questionId];
                                    const userAnswers = Array.isArray(userAnswer)
                                      ? userAnswer.map((a: string) => String(a).trim())
                                      : userAnswer
                                        ? [String(userAnswer).trim()]
                                        : [];
                                    const correctAnswers = question.correct_answer
                                      .split(",")
                                      .map((a: string) => a.trim());

                                    const status = getAnswerStatus(question, userAnswer ?? "");
                                    const isCorrect = status === "correct";
                                    const isPartial = status === "partial";

                                    const selectedCorrectCount = userAnswers.filter((a: string) =>
                                      correctAnswers.includes(a)
                                    ).length;

                                    return (
                                      <div
                                        key={questionId}
                                        className="rounded-lg border border-border bg-card p-4"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div
                                            className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center ${
                                              isCorrect
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                : isPartial
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                            }`}
                                          >
                                            {isCorrect ? (
                                              <CheckCircle className="size-3" />
                                            ) : isPartial ? (
                                              <TrendingUp className="size-3" />
                                            ) : (
                                              <XCircle className="size-3" />
                                            )}
                                          </div>
                                          <div className="flex-1 space-y-2 min-w-0">
                                            {/* Número, texto y badge de dificultad */}
                                            <div className="flex flex-wrap items-start gap-2">
                                              <div className="font-medium text-sm flex-1">
                                                <span className="text-muted-foreground mr-1">
                                                  {t('common.question')} {qIndex + 1}:
                                                </span>
                                                {question.question_text}
                                              </div>
                                              {question.dificultad && (
                                                <span
                                                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getDificultadClass(question.dificultad)}`}
                                                >
                                                  {question.dificultad}
                                                </span>
                                              )}
                                            </div>

                                            {/* Contexto */}
                                            {question.contexto && (
                                              <p
                                                className="rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
                                                style={{
                                                  borderColor: "var(--accent)",
                                                  background: "var(--secondary)",
                                                  color: "var(--muted-foreground)",
                                                }}
                                              >
                                                <strong style={{ color: "var(--foreground)" }}>
                                                  {t('common.context')}
                                                </strong>{" "}
                                                {question.contexto}
                                              </p>
                                            )}

                                            {/* Opciones */}
                                            <div className="space-y-1">
                                              {question.options.map((option: string, oIndex: number) => {
                                                const isSelected = userAnswers.includes(String(oIndex));
                                                const isOptionCorrect = correctAnswers.includes(
                                                  String(oIndex)
                                                );

                                                return (
                                                  <div
                                                    key={oIndex}
                                                    className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${
                                                      isSelected && isOptionCorrect
                                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                        : isSelected && !isOptionCorrect
                                                        ? "bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                                                        : isOptionCorrect
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
                                                        : "bg-background border border-transparent"
                                                    }`}
                                                  >
                                                    <div
                                                      className={`size-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                                        isSelected
                                                          ? "border-current bg-current"
                                                          : "border-muted"
                                                      }`}
                                                    >
                                                      {isSelected && (
                                                        <div className="size-2 rounded-sm bg-white" />
                                                      )}
                                                    </div>
                                                    <span className="flex-1">{option}</span>
                                                    {isOptionCorrect && !isSelected && (
                                                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                        {t('common.correct')}
                                                      </span>
                                                    )}
                                                    {isSelected && isOptionCorrect && (
                                                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                                        Tu respuesta ✓
                                                      </span>
                                                    )}
                                                    {isSelected && !isOptionCorrect && (
                                                      <span className="text-[10px] font-medium text-red-700 dark:text-red-400">
                                                        Tu respuesta ✗
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>

                                            {/* Detalle respuestas parciales */}
                                            {isPartial && (
                                              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                {t('evalResults.partialDetail', { correct: selectedCorrectCount, total: correctAnswers.length })}
                                              </p>
                                            )}

                                            {/* Justificación */}
                                            {question.justificacion && (
                                              <p
                                                className="mt-1 rounded-lg border-l-2 px-3 py-2 text-xs leading-relaxed"
                                                style={{
                                                  borderColor: "var(--accent)",
                                                  background: "var(--secondary)",
                                                  color: "var(--muted-foreground)",
                                                }}
                                              >
                                                <strong style={{ color: "var(--foreground)" }}>
                                                  {t('common.justification')}
                                                </strong>{" "}
                                                {question.justificacion}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Analytics por pregunta */}
        {questionAnalytics.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <h2 className="font-bold">{t('evalResults.analyticsTitle')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('evalResults.analyticsDesc')}
              </p>
            </div>
            <div className="divide-y divide-border">
              {questionAnalytics.map((qa, idx) => {
                const errorColor =
                  qa.errorRate >= 70
                    ? "bg-red-500"
                    : qa.errorRate >= 40
                    ? "bg-amber-400"
                    : "bg-emerald-400";
                const errorLabel =
                  qa.errorRate >= 70
                    ? "text-red-600"
                    : qa.errorRate >= 40
                    ? "text-amber-600"
                    : "text-emerald-600";
                return (
                  <div key={qa.questionId} className="flex items-start gap-4 p-4">
                    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{qa.text}</p>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full rounded-full transition-all ${errorColor}`}
                            style={{ width: `${qa.errorRate}%` }}
                          />
                        </div>
                        <span className={`w-24 shrink-0 font-mono text-xs font-bold ${errorLabel}`}>
                          {t('evalResults.errorRate', { rate: qa.errorRate })}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('evalResults.participants_abbr', { count: qa.attempts - qa.correct })}/{qa.attempts} participantes
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
