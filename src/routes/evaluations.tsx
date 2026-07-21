import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, memo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useDebounce } from "@/hooks/use-debounce";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Clock,
  CheckCircle,
  Tag,
  ToggleLeft,
  ToggleRight,
  Settings,
  Search,
  BarChart3,
  Calendar,
  CalendarX,
  Layers,
  Users,
  Copy,
  Loader2,
  Eye,
  Share2,
  MoreHorizontal,
  Download,
  Sparkles,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { toTitleCase } from "@/lib/utils";
import { Paginator } from "@/components/Paginator";
import { evaluationsService, getUniqueCategories, areasService, Area, evaluationParticipantsService, getAllParticipants, ParticipantProfile, questionsService, resultsService, FeedbackTrigger, etiquetasService, Etiqueta } from "@/lib/services/evaluations";
import { extractTextWithOCR } from "@/lib/services/openai";
import { defaultIdioma } from "@/components/foro/AiArticleGenerator";

export const Route = createFileRoute("/evaluations")({
  head: () => ({ meta: [{ title: "evaluations.pageTitle" }] }),
  component: EvaluationsPage,
});

type Config = {
  num_preguntas: number;
  dificultad: "mixto" | "facil" | "medio" | "dificil";
  dist_unica: number;
  dist_multiple: number;
  dist_vf: number;
  aleatorio: boolean;
  porcentaje_aprobacion: number;
  mostrar_opciones: boolean;
  mostrar_respuesta_seleccionada: boolean;
  mostrar_respuesta_correcta: boolean;
  mostrar_justificacion: boolean;
};

type Evaluation = {
  id: string;
  nombre: string;
  descripcion: string;
  tiempo_limite: number;
  intentos_permitidos: number;
  activa: boolean;
  categorias: string[];
  config: Config;
  created_at?: string;
  fecha_vencimiento?: string;
  area_id?: string | null;
  feedback_trigger: FeedbackTrigger;
  feedback_documento_texto: string;
  feedback_documento_nombre: string;
  etiqueta_id: string | null;
  detalle_respuestas_trigger: FeedbackTrigger;
};

function toLocalDateTimeInput(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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

function isExpired(ev: Evaluation): boolean {
  if (!ev.fecha_vencimiento) return false;
  return new Date(ev.fecha_vencimiento) < new Date();
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ── EvalPro logo SVG (inline para canvas) ───────────────────────────────────
const EVALPRO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ED5650" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

async function drawShareCard(canvas: HTMLCanvasElement, ev: Evaluation, areaName: string | null, brandLogo?: string | null, t?: (key: string) => string) {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 2× retina
  const W = 800, H = 440;
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(2, 2);

  const ACCENT = "#ED5650";
  const PAD = 32;
  const expired = isExpired(ev);
  const stateColor = expired ? "#ef4444" : ev.activa ? "#10b981" : "#94a3b8";
  const stateLabel = expired ? tr('evaluations.expired', 'VENCIDA') : ev.activa ? "ACTIVA" : tr('evaluations.inactive', 'INACTIVA').toUpperCase();

  // helper: truncate text to fit maxWidth with ellipsis
  function truncateFit(text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
    return t + "…";
  }

  // ── Background ────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── Vertical accent bar (left edge) ──────────────────
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, 5, H);
  const barShadow = ctx.createLinearGradient(5, 0, 24, 0);
  barShadow.addColorStop(0, "rgba(237,86,80,0.09)");
  barShadow.addColorStop(1, "transparent");
  ctx.fillStyle = barShadow;
  ctx.fillRect(5, 0, 19, H);

  // ── Header (y: 14–70) ─────────────────────────────────
  const LOGO_H = 38;

  // Status badge — measure first so EvalPro can anchor against it
  ctx.font = "bold 10px system-ui";
  const bW = ctx.measureText(stateLabel).width + 20;
  const bX = W - bW - PAD;

  // EvalPro block: Brain icon + "Eval" + "Pro"
  ctx.font = "bold 19px 'Space Grotesk', system-ui, sans-serif";
  const evalW = ctx.measureText("Eval").width;
  const proW  = ctx.measureText("Pro").width;
  const evalProBlockW = LOGO_H + 10 + evalW + proW;

  // With org logo: EvalPro floats to the right (gap before badge)
  // Without org logo: EvalPro anchors to the left at PAD
  const evalProX = brandLogo ? bX - 20 - evalProBlockW : PAD;

  // Org logo — left side (only when present)
  if (brandLogo) {
    try {
      const img = await loadImage(brandLogo);
      const maxW = 100;
      const scale = Math.min(maxW / img.width, LOGO_H / img.height);
      const dW = img.width * scale;
      const dH = img.height * scale;
      ctx.drawImage(img, PAD, 14 + (LOGO_H - dH) / 2, dW, dH);
    } catch { /* skip */ }
  }

  // Brain icon (EvalPro isotipo)
  try {
    const blob = new Blob([EVALPRO_LOGO_SVG], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const logo = await loadImage(url);
    ctx.drawImage(logo, evalProX, 14, LOGO_H, LOGO_H);
    URL.revokeObjectURL(url);
  } catch { /* skip */ }

  // "EvalPro" text
  const textStartX = evalProX + LOGO_H + 10;
  ctx.font = "bold 19px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Eval", textStartX, 38);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Pro", textStartX + evalW, 38);
  ctx.fillStyle = stateColor + "18";
  ctx.beginPath();
  ctx.roundRect(bX, 20, bW, 21, 10);
  ctx.fill();
  ctx.strokeStyle = stateColor + "50";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bX, 20, bW, 21, 10);
  ctx.stroke();
  ctx.font = "bold 10px system-ui";
  ctx.fillStyle = stateColor;
  ctx.textAlign = "center";
  ctx.fillText(stateLabel, bX + bW / 2, 33);
  ctx.textAlign = "left";

  // Header divider
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 68);
  ctx.lineTo(W - PAD, 68);
  ctx.stroke();

  // ── Title + Semana pill + description (y: 68–135) ──────
  const createdDate = ev.created_at ? new Date(ev.created_at) : null;
  const weekNum = createdDate ? getISOWeek(createdDate) : null;

  // Measure Semana pill width first so title can truncate accordingly
  let weekPillW = 0;
  if (weekNum) {
    ctx.font = "bold 11px system-ui, sans-serif";
    weekPillW = ctx.measureText(`${tr('evaluations.weekLabel', 'Semana')} ${weekNum}`).width + 20 + 10; // +10 gap
  }

  ctx.font = "bold 21px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(truncateFit(ev.nombre, W - PAD * 2 - weekPillW), PAD, 97);

  // Semana pill — right-aligned, vertically centered with title
  if (weekNum) {
    const wLabel = `${tr('evaluations.weekLabel', 'Semana')} ${weekNum}`;
    ctx.font = "bold 11px system-ui, sans-serif";
    const wW = ctx.measureText(wLabel).width + 20;
    const pillX = W - PAD - wW;
    ctx.fillStyle = "#FFE7E6";
    ctx.beginPath();
    ctx.roundRect(pillX, 81, wW, 22, 11);
    ctx.fill();
    ctx.strokeStyle = "#FBBDB9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, 81, wW, 22, 11);
    ctx.stroke();
    ctx.fillStyle = "#B13833";
    ctx.textAlign = "center";
    ctx.fillText(wLabel, pillX + wW / 2, 96);
    ctx.textAlign = "left";
  }

  if (ev.descripcion) {
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(truncateFit(ev.descripcion, W - PAD * 2), PAD, 120);
  }

  // ── Stats grid (y: 138–238) ───────────────────────────
  const STATS_Y = 138, STATS_H = 96;
  const STATS_W = W - PAD * 2;

  // Fondo del bloque stats
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(PAD, STATS_Y, STATS_W, STATS_H, 14);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(PAD, STATS_Y, STATS_W, STATS_H, 14);
  ctx.stroke();

  const stats = [
    { label: tr('evaluations.colApproval', 'APROBACIÓN'),  value: `${ev.config.porcentaje_aprobacion}%`, color: "#059669" },
    { label: tr('evaluations.colQuestions', 'PREGUNTAS'),  value: String(ev.config.num_preguntas),       color: "#2563eb" },
    { label: tr('evaluations.colTime', 'TIEMPO'),          value: ev.tiempo_limite > 0 ? `${ev.tiempo_limite} ${tr('common.min', 'min')}` : tr('common.noLimit', 'Sin límite'), color: "#d97706" },
    { label: tr('evaluations.colAttempts', 'INTENTOS'),    value: String(ev.intentos_permitidos),        color: "#7c3aed" },
  ];

  const COL = STATS_W / 4;
  stats.forEach((stat, i) => {
    const cX = PAD + i * COL + COL / 2;

    // Divider vertical (entre columnas)
    if (i > 0) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD + i * COL, STATS_Y + 14);
      ctx.lineTo(PAD + i * COL, STATS_Y + STATS_H - 14);
      ctx.stroke();
    }

    // Label pequeño uppercase
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(stat.label, cX, STATS_Y + 26);

    // Valor grande
    ctx.font = "bold 22px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, cX, STATS_Y + 70);
  });
  ctx.textAlign = "left";

  // ── Fechas (y: 248–312) — bloque 2 columnas ─────────
  const DATES_BOX_Y = 248, DATES_BOX_H = 64;
  const hasDates = !!(createdDate || ev.fecha_vencimiento);

  if (hasDates) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(PAD, DATES_BOX_Y, STATS_W, DATES_BOX_H, 12);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(PAD, DATES_BOX_Y, STATS_W, DATES_BOX_H, 12);
    ctx.stroke();

    const LABEL_Y = DATES_BOX_Y + 22;
    const VALUE_Y = DATES_BOX_Y + 50;

    if (createdDate && ev.fecha_vencimiento) {
      // Divider vertical central
      ctx.beginPath();
      ctx.moveTo(W / 2, DATES_BOX_Y + 12);
      ctx.lineTo(W / 2, DATES_BOX_Y + DATES_BOX_H - 12);
      ctx.stroke();
    }

    // Creada
    if (createdDate) {
      const dStr = createdDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      const cX = ev.fecha_vencimiento ? PAD + STATS_W / 4 : W / 2;
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(tr('evaluations.colCreated', 'CREADA'), cX, LABEL_Y);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#334155";
      ctx.fillText(dStr, cX, VALUE_Y);
    }

    // Vence
    if (ev.fecha_vencimiento) {
      const vStr = new Date(ev.fecha_vencimiento).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const vX = createdDate ? W - PAD - STATS_W / 4 : W / 2;
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = expired ? "#ef444480" : "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(tr('evaluations.colExpires', 'VENCE'), vX, LABEL_Y);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = expired ? "#ef4444" : "#334155";
      ctx.fillText(vStr, vX, VALUE_Y);
    }

    ctx.textAlign = "left";
  }

  // Línea divisora antes de tags
  const TAGS_DIVIDER_Y = hasDates ? DATES_BOX_Y + DATES_BOX_H + 10 : STATS_Y + STATS_H + 10;
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, TAGS_DIVIDER_Y);
  ctx.lineTo(W - PAD, TAGS_DIVIDER_Y);
  ctx.stroke();

  // ── Área + categorías ────────────────────────────────
  let tx = PAD;
  const tagBaseY = TAGS_DIVIDER_Y + 17, tagH = 22, tagR = 11;

  if (areaName) {
    ctx.font = "11px system-ui, sans-serif";
    const aW = ctx.measureText(areaName).width + 16;
    ctx.fillStyle = "rgba(109,40,217,0.1)";
    ctx.beginPath();
    ctx.roundRect(tx, tagBaseY - 15, aW, tagH, tagR);
    ctx.fill();
    ctx.fillStyle = "#7c3aed";
    ctx.fillText(areaName, tx + 8, tagBaseY);
    tx += aW + 8;
  }

  ev.categorias.slice(0, 5).forEach((cat) => {
    ctx.font = "11px system-ui, sans-serif";
    const cW = ctx.measureText(cat).width + 16;
    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.roundRect(tx, tagBaseY - 15, cW, tagH, tagR);
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.fillText(cat, tx + 8, tagBaseY);
    tx += cW + 8;
  });

  // ── Footer (y: H-62–H) ────────────────────────────────
  const fY = H - 62;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, fY, W, H - fY);
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
  ctx.fillText("evalpro.apps.dataico.world", PAD + 12, fY + 35);

  ctx.textAlign = "right";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(tr('evaluations.sharedFrom', 'Compartido desde EvalPro'), W - PAD, fY + 35);
  ctx.textAlign = "left";
}

const DEFAULT_CONFIG: Config = {
  num_preguntas: 20,
  dificultad: "mixto",
  dist_unica: 50,
  dist_multiple: 30,
  dist_vf: 20,
  aleatorio: true,
  porcentaje_aprobacion: 60,
  mostrar_opciones: true,
  mostrar_respuesta_seleccionada: true,
  mostrar_respuesta_correcta: true,
  mostrar_justificacion: true,
};

type AssignModalProps = {
  evaluation: Evaluation;
  areas: Area[];
  onClose: () => void;
};

function AssignParticipantsModal({ evaluation, areas, onClose }: AssignModalProps) {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loadingModal, setLoadingModal] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingAll, setTogglingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      const [allP, ids] = await Promise.all([
        getAllParticipants(),
        evaluationParticipantsService.getByEvaluationId(evaluation.id),
      ]);
      setParticipants(allP);
      setAssignedIds(new Set(ids));
      setLoadingModal(false);
    }
    load();
  }, [evaluation.id]);

  const toggle = async (userId: string) => {
    setTogglingId(userId);
    try {
      if (assignedIds.has(userId)) {
        await evaluationParticipantsService.unassign(evaluation.id, userId);
        setAssignedIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
      } else {
        await evaluationParticipantsService.assign(evaluation.id, userId);
        setAssignedIds((prev) => new Set([...prev, userId]));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = participants.filter((p) =>
    `${p.full_name ?? ""} ${p.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredAssigned = filtered.length > 0 && filtered.every((p) => assignedIds.has(p.id));

  const toggleAll = async () => {
    setTogglingAll(true);
    try {
      if (allFilteredAssigned) {
        await Promise.all(
          filtered
            .filter((p) => assignedIds.has(p.id))
            .map((p) => evaluationParticipantsService.unassign(evaluation.id, p.id))
        );
        setAssignedIds((prev) => {
          const s = new Set(prev);
          filtered.forEach((p) => s.delete(p.id));
          return s;
        });
      } else {
        await Promise.all(
          filtered
            .filter((p) => !assignedIds.has(p.id))
            .map((p) => evaluationParticipantsService.assign(evaluation.id, p.id))
        );
        setAssignedIds((prev) => new Set([...prev, ...filtered.map((p) => p.id)]));
      }
    } finally {
      setTogglingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col shadow-2xl transition-all duration-300"
        style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 transition-all duration-300"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold transition-colors duration-300" style={{ color: "var(--foreground)" }}>{t('evaluations.assignParticipants')}</h3>
            <p className="mt-0.5 truncate text-[12px] transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>{evaluation.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg p-2 transition-all duration-300 hover:bg-secondary hover:scale-110"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-border px-6 py-3 transition-all duration-300">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors duration-300" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('evaluations.searchParticipant')}
              className="w-full py-2 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
              {assignedIds.size} {assignedIds.size !== 1 ? t('common.participants') : t('common.participant')} {assignedIds.size !== 1 ? t('evaluations.assignedPlural') : t('evaluations.assigned')}
            </p>
            {filtered.length > 0 && (
              <button
                onClick={toggleAll}
                disabled={togglingAll || togglingId !== null}
                className="text-xs font-medium transition-all duration-300 hover:underline disabled:opacity-50"
                style={{ color: "var(--accent)" }}
              >
                {togglingAll ? t('common.processing') : allFilteredAssigned ? t('common.deselect_all') : t('common.select_all')}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingModal ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 transition-all duration-300" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm transition-colors duration-300 animate-fade-in" style={{ color: "var(--muted-foreground)" }}>
              {searchQuery ? t('evaluations.noParticipantsMatch') : t('evaluations.noParticipants')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p, idx) => {
                const isAssigned = assignedIds.has(p.id);
                const isToggling = togglingId === p.id;
                const areaName = p.area_id ? areas.find((a) => a.id === p.area_id)?.name : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => !isToggling && !togglingAll && toggle(p.id)}
                    disabled={isToggling || togglingAll}
                    className={`flex w-full items-center gap-3 px-6 py-3 text-left transition-all duration-300 disabled:opacity-50 ${
                      isAssigned ? "hover:bg-accent/10" : "hover:bg-secondary"
                    }`}
                    style={{
                      animation: `slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 25}ms both`,
                      background: isAssigned ? "var(--coral-soft)" : "transparent"
                    }}
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-300 ${
                        isAssigned ? "border-accent bg-accent" : "border-border"
                      }`}
                    >
                      {isAssigned && (
                        <CheckCircle className="size-3 transition-all duration-300" style={{ color: "var(--background)" }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium transition-colors duration-300" style={{ color: isAssigned ? "var(--coral-text)" : "var(--foreground)" }}>{toTitleCase(p.full_name) || p.email}</div>
                      <div className="flex items-center gap-2 truncate text-xs transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                        <span>{p.email}</span>
                        {areaName && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-all duration-300" style={{ background: "rgba(109,40,217,.12)", color: "#A78BFA" }}>
                            {areaName}
                          </span>
                        )}
                      </div>
                    </div>
                    {isToggling && (
                      <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 transition-all duration-300" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ShareModalProps = {
  ev: Evaluation;
  areaName: string | null;
  onClose: () => void;
};

function ShareModal({ ev, areaName, onClose }: ShareModalProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const { settings } = useSystemSettings();

  useEffect(() => {
    setReady(false);
    if (!canvasRef.current) return;
    drawShareCard(canvasRef.current, ev, areaName, settings.brand_logo, t).then(() => setReady(true));
  }, [ev, areaName, settings.brand_logo]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    const safe = ev.nombre.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    a.download = `evaluacion-${safe}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div
        className="w-full max-w-3xl shadow-2xl"
        style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="size-4" style={{ color: "var(--accent)" }} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>{t('evaluations.shareEvaluation')}</span>
            </div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{ev.nombre}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary transition-colors" style={{ color: "var(--muted-foreground)" }}>
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="overflow-hidden rounded-xl border border-border/50 bg-[#f1f5f9] relative">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary/60">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            )}
            <canvas ref={canvasRef} className="w-full" style={{ display: "block" }} />
          </div>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {t('evaluations.previewSize')}
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleDownload} disabled={!ready}>
            <Download className="size-4" /> {t('evaluations.downloadPNG')}
          </Button>
        </div>
      </div>
    </div>
  );
}

type EvaluationCardProps = {
  ev: Evaluation;
  areas: Area[];
  duplicatingId: string | null;
  participantCount: number;
  onPreview: (ev: Evaluation) => void;
  onAssign: (ev: Evaluation) => void;
  onDuplicate: (ev: Evaluation) => void;
  onEdit: (ev: Evaluation) => void;
  onDelete: (id: string) => void;
  onShare: (ev: Evaluation) => void;
};

const EvaluationCard = memo(function EvaluationCard({
  ev,
  areas,
  duplicatingId,
  participantCount,
  onPreview,
  onAssign,
  onDuplicate,
  onEdit,
  onDelete,
  onShare,
}: EvaluationCardProps) {
  const { t } = useTranslation();
  const expired = isExpired(ev);
  const areaName = ev.area_id ? areas.find((a) => a.id === ev.area_id)?.name : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const stateColor = expired ? "#ef4444" : ev.activa ? "var(--accent)" : "var(--border)";

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const createdDate = ev.created_at ? new Date(ev.created_at) : null;
  const weekNum = createdDate ? getISOWeek(createdDate) : null;

  return (
    <div
      className="transition-all duration-300 hover:shadow-md"
      style={{
        borderRadius: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${stateColor}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Main body */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="mb-2 flex items-center gap-2.5 flex-wrap">
            <span
              className="font-mono text-[9px] font-bold uppercase tracking-[.1em]"
              style={{ background: "var(--coral-soft)", color: "var(--coral-text)", borderRadius: 6, padding: "3px 8px" }}
            >
              {ev.id.slice(0, 8).toUpperCase()}
            </span>
            <h3 className="font-display text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{ev.nombre}</h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider"
              style={
                expired
                  ? { background: "rgba(220,38,38,.12)", color: "#EF4444" }
                  : ev.activa
                  ? { background: "var(--coral-soft)", color: "var(--coral-text)" }
                  : { background: "var(--surface-2)", color: "var(--muted-foreground)" }
              }
            >
              {expired ? t('evaluations.expired') : ev.activa ? "ACTIVA" : t('evaluations.inactive').toUpperCase()}
            </span>
          </div>

          {ev.descripcion && (
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{ev.descripcion}</p>
          )}

          {/* Pills */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
              <ClipboardList className="size-3" />{ev.config.num_preguntas} {t('common.questions')}
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(5,150,105,.12)", color: "#10B981" }}>
              <CheckCircle className="size-3" />{t('evaluations.approves')} {ev.config.porcentaje_aprobacion}%
            </span>
            {ev.tiempo_limite > 0 && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(217,119,6,.12)", color: "#FBBF24" }}>
                <Clock className="size-3" />{ev.tiempo_limite} {t('common.min')}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
              {ev.intentos_permitidos} {ev.intentos_permitidos !== 1 ? t('common.attemptsPlural') : t('common.attempt')}
            </span>
            {areaName && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(109,40,217,.12)", color: "#A78BFA" }}>
                <Layers className="size-3" />{areaName}
              </span>
            )}
            {ev.categorias.slice(0, 3).map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                <Tag className="size-3" />{c}
              </span>
            ))}
            {ev.categorias.length > 3 && (
              <span className="text-[11px] font-medium px-2.5 py-1" style={{ color: "var(--muted-foreground)" }}>+{ev.categorias.length - 3}</span>
            )}
          </div>

          {/* Dates + week */}
          <div className="mt-3 flex flex-wrap gap-4 text-[11px]">
            {createdDate && (
              <span className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                <Calendar className="size-3" />
                {t('evaluations.created')} {formatDateTime(ev.created_at!)}
                {weekNum && (
                  <span className="ml-1 rounded px-1.5 py-0.5 font-bold" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
                    {t('evaluations.weekLabel')} {weekNum}
                  </span>
                )}
              </span>
            )}
            {ev.fecha_vencimiento && (
              <span className="flex items-center gap-1.5 font-medium" style={{ color: expired ? "#EF4444" : "#FBBF24" }}>
                <CalendarX className="size-3" />{t('evaluations.expires')} {formatDateTime(ev.fecha_vencimiento)}
              </span>
            )}
          </div>
        </div>

        {/* Top-right: participant count only */}
        {participantCount > 0 && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-xl font-bold" style={{ color: "var(--accent)" }}>{participantCount}</div>
            <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('evaluations.completed')}</div>
          </div>
        )}
      </div>

      {/* Footer action bar */}
      <div
        className="flex items-center gap-1 px-4 py-2.5"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        {/* Primary actions */}
        <a
          href={`/evaluation-results/${ev.id}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
          title="Ver resultados"
        >
          <BarChart3 className="size-3.5" /> {t('evaluations.results')}
        </a>
        <button
          onClick={() => onAssign(ev)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
          title="Asignar participantes"
        >
          <Users className="size-3.5" /> {t('evaluations.assign')}
        </button>
        <button
          onClick={() => onShare(ev)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
          title="Compartir"
        >
          <Share2 className="size-3.5" /> {t('evaluations.share')}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Secondary: ··· dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-1.5 transition-all hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}
            title={t('evaluations.moreOptions')}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 bottom-8 z-30 w-44 shadow-xl overflow-hidden"
              style={{ borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => { onPreview(ev); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-secondary transition-colors"
                style={{ color: "var(--foreground)" }}
              >
                <Eye className="size-4" style={{ color: "var(--muted-foreground)" }} /> {t('evaluations.previewOption')}
              </button>
              <button
                onClick={() => { onDuplicate(ev); setMenuOpen(false); }}
                disabled={duplicatingId === ev.id}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-secondary transition-colors disabled:opacity-50"
                style={{ color: "var(--foreground)" }}
              >
                {duplicatingId === ev.id ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" style={{ color: "var(--muted-foreground)" }} />}
                {t('evaluations.duplicate')}
              </button>
              <button
                onClick={() => { onEdit(ev); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-secondary transition-colors"
                style={{ color: "var(--foreground)" }}
              >
                <Edit2 className="size-4" style={{ color: "var(--muted-foreground)" }} /> {t('common.edit')}
              </button>
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                onClick={() => { onDelete(ev.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-destructive/10 transition-colors"
                style={{ color: "var(--destructive)" }}
              >
                <Trash2 className="size-4" /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

type GroupedCardsProps = {
  items: Evaluation[];
  areas: Area[];
  groupBy: "none" | "area" | "semana";
  duplicatingId: string | null;
  resultCounts: Record<string, number>;
  onPreview: (ev: Evaluation) => void;
  onAssign: (ev: Evaluation) => void;
  onDuplicate: (ev: Evaluation) => void;
  onEdit: (ev: Evaluation) => void;
  onDelete: (id: string) => void;
  onShare: (ev: Evaluation) => void;
};

function GroupedCards({ items, areas, groupBy, duplicatingId, resultCounts, onPreview, onAssign, onDuplicate, onEdit, onDelete, onShare }: GroupedCardsProps) {
  const { t } = useTranslation();
  const renderCard = (ev: Evaluation, idx: number) => (
    <div key={ev.id} style={{ animation: `slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 40}ms both` }}>
      <EvaluationCard
        ev={ev}
        areas={areas}
        duplicatingId={duplicatingId}
        participantCount={resultCounts[ev.id] ?? 0}
        onPreview={onPreview}
        onAssign={onAssign}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onDelete={onDelete}
        onShare={onShare}
      />
    </div>
  );

  if (groupBy === "none") {
    return <div className="grid gap-4">{items.map(renderCard)}</div>;
  }

  // Build groups
  const groupMap = new Map<string, Evaluation[]>();
  items.forEach((ev) => {
    let key: string;
    if (groupBy === "area") {
      key = ev.area_id ? (areas.find((a) => a.id === ev.area_id)?.name ?? t('evaluations.noArea')) : t('evaluations.noArea');
    } else {
      key = ev.created_at ? `${t('evaluations.weekLabel')} ${getISOWeek(new Date(ev.created_at))}` : t('evaluations.noGroup');
    }
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(ev);
  });

  return (
    <div className="space-y-6">
      {Array.from(groupMap.entries()).map(([groupLabel, groupItems]) => (
        <div key={groupLabel}>
          <div className="mb-3 flex items-center gap-3">
            <div
              className="rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
            >
              {groupLabel}
            </div>
            <div className="flex-1 border-t border-border" />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {groupItems.length} evaluación{groupItems.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="grid gap-4">
            {groupItems.map(renderCard)}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvaluationsPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const [shareEval, setShareEval] = useState<Evaluation | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "area" | "semana">("none");

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('evaluations')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  const [items, setItems] = useState<Evaluation[]>([]);

  // Carga inicial en paralelo — evaluaciones, categorías y áreas en un solo round-trip
  useEffect(() => {
    if (!isAdmin) return;

    async function loadAll() {
      try {
        setLoading(true);
        const [evalData, uniqueCategories, areasData, allResults, etiquetasData] = await Promise.all([
          evaluationsService.getAll(),
          getUniqueCategories(),
          areasService.getAll(),
          resultsService.getAll().catch(() => []),
          etiquetasService.getAll().catch(() => []),
        ]);

        // Compute participant counts per evaluation
        const counts: Record<string, number> = {};
        (allResults as any[]).forEach((r) => {
          if (r.evaluation_id) counts[r.evaluation_id] = (counts[r.evaluation_id] || 0) + 1;
        });
        setResultCounts(counts);

        const mappedItems: Evaluation[] = evalData.map((evaluation: any) => {
          const rawCats = evaluation.categorias;
          let categorias: string[] = [];
          if (Array.isArray(rawCats)) {
            categorias = rawCats;
          } else if (typeof rawCats === 'string' && rawCats) {
            try { categorias = JSON.parse(rawCats); } catch { categorias = []; }
          }
          return {
          id: evaluation.id,
          nombre: evaluation.title,
          descripcion: evaluation.description || '',
          tiempo_limite: evaluation.tiempo_limite || 0,
          intentos_permitidos: evaluation.intentos_permitidos || 1,
          activa: evaluation.activa !== undefined ? evaluation.activa : true,
          categorias,
          config: evaluation.config || DEFAULT_CONFIG,
          created_at: evaluation.created_at,
          fecha_vencimiento: evaluation.fecha_vencimiento ?? undefined,
          area_id: evaluation.area_id ?? null,
          feedback_trigger: evaluation.feedback_trigger ?? 'ninguno',
          feedback_documento_texto: evaluation.feedback_documento_texto ?? '',
          feedback_documento_nombre: evaluation.feedback_documento_nombre ?? '',
          etiqueta_id: evaluation.etiqueta_id ?? null,
          detalle_respuestas_trigger: evaluation.detalle_respuestas_trigger ?? 'ninguno',
          };
        });

        // Auto-desactivar evaluaciones vencidas
        const expiredItems = mappedItems.filter(
          (ev) => ev.activa && ev.fecha_vencimiento && new Date(ev.fecha_vencimiento) < new Date()
        );
        await Promise.all(
          expiredItems.map(async (ev) => {
            try {
              await evaluationsService.update(ev.id, { activa: false });
              ev.activa = false;
            } catch (err) {
              console.error('Error auto-deactivating expired evaluation:', ev.id, err);
            }
          })
        );

        setItems(mappedItems);
        setCategories(uniqueCategories);
        setAreas(areasData);
        setEtiquetas(etiquetasData);
      } catch (err) {
        console.error('Error loading evaluations page data:', err);
        setError('Error al cargar las evaluaciones');
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [isAdmin]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activa" | "inactiva">("todos");
  const [filterArea, setFilterArea] = useState<string>("todas");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [assigningEval, setAssigningEval] = useState<Evaluation | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [previewEval, setPreviewEval] = useState<Evaluation | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const emptyForm: Evaluation = {
    id: "",
    nombre: "",
    descripcion: "",
    tiempo_limite: 0,
    intentos_permitidos: 1,
    activa: true,
    categorias: [],
    config: DEFAULT_CONFIG,
    fecha_vencimiento: "",
    area_id: null,
    feedback_trigger: "ninguno",
    feedback_documento_texto: "",
    feedback_documento_nombre: "",
    etiqueta_id: null,
    detalle_respuestas_trigger: "ninguno",
  };
  const [form, setForm] = useState<Evaluation>(emptyForm);
  const [extractingFeedbackDoc, setExtractingFeedbackDoc] = useState(false);
  const [docIdioma, setDocIdioma] = useState(() => defaultIdioma(i18n.language));
  const [catFilter, setCatFilter] = useState("");
  const [etiquetaFilter, setEtiquetaFilter] = useState("");
  const [newEtiquetaInput, setNewEtiquetaInput] = useState("");
  const [creatingEtiqueta, setCreatingEtiqueta] = useState(false);

  const handleFeedbackDocument = async (file: File | null) => {
    if (!file) return;
    setExtractingFeedbackDoc(true);
    try {
      const text = await extractTextWithOCR(file);
      setForm((f) => ({ ...f, feedback_documento_texto: text, feedback_documento_nombre: file.name }));
    } catch (err) {
      console.error('Error extracting feedback document:', err);
      showToast(t('evaluations.feedbackExtractError'), 'error');
    } finally {
      setExtractingFeedbackDoc(false);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((e) => {
        const matchQuery = (e.nombre + " " + e.descripcion)
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase());
        const matchCat =
          filterCategoria === "todas" || e.categorias.includes(filterCategoria);
        const matchEstado =
          filterEstado === "todos" ||
          (filterEstado === "activa" ? e.activa : !e.activa);
        const matchArea =
          filterArea === "todas" ||
          (filterArea === "sin_area" ? !e.area_id : e.area_id === filterArea);
        return matchQuery && matchCat && matchEstado && matchArea;
      }),
    [items, debouncedQuery, filterCategoria, filterEstado, filterArea],
  );

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedQuery, filterCategoria, filterEstado, filterArea]);

  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalDist = form.config.dist_unica + form.config.dist_multiple + form.config.dist_vf;
  
  // Calcular peso por pregunta (100% / cantidad de preguntas)
  const pesoPorPregunta = form.config.num_preguntas > 0 
    ? (100 / form.config.num_preguntas).toFixed(2)
    : "0.00";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (ev: Evaluation) => {
    setEditing(ev);
    setForm({
      ...ev,
      config: { ...DEFAULT_CONFIG, ...ev.config },
      categorias: [...ev.categorias],
      fecha_vencimiento: ev.fecha_vencimiento ? toLocalDateTimeInput(ev.fecha_vencimiento) : "",
      area_id: ev.area_id ?? null,
      etiqueta_id: ev.etiqueta_id ?? null,
    });
    setEtiquetaFilter("");
    setNewEtiquetaInput("");
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDist !== 100) {
      showToast(t('evaluations.distributionError'), "error");
      return;
    }
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      const fechaVencimientoISO = form.fecha_vencimiento
        ? new Date(form.fecha_vencimiento).toISOString()
        : null;

      if (editing) {
        // Actualizar en Supabase
        const updated = await evaluationsService.update(editing.id, {
          title: form.nombre,
          description: form.descripcion,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          fecha_vencimiento: fechaVencimientoISO,
          area_id: form.area_id ?? null,
          feedback_trigger: form.feedback_trigger,
          feedback_documento_texto: form.feedback_documento_texto || null,
          feedback_documento_nombre: form.feedback_documento_nombre || null,
          feedback_documento_idioma: docIdioma,
          etiqueta_id: form.etiqueta_id ?? null,
          detalle_respuestas_trigger: form.detalle_respuestas_trigger,
        });

        setItems((p) => p.map((x) => (x.id === editing.id ? { ...form, id: editing.id, fecha_vencimiento: form.fecha_vencimiento || undefined } : x)));
        showToast(t('evaluations.updated'));
        if ((updated as any).foro_articulo_error) {
          showToast(t('evaluations.foroArticleGenerationError'), 'error');
        }
      } else {
        // Crear en Supabase
        const newEvaluation = await evaluationsService.create({
          title: form.nombre,
          description: form.descripcion,
          created_by: profile?.id || null,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          fecha_vencimiento: fechaVencimientoISO,
          area_id: form.area_id ?? null,
          feedback_trigger: form.feedback_trigger,
          feedback_documento_texto: form.feedback_documento_texto || null,
          feedback_documento_nombre: form.feedback_documento_nombre || null,
          feedback_documento_idioma: docIdioma,
          etiqueta_id: form.etiqueta_id ?? null,
          detalle_respuestas_trigger: form.detalle_respuestas_trigger,
        });
        if ((newEvaluation as any).foro_articulo_error) {
          showToast(t('evaluations.foroArticleGenerationError'), 'error');
        }

        const mappedItem: Evaluation = {
          id: newEvaluation.id,
          nombre: newEvaluation.title,
          descripcion: newEvaluation.description || '',
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          created_at: newEvaluation.created_at,
          fecha_vencimiento: form.fecha_vencimiento || undefined,
          area_id: form.area_id ?? null,
          feedback_trigger: form.feedback_trigger,
          feedback_documento_texto: form.feedback_documento_texto,
          feedback_documento_nombre: form.feedback_documento_nombre,
          etiqueta_id: form.etiqueta_id ?? null,
          detalle_respuestas_trigger: form.detalle_respuestas_trigger,
        };

        setItems((p) => [mappedItem, ...p]);
        showToast(t('evaluations.created_toast'));
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      showToast(t('evaluations.saveError'), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await evaluationsService.delete(deletingId);
      setItems((p) => p.filter((e) => e.id !== deletingId));
      showToast(t('evaluations.deleted'));
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      const message = err instanceof Error && err.message ? err.message : t('evaluations.deleteError');
      showToast(message, "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingId(null);
    }
  };

  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Agrupa las preguntas de un mismo caso práctico (mismo caso_id) en un bloque
  // indivisible, ordenado por caso_orden — mismo criterio que usa la pantalla real
  // del participante (take.$code.tsx), para que esta vista previa no corte un caso
  // a la mitad al limitar por num_preguntas.
  function groupIntoCaseBlocks<T extends { caso_id?: string; caso_orden?: number }>(qs: T[]): T[][] {
    const seen = new Set<string>();
    const blocks: T[][] = [];
    for (const q of qs) {
      if (!q.caso_id) {
        blocks.push([q]);
        continue;
      }
      if (seen.has(q.caso_id)) continue;
      seen.add(q.caso_id);
      const siblings = qs.filter((x) => x.caso_id === q.caso_id).sort((a, b) => (a.caso_orden ?? 0) - (b.caso_orden ?? 0));
      blocks.push(siblings);
    }
    return blocks;
  }

  const openPreview = async (ev: Evaluation) => {
    setPreviewEval(ev);
    setLoadingPreview(true);
    setPreviewQuestions([]);
    try {
      // Use filtered query at DB level — avoids downloading the full question bank
      const questions = await questionsService.getFiltered({
        categorias: ev.categorias?.length > 0 ? ev.categorias : undefined,
        dificultad: ev.config?.dificultad,
      });
      const blocks = groupIntoCaseBlocks(questions);
      const orderedBlocks = ev.config?.aleatorio ? shuffleArray(blocks) : blocks;
      const maxCount = ev.config?.num_preguntas ?? 10;
      const picked: typeof questions = [];
      for (const block of orderedBlocks) {
        if (picked.length > 0 && picked.length + block.length > maxCount) break;
        picked.push(...block);
      }
      setPreviewQuestions(picked);
    } catch (err) {
      console.error("Error loading preview questions:", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDuplicate = async (ev: Evaluation) => {
    setDuplicatingId(ev.id);
    try {
      const newEvaluation = await evaluationsService.create({
        title: `${t('evaluations.copyOf')} ${ev.nombre}`,
        description: ev.descripcion,
        created_by: profile?.id || null,
        tiempo_limite: ev.tiempo_limite,
        intentos_permitidos: ev.intentos_permitidos,
        activa: false,
        categorias: [...ev.categorias],
        config: { ...ev.config },
        fecha_vencimiento: null,
        area_id: ev.area_id ?? null,
        feedback_trigger: ev.feedback_trigger,
        feedback_documento_texto: ev.feedback_documento_texto || null,
        feedback_documento_nombre: ev.feedback_documento_nombre || null,
        etiqueta_id: ev.etiqueta_id ?? null,
        detalle_respuestas_trigger: ev.detalle_respuestas_trigger,
      });

      const mappedItem: Evaluation = {
        id: newEvaluation.id,
        nombre: `${t('evaluations.copyOf')} ${ev.nombre}`,
        descripcion: ev.descripcion,
        tiempo_limite: ev.tiempo_limite,
        intentos_permitidos: ev.intentos_permitidos,
        activa: false,
        categorias: [...ev.categorias],
        config: { ...ev.config },
        created_at: newEvaluation.created_at,
        area_id: ev.area_id ?? null,
        feedback_trigger: ev.feedback_trigger,
        feedback_documento_texto: ev.feedback_documento_texto,
        feedback_documento_nombre: ev.feedback_documento_nombre,
        etiqueta_id: ev.etiqueta_id ?? null,
        detalle_respuestas_trigger: ev.detalle_respuestas_trigger,
      };

      setItems((prev) => [mappedItem, ...prev]);
      showToast(`"${mappedItem.nombre}" creada`);
    } catch (err) {
      console.error("Error duplicating evaluation:", err);
      showToast(t('evaluations.duplicateError'), "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleCreateEtiqueta = async () => {
    const nombre = newEtiquetaInput.trim();
    if (!nombre) return;
    setCreatingEtiqueta(true);
    try {
      const created = await etiquetasService.create(nombre);
      setEtiquetas((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm((f) => ({ ...f, etiqueta_id: created.id }));
      setNewEtiquetaInput("");
    } catch (err: any) {
      showToast(err?.message || t('evaluations.etiquetaCreateError'), "error");
    } finally {
      setCreatingEtiqueta(false);
    }
  };

  const toggleCat = (cat: string) => {
    setForm((f) => ({
      ...f,
      categorias: f.categorias.includes(cat)
        ? f.categorias.filter((c) => c !== cat)
        : [...f.categorias, cat],
    }));
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Evaluaciones" />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">{t('evaluations.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader title="Evaluaciones" />
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
    <AppShell>
      <PageHeader
        title="Evaluaciones"
        actions={<Button onClick={openCreate}><Plus className="size-4" /> {t('evaluations.newEvaluation')}</Button>}
      />
      {toast && (
        <div
          className="fixed right-6 top-20 z-50 flex items-center gap-2 px-4 py-3 text-[13px] font-medium shadow-lg"
          style={{
            borderRadius: 12,
            ...(toast.type === "error"
              ? { background: "var(--destructive)", color: "var(--destructive-foreground)" }
              : { background: "#059669", color: "#fff" }),
          }}
        >
          <CheckCircle className="size-4" />
          {toast.msg}
        </div>
      )}

      <div className="space-y-6">
        {/* 🔍 Filter Bar - Enhanced Design */}
        <div className="flex flex-wrap items-center gap-3 animate-fade-in">
          <div className="relative min-w-[220px] flex-1 max-w-sm transition-all duration-300">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('evaluations.searchPlaceholder')}
              className="w-full py-2 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
            />
          </div>

          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
            style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          >
            <option value="todas">{t('evaluations.allCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
            className="px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
            style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          >
            <option value="todos">{t('evaluations.allStatuses')}</option>
            <option value="activa">{t('evaluations.active')}</option>
            <option value="inactiva">{t('evaluations.inactive')}</option>
          </select>

          {areas.length > 0 && (
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
            >
              <option value="todas">{t('evaluations.allAreas')}</option>
              <option value="sin_area">{t('evaluations.noArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Grouping toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
            {(["none", "area", "semana"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className="px-3 py-2 text-[11px] font-medium transition-all"
                style={{
                  background: groupBy === g ? "var(--accent)" : "transparent",
                  color: groupBy === g ? "var(--accent-foreground)" : "var(--muted-foreground)",
                }}
              >
                {g === "none" ? t('evaluations.noGroup') : g === "area" ? t('evaluations.byArea') : t('evaluations.byWeek')}
              </button>
            ))}
          </div>

          <div
            className="font-mono text-[10px] uppercase tracking-[.12em] px-3 py-2 rounded-lg"
            style={{ color: "var(--text-faint)", background: "var(--secondary)/40", border: "1px solid var(--border)" }}
          >
            {filtered.length} de {items.length}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div
            className="p-12 text-center animate-fade-in transition-all duration-300"
            style={{ borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <ClipboardList className="mx-auto mb-3 size-10" style={{ color: "var(--text-faint)" }} />
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              {filtered.length === items.length ? t('evaluations.emptyState') : t('evaluations.noMatch')}
            </p>
          </div>
        ) : (
          <>
            <GroupedCards
              items={pagedItems}
              areas={areas}
              groupBy={groupBy}
              duplicatingId={duplicatingId}
              resultCounts={resultCounts}
              onPreview={openPreview}
              onAssign={setAssigningEval}
              onDuplicate={handleDuplicate}
              onEdit={openEdit}
              onDelete={handleDelete}
              onShare={setShareEval}
            />
            <Paginator page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('evaluations.deleteTitle')}
        description={t('evaluations.deleteConfirm', { name: items.find((e) => e.id === deletingId)?.nombre ?? "" })}
        confirmLabel={t('common.delete')}
        loadingLabel={t('evaluations.deleting')}
        variant="destructive"
        loading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeletingId(null); }}
      />

      {assigningEval && (
        <AssignParticipantsModal
          evaluation={assigningEval}
          areas={areas}
          onClose={() => setAssigningEval(null)}
        />
      )}

      {shareEval && (
        <ShareModal
          ev={shareEval}
          areaName={shareEval.area_id ? areas.find((a) => a.id === shareEval.area_id)?.name ?? null : null}
          onClose={() => setShareEval(null)}
        />
      )}

      {/* ── PREVIEW MODAL ── */}
      {previewEval && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 animate-fade-in">
          <div
            className="my-8 w-full max-w-2xl shadow-2xl transition-all duration-300"
            style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 transition-all duration-300"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", borderRadius: "16px 16px 0 0" }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="size-4 transition-all duration-300" style={{ color: "var(--accent)" }} />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] transition-all duration-300" style={{ color: "var(--accent)" }}>{t('evaluations.preview')}</span>
                </div>
                <h3 className="font-display text-[15px] font-semibold transition-colors duration-300" style={{ color: "var(--foreground)" }}>{previewEval.nombre}</h3>
              </div>
              <button
                onClick={() => setPreviewEval(null)}
                className="rounded-lg p-2 transition-all duration-300 hover:bg-secondary hover:scale-110"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Info strip */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-6 py-3 transition-all duration-300">
              <span className="flex items-center gap-1.5 text-xs transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                <ClipboardList className="size-3.5" />
                {previewEval.config.num_preguntas} {t('common.questions')}
              </span>
              {previewEval.tiempo_limite > 0 && (
                <span className="flex items-center gap-1.5 text-xs transition-colors duration-300" style={{ color: "#FBBF24" }}>
                  <Clock className="size-3.5" />
                  {previewEval.tiempo_limite} {t('common.min')}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs transition-colors duration-300" style={{ color: "#10B981" }}>
                <CheckCircle className="size-3.5" />
                {t('evaluations.approves')} {previewEval.config.porcentaje_aprobacion}%
              </span>
              <span className="ml-auto rounded px-2 py-0.5 text-[10px] font-bold transition-all duration-300" style={{ background: "rgba(217,119,6,.12)", color: "#FBBF24" }}>
                {t('evaluations.previewBanner')}
              </span>
            </div>

            {/* Questions */}
            <div className="p-6">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 transition-all duration-300" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                </div>
              ) : previewQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm transition-all duration-300 animate-fade-in" style={{ color: "var(--muted-foreground)" }}>
                  {t('evaluations.noQuestionsMatch')}
                </div>
              ) : (
                <div className="space-y-6">
                  {previewQuestions.map((q, idx) => {
                    const caseSiblings = q.caso_id
                      ? previewQuestions
                          .filter((x) => x.caso_id === q.caso_id)
                          .sort((a, b) => (a.caso_orden ?? 0) - (b.caso_orden ?? 0))
                      : [];
                    const caseTotal = caseSiblings.length;
                    const caseIndex = caseSiblings.findIndex((x) => x.id === q.id) + 1;
                    return (
                    <div key={q.id} style={{ animation: `slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms both` }}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full transition-all duration-300 font-mono text-xs font-bold" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-3">
                          {q.es_caso_practico && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
                              📋 {t('evaluations.casePreviewBadge')}{q.tipo_caso ? ` · ${q.tipo_caso}` : ''} · {caseIndex}/{caseTotal}
                            </span>
                          )}
                          {q.contexto && (
                            <p className="rounded border-l-2 px-3 py-1.5 text-xs transition-all duration-300" style={{ borderColor: "var(--accent)", background: "var(--coral-soft)", color: "var(--muted-foreground)" }}>
                              {q.contexto}
                            </p>
                          )}
                          <p className="text-sm font-medium leading-relaxed transition-colors duration-300" style={{ color: "var(--foreground)" }}>{q.question_text}</p>
                          <ul className="space-y-2">
                            {q.options.map((opt: string, i: number) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all duration-300 hover:border-accent/50 hover:bg-secondary/40"
                                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}
                              >
                                <span className="grid size-5 shrink-0 place-items-center rounded-sm border font-mono text-[10px] font-bold transition-all duration-300" style={{ borderColor: "var(--border)" }}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                {opt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {idx < previewQuestions.length - 1 && (
                        <div className="mt-6 border-b border-border transition-all duration-300" />
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4 transition-all duration-300">
              <Button variant="outline" className="w-full transition-all duration-300 hover:scale-105" onClick={() => setPreviewEval(null)}>
                {t('evaluations.closePreview')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl transition-all duration-300"
            style={{ borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between bg-card px-6 py-5 transition-all duration-300"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h3 className="font-display text-[15px] font-semibold transition-colors duration-300" style={{ color: "var(--foreground)" }}>
                {editing ? t('evaluations.formEditTitle') : t('evaluations.formNewTitle')}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 transition-all duration-300 hover:bg-secondary hover:scale-110"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="space-y-3">
                <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('evaluations.nameLabel')}
                  </label>
                  <input
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder={t('evaluations.namePlaceholder')}
                    className="w-full rounded-md border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    {t('common.description')}
                  </label>
                  <textarea
                    rows={2}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full resize-none rounded-md border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                      {t('evaluations.timeLimit')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.tiempo_limite}
                      onChange={(e) =>
                        setForm({ ...form, tiempo_limite: +e.target.value })
                      }
                      className="w-full rounded-md border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
                    <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                      {t('evaluations.attemptsAllowed')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.intentos_permitidos}
                      onChange={(e) =>
                        setForm({ ...form, intentos_permitidos: +e.target.value })
                      }
                      className="w-full rounded-md border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                      style={{ borderColor: "var(--border)", background: "var(--background)" }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, activa: !form.activa })}
                  className={`flex items-center gap-2 text-sm font-medium ${
                    form.activa ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {form.activa ? (
                    <ToggleRight className="size-6" />
                  ) : (
                    <ToggleLeft className="size-6" />
                  )}
                  {form.activa ? t('evaluations.evalActive') : t('evaluations.evalInactive')}
                </button>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('evaluations.expiresAt')}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fecha_vencimiento || ""}
                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('evaluations.expiresHint')}
                  </p>
                </div>
                {areas.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t('evaluations.areaLabel')}
                    </label>
                    <select
                      value={form.area_id || ""}
                      onChange={(e) =>
                        setForm({ ...form, area_id: e.target.value || null })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">{t('evaluations.noAreaOption')}</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <Accordion type="multiple" className="border-t border-border">
              <AccordionItem value="preguntas">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Settings className="size-4 text-accent" />
                    <span className="text-sm font-semibold">{t('evaluations.questionsConfig')}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t('evaluations.numQuestions')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={form.config.num_preguntas}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: { ...form.config, num_preguntas: +e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{t('evaluations.weightPerQuestion')}</span>
                        <span className="font-mono font-bold text-accent">{pesoPorPregunta}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t('evaluations.difficulty')}
                      </label>
                      <select
                        value={form.config.dificultad}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: {
                              ...form.config,
                              dificultad: e.target.value as Config["dificultad"],
                            },
                          })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="mixto">{t('common.mixed')}</option>
                        <option value="facil">{t('common.easy')}</option>
                        <option value="medio">{t('common.medium')}</option>
                        <option value="dificil">{t('common.hard')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t('evaluations.approvalPct')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={form.config.porcentaje_aprobacion}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: { ...form.config, porcentaje_aprobacion: +e.target.value },
                          })
                        }
                        className="flex-1 accent-accent"
                      />
                      <span className="w-12 text-right font-mono text-sm font-bold text-accent">
                        {form.config.porcentaje_aprobacion}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('evaluations.approvalHint')}
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      {t('evaluations.distribution')}{" "}
                      {totalDist !== 100 && (
                        <span className="ml-1 text-destructive">
                          {t('evaluations.distributionHint')} {totalDist}%)
                        </span>
                      )}
                    </label>
                    {(
                      [
                        { key: "dist_unica", label: t('evaluations.singleChoice') },
                        { key: "dist_multiple", label: t('evaluations.multipleChoice') },
                        { key: "dist_vf", label: t('evaluations.trueFalse') },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="mb-1.5 flex items-center gap-2">
                        <span className="w-36 text-xs text-muted-foreground">{label}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={form.config[key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              config: { ...form.config, [key]: +e.target.value },
                            })
                          }
                          className="flex-1 accent-accent"
                        />
                        <span className="w-10 text-right font-mono text-xs font-medium">
                          {form.config[key]}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.config.aleatorio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, aleatorio: e.target.checked },
                        })
                      }
                    />
                    {t('evaluations.randomOrder')}
                  </label>
                </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="feedback">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-accent" />
                    <span className="text-sm font-semibold">{t('evaluations.feedbackTitle')}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t('evaluations.feedbackTriggerLabel')}
                    </label>
                    <select
                      value={form.feedback_trigger}
                      onChange={(e) =>
                        setForm({ ...form, feedback_trigger: e.target.value as FeedbackTrigger })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="ninguno">{t('evaluations.feedbackNone')}</option>
                      <option value="al_finalizar">{t('evaluations.feedbackOnFinish')}</option>
                      <option value="inactiva">{t('evaluations.feedbackOnInactive')}</option>
                    </select>
                  </div>
                  {form.feedback_trigger !== 'ninguno' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t('evaluations.feedbackDocumentLabel')}
                      </label>
                      {form.feedback_documento_nombre ? (
                        <div className="flex items-center justify-between rounded-md bg-accent/10 px-3 py-2 text-xs">
                          <span className="truncate">{form.feedback_documento_nombre}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ ...form, feedback_documento_texto: '', feedback_documento_nombre: '' })
                            }
                            aria-label={t('evaluations.feedbackRemoveDocument')}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-20 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-input text-xs text-muted-foreground transition-colors hover:border-accent/40">
                          {extractingFeedbackDoc ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <span>{t('evaluations.feedbackUploadDocument')}</span>
                          )}
                          <input
                            type="file"
                            hidden
                            accept=".pdf,.docx,.txt"
                            disabled={extractingFeedbackDoc}
                            onChange={(e) => handleFeedbackDocument(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{t('evaluations.feedbackDocumentHint')}</p>
                      {form.feedback_documento_nombre && (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            {t('evaluations.feedbackArticleLanguage')}
                          </label>
                          <select
                            value={docIdioma}
                            onChange={(e) => setDocIdioma(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="Español">{t('generate.spanish')}</option>
                            <option value="Inglés">{t('generate.english')}</option>
                            <option value="Portugués">{t('generate.portuguese')}</option>
                          </select>
                          <p className="mt-1 text-xs text-muted-foreground">{t('evaluations.feedbackArticleHint')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="detalle_resultados">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Eye className="size-4 text-accent" />
                    <span className="text-sm font-semibold">{t('evaluations.resultDetailTitle')}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t('evaluations.resultDetailTriggerLabel')}
                    </label>
                    <select
                      value={form.detalle_respuestas_trigger}
                      onChange={(e) =>
                        setForm({ ...form, detalle_respuestas_trigger: e.target.value as FeedbackTrigger })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="ninguno">{t('evaluations.resultDetailNone')}</option>
                      <option value="al_finalizar">{t('evaluations.resultDetailOnFinish')}</option>
                      <option value="inactiva">{t('evaluations.resultDetailOnInactive')}</option>
                    </select>
                  </div>
                  {form.detalle_respuestas_trigger !== 'ninguno' && (
                    <div className="space-y-2">
                      {(
                        [
                          { key: "mostrar_opciones", label: t('evaluations.showOptions') },
                          { key: "mostrar_respuesta_seleccionada", label: t('evaluations.showSelectedAnswer') },
                          { key: "mostrar_respuesta_correcta", label: t('evaluations.showCorrectAnswer') },
                          { key: "mostrar_justificacion", label: t('evaluations.showJustification') },
                        ] as const
                      ).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={form.config[key]}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                config: { ...form.config, [key]: e.target.checked },
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="categorias">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Tag className="size-4 text-accent" />
                    <span className="text-sm font-semibold">{t('evaluations.categories')}</span>
                    {form.categorias.length > 0 && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {t('evaluations.categoriesSelectedCount', { count: form.categorias.length })}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <p className="mb-2 text-xs text-muted-foreground">{t('evaluations.categoriesHint')}</p>

                {form.categorias.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {form.categorias.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className="flex items-center gap-1 rounded-full border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      >
                        {cat}
                        <X className="size-3" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={catFilter}
                      onChange={(e) => setCatFilter(e.target.value)}
                      placeholder={t('evaluations.categoriesSearchPlaceholder')}
                      className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  {form.categorias.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, categorias: [] })}
                      className="whitespace-nowrap text-xs text-muted-foreground hover:text-destructive"
                    >
                      {t('evaluations.categoriesClearAll')}
                    </button>
                  )}
                </div>

                <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
                  {categories
                    .filter((cat) => cat.toLowerCase().includes(catFilter.trim().toLowerCase()))
                    .sort((a, b) => a.localeCompare(b))
                    .map((cat) => {
                      const active = form.categorias.includes(cat);
                      return (
                        <label
                          key={cat}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/10"
                        >
                          <input type="checkbox" checked={active} onChange={() => toggleCat(cat)} />
                          {cat}
                        </label>
                      );
                    })}
                  {categories.filter((cat) => cat.toLowerCase().includes(catFilter.trim().toLowerCase())).length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      {t('evaluations.categoriesNoResults')}
                    </p>
                  )}
                </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="etiquetas" className="border-b-0">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Bookmark className="size-4 text-accent" />
                    <span className="text-sm font-semibold">{t('evaluations.etiquetas')}</span>
                    {form.etiqueta_id && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {etiquetas.find((e) => e.id === form.etiqueta_id)?.nombre ?? ""}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <p className="mb-3 text-xs text-muted-foreground">{t('evaluations.etiquetasHint')}</p>

                {/* Create new tag */}
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={newEtiquetaInput}
                    onChange={(e) => setNewEtiquetaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateEtiqueta(); } }}
                    placeholder={t('evaluations.etiquetaNewPlaceholder')}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={handleCreateEtiqueta}
                    disabled={creatingEtiqueta || !newEtiquetaInput.trim()}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                  >
                    {creatingEtiqueta ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                    {t('evaluations.etiquetaCreate')}
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={etiquetaFilter}
                    onChange={(e) => setEtiquetaFilter(e.target.value)}
                    placeholder={t('evaluations.etiquetaSearch')}
                    className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Radio list */}
                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
                  {/* None option */}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/10">
                    <input
                      type="radio"
                      name="etiqueta_id"
                      checked={!form.etiqueta_id}
                      onChange={() => setForm((f) => ({ ...f, etiqueta_id: null }))}
                    />
                    <span className="text-muted-foreground italic">{t('evaluations.etiquetaNone')}</span>
                  </label>
                  {etiquetas
                    .filter((e) => e.nombre.toLowerCase().includes(etiquetaFilter.trim().toLowerCase()))
                    .map((etiqueta) => (
                      <label
                        key={etiqueta.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/10"
                      >
                        <input
                          type="radio"
                          name="etiqueta_id"
                          checked={form.etiqueta_id === etiqueta.id}
                          onChange={() => setForm((f) => ({ ...f, etiqueta_id: etiqueta.id }))}
                        />
                        {etiqueta.nombre}
                      </label>
                    ))}
                  {etiquetas.filter((e) => e.nombre.toLowerCase().includes(etiquetaFilter.trim().toLowerCase())).length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      {t('evaluations.etiquetaNoResults')}
                    </p>
                  )}
                </div>
                </AccordionContent>
              </AccordionItem>
              </Accordion>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1" disabled={totalDist !== 100}>
                  <Save className="size-4" />
                  {editing ? t('common.update') : t('common.create')}
                </Button>

                <ConfirmDialog
                  open={showSaveConfirm}
                  title={editing ? t('evaluations.formEditTitle') : t('evaluations.formNewTitle')}
                  description={editing ? t('evaluations.confirmUpdate', { name: form.nombre }) : t('evaluations.confirmCreate', { name: form.nombre })}
                  confirmLabel={editing ? t('common.update') : t('common.create')}
                  loading={isSaving}
                  onConfirm={executeSave}
                  onCancel={() => setShowSaveConfirm(false)}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
