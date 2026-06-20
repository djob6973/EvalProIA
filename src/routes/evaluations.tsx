import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, memo, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { evaluationsService, getUniqueCategories, areasService, Area, evaluationParticipantsService, getAllParticipants, ParticipantProfile, questionsService, resultsService } from "@/lib/services/evaluations";

export const Route = createFileRoute("/evaluations")({
  head: () => ({ meta: [{ title: "Evaluaciones — EvalPro" }] }),
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

function drawShareCard(canvas: HTMLCanvasElement, ev: Evaluation, areaName: string | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 800, H = 420;
  canvas.width = W;
  canvas.height = H;

  const expired = isExpired(ev);
  const stateColor = expired ? "#ef4444" : ev.activa ? "#e9664a" : "#94a3b8";

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1a1040");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Left accent stripe
  ctx.fillStyle = stateColor;
  ctx.fillRect(0, 0, 5, H);

  // Top header bg
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, W, 58);

  // Brand
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillStyle = stateColor;
  ctx.fillText("EVALPRO", 24, 34);

  // Status badge
  const statusLabel = expired ? "VENCIDA" : ev.activa ? "ACTIVA" : "INACTIVA";
  const badgeText = statusLabel;
  ctx.font = "bold 10px system-ui, sans-serif";
  const badgeW = ctx.measureText(badgeText).width + 20;
  ctx.fillStyle = stateColor + "33";
  ctx.beginPath();
  ctx.roundRect(W - badgeW - 20, 18, badgeW, 22, 6);
  ctx.fill();
  ctx.fillStyle = stateColor;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, W - badgeW / 2 - 20, 33);
  ctx.textAlign = "left";

  // Area tag
  if (areaName) {
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(167,139,250,0.9)";
    const areaX = 24 + ctx.measureText("EVALPRO").width + 14;
    ctx.fillText(`· ${areaName}`, areaX, 34);
  }

  // Title
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  const titleLines = wrapCanvasText(ctx, ev.nombre, W - 60, 1);
  ctx.fillText(titleLines[0] || "", 24, 98);

  // Description
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  const descLines = wrapCanvasText(ctx, ev.descripcion || "", W - 60, 2);
  descLines.forEach((line, i) => ctx.fillText(line, 24, 124 + i * 22));

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 175);
  ctx.lineTo(W - 24, 175);
  ctx.stroke();

  // Info row 1: aprobación · preguntas · tiempo
  const infos1: string[] = [
    `✓  Aprueba ${ev.config.porcentaje_aprobacion}%`,
    `◻  ${ev.config.num_preguntas} preguntas`,
    ev.tiempo_limite > 0 ? `⏱  ${ev.tiempo_limite} min` : `⏱  Sin límite`,
  ];
  ctx.font = "13px system-ui, sans-serif";
  let x1 = 24;
  infos1.forEach((info, i) => {
    ctx.fillStyle = i === 0 ? "#10b981" : "rgba(255,255,255,0.7)";
    ctx.fillText(info, x1, 208);
    x1 += ctx.measureText(info).width + 28;
    if (i < infos1.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillText("·", x1 - 18, 208);
    }
  });

  // Info row 2: fecha creación · semana · vencimiento
  const createdDate = ev.created_at ? new Date(ev.created_at) : null;
  const createdStr = createdDate
    ? createdDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const weekNum = createdDate ? getISOWeek(createdDate) : null;
  const venceStr = ev.fecha_vencimiento
    ? new Date(ev.fecha_vencimiento).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : "Sin vencimiento";

  const infos2: Array<{ text: string; color: string }> = [
    ...(createdStr ? [{ text: `📅  Creada: ${createdStr}`, color: "rgba(255,255,255,0.7)" }] : []),
    ...(weekNum ? [{ text: `Semana ${weekNum}`, color: "#e9664a" }] : []),
    { text: `⏰  Vence: ${venceStr}`, color: expired ? "#ef4444" : "rgba(255,255,255,0.7)" },
  ];
  ctx.font = "13px system-ui, sans-serif";
  let x2 = 24;
  infos2.forEach((info, i) => {
    ctx.fillStyle = info.color;
    ctx.fillText(info.text, x2, 244);
    x2 += ctx.measureText(info.text).width + 28;
    if (i < infos2.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillText("·", x2 - 18, 244);
    }
  });

  // Categorías
  if (ev.categorias.length > 0) {
    ctx.font = "11px system-ui, sans-serif";
    let cx = 24;
    ev.categorias.slice(0, 5).forEach((cat) => {
      const cw = ctx.measureText(cat).width + 16;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(cx, 268, cw, 20, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(cat, cx + 8, 282);
      cx += cw + 6;
    });
  }

  // Footer
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, H - 50, W, 50);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText("evalpro.apps.dataico.world", 24, H - 18);
  ctx.textAlign = "right";
  ctx.fillStyle = stateColor + "99";
  ctx.fillText("Compartido desde EvalPro", W - 24, H - 18);
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
};

type AssignModalProps = {
  evaluation: Evaluation;
  areas: Area[];
  onClose: () => void;
};

function AssignParticipantsModal({ evaluation, areas, onClose }: AssignModalProps) {
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loadingModal, setLoadingModal] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
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
            <h3 className="font-display text-[15px] font-semibold transition-colors duration-300" style={{ color: "var(--foreground)" }}>Asignar Participantes</h3>
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
              placeholder="Buscar participante…"
              className="w-full py-2 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
          <p className="mt-2 text-xs transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
            {assignedIds.size} participante{assignedIds.size !== 1 ? "s" : ""} asignado{assignedIds.size !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingModal ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 transition-all duration-300" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm transition-colors duration-300 animate-fade-in" style={{ color: "var(--muted-foreground)" }}>
              {searchQuery ? "No hay participantes que coincidan." : "No hay participantes registrados."}
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
                    onClick={() => !isToggling && toggle(p.id)}
                    disabled={isToggling}
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
                      <div className="truncate text-sm font-medium transition-colors duration-300" style={{ color: isAssigned ? "var(--coral-text)" : "var(--foreground)" }}>{p.full_name || p.email}</div>
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
            Cerrar
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawShareCard(canvasRef.current, ev, areaName);
  }, [ev, areaName]);

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
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>Compartir Evaluación</span>
            </div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{ev.nombre}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary transition-colors" style={{ color: "var(--muted-foreground)" }}>
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="overflow-hidden rounded-xl border border-border/50">
            <canvas ref={canvasRef} className="w-full" style={{ display: "block" }} />
          </div>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            Previsualización de la tarjeta · 800 × 420 px
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleDownload}>
            <Download className="size-4" /> Descargar PNG
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
              {expired ? "VENCIDA" : ev.activa ? "ACTIVA" : "INACTIVA"}
            </span>
          </div>

          {ev.descripcion && (
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{ev.descripcion}</p>
          )}

          {/* Pills */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
              <ClipboardList className="size-3" />{ev.config.num_preguntas} preguntas
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(5,150,105,.12)", color: "#10B981" }}>
              <CheckCircle className="size-3" />Aprueba {ev.config.porcentaje_aprobacion}%
            </span>
            {ev.tiempo_limite > 0 && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(217,119,6,.12)", color: "#FBBF24" }}>
                <Clock className="size-3" />{ev.tiempo_limite} min
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--surface-2)", color: "var(--muted-foreground)" }}>
              {ev.intentos_permitidos} intento{ev.intentos_permitidos !== 1 ? "s" : ""}
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
                Creada: {formatDateTime(ev.created_at!)}
                {weekNum && (
                  <span className="ml-1 rounded px-1.5 py-0.5 font-bold" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
                    Sem. {weekNum}
                  </span>
                )}
              </span>
            )}
            {ev.fecha_vencimiento && (
              <span className="flex items-center gap-1.5 font-medium" style={{ color: expired ? "#EF4444" : "#FBBF24" }}>
                <CalendarX className="size-3" />Vence: {formatDateTime(ev.fecha_vencimiento)}
              </span>
            )}
          </div>
        </div>

        {/* Top-right: participant count only */}
        {participantCount > 0 && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-xl font-bold" style={{ color: "var(--accent)" }}>{participantCount}</div>
            <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>completaron</div>
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
          <BarChart3 className="size-3.5" /> Resultados
        </a>
        <button
          onClick={() => onAssign(ev)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
          title="Asignar participantes"
        >
          <Users className="size-3.5" /> Asignar
        </button>
        <button
          onClick={() => onShare(ev)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
          title="Compartir"
        >
          <Share2 className="size-3.5" /> Compartir
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Secondary: ··· dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg p-1.5 transition-all hover:bg-secondary"
            style={{ color: "var(--muted-foreground)" }}
            title="Más opciones"
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
                <Eye className="size-4" style={{ color: "var(--muted-foreground)" }} /> Vista previa
              </button>
              <button
                onClick={() => { onDuplicate(ev); setMenuOpen(false); }}
                disabled={duplicatingId === ev.id}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-secondary transition-colors disabled:opacity-50"
                style={{ color: "var(--foreground)" }}
              >
                {duplicatingId === ev.id ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" style={{ color: "var(--muted-foreground)" }} />}
                Duplicar
              </button>
              <button
                onClick={() => { onEdit(ev); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-secondary transition-colors"
                style={{ color: "var(--foreground)" }}
              >
                <Edit2 className="size-4" style={{ color: "var(--muted-foreground)" }} /> Editar
              </button>
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                onClick={() => { onDelete(ev.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-destructive/10 transition-colors"
                style={{ color: "var(--destructive)" }}
              >
                <Trash2 className="size-4" /> Eliminar
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
      key = ev.area_id ? (areas.find((a) => a.id === ev.area_id)?.name ?? "Sin área") : "Sin área";
    } else {
      key = ev.created_at ? `Semana ${getISOWeek(new Date(ev.created_at))}` : "Sin fecha";
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
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const [shareEval, setShareEval] = useState<Evaluation | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "area" | "semana">("none");

  // Redirigir a participantes a /participant
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);

  const [items, setItems] = useState<Evaluation[]>([]);

  // Carga inicial en paralelo — evaluaciones, categorías y áreas en un solo round-trip
  useEffect(() => {
    if (!isAdmin) return;

    async function loadAll() {
      try {
        setLoading(true);
        const [evalData, uniqueCategories, areasData, allResults] = await Promise.all([
          evaluationsService.getAll(),
          getUniqueCategories(),
          areasService.getAll(),
          resultsService.getAll().catch(() => []),
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
  };
  const [form, setForm] = useState<Evaluation>(emptyForm);

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
      config: { ...ev.config },
      categorias: [...ev.categorias],
      fecha_vencimiento: ev.fecha_vencimiento ? toLocalDateTimeInput(ev.fecha_vencimiento) : "",
      area_id: ev.area_id ?? null,
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDist !== 100) {
      showToast("La distribución debe sumar 100%", "error");
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
        await evaluationsService.update(editing.id, {
          title: form.nombre,
          description: form.descripcion,
          tiempo_limite: form.tiempo_limite,
          intentos_permitidos: form.intentos_permitidos,
          activa: form.activa,
          categorias: form.categorias,
          config: form.config,
          fecha_vencimiento: fechaVencimientoISO,
          area_id: form.area_id ?? null,
        });

        setItems((p) => p.map((x) => (x.id === editing.id ? { ...form, id: editing.id, fecha_vencimiento: form.fecha_vencimiento || undefined } : x)));
        showToast("Evaluación actualizada");
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
        });

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
        };
        
        setItems((p) => [mappedItem, ...p]);
        showToast("Evaluación creada");
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (err) {
      console.error('Error saving evaluation:', err);
      showToast("Error al guardar la evaluación", "error");
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
      showToast("Evaluación eliminada");
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      showToast("Error al eliminar la evaluación", "error");
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
      const ordered = ev.config?.aleatorio ? shuffleArray(questions) : questions;
      setPreviewQuestions(ordered.slice(0, ev.config?.num_preguntas ?? 10));
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
        title: `Copia de ${ev.nombre}`,
        description: ev.descripcion,
        created_by: profile?.id || null,
        tiempo_limite: ev.tiempo_limite,
        intentos_permitidos: ev.intentos_permitidos,
        activa: false,
        categorias: [...ev.categorias],
        config: { ...ev.config },
        fecha_vencimiento: null,
        area_id: ev.area_id ?? null,
      });

      const mappedItem: Evaluation = {
        id: newEvaluation.id,
        nombre: `Copia de ${ev.nombre}`,
        descripcion: ev.descripcion,
        tiempo_limite: ev.tiempo_limite,
        intentos_permitidos: ev.intentos_permitidos,
        activa: false,
        categorias: [...ev.categorias],
        config: { ...ev.config },
        created_at: newEvaluation.created_at,
        area_id: ev.area_id ?? null,
      };

      setItems((prev) => [mappedItem, ...prev]);
      showToast(`"${mappedItem.nombre}" creada`);
    } catch (err) {
      console.error("Error duplicating evaluation:", err);
      showToast("Error al duplicar la evaluación", "error");
    } finally {
      setDuplicatingId(null);
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
      <AppShell
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando evaluaciones...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
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
      breadcrumb={[{ label: "Gestión" }, { label: "Evaluaciones" }]}
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Nueva Evaluación
        </Button>
      }
    >
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
              placeholder="Buscar evaluaciones…"
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
            <option value="todas">Todas las categorías</option>
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
            <option value="todos">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
          </select>

          {areas.length > 0 && (
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent transition-all duration-300 hover:border-accent/50"
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
            >
              <option value="todas">Todas las áreas</option>
              <option value="sin_area">Sin área</option>
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
                {g === "none" ? "Sin agrupar" : g === "area" ? "Por área" : "Por semana"}
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
              {filtered.length === items.length ? 'No hay evaluaciones. Crea la primera con "Nueva Evaluación".' : 'No hay evaluaciones que coincidan con los filtros.'}
            </p>
          </div>
        ) : (
          <GroupedCards
            items={filtered}
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
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="¿Eliminar evaluación?"
        description={`Se eliminará permanentemente "${items.find((e) => e.id === deletingId)?.nombre ?? "esta evaluación"}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loadingLabel="Eliminando…"
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
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] transition-all duration-300" style={{ color: "var(--accent)" }}>Vista Previa</span>
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
                {previewEval.config.num_preguntas} preguntas
              </span>
              {previewEval.tiempo_limite > 0 && (
                <span className="flex items-center gap-1.5 text-xs transition-colors duration-300" style={{ color: "#FBBF24" }}>
                  <Clock className="size-3.5" />
                  {previewEval.tiempo_limite} min
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs transition-colors duration-300" style={{ color: "#10B981" }}>
                <CheckCircle className="size-3.5" />
                Aprueba {previewEval.config.porcentaje_aprobacion}%
              </span>
              <span className="ml-auto rounded px-2 py-0.5 text-[10px] font-bold transition-all duration-300" style={{ background: "rgba(217,119,6,.12)", color: "#FBBF24" }}>
                VISTA PREVIA — sin registro de respuestas
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
                  No hay preguntas en el banco que coincidan con la configuración de esta evaluación.
                </div>
              ) : (
                <div className="space-y-6">
                  {previewQuestions.map((q, idx) => (
                    <div key={q.id} style={{ animation: `slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms both` }}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full transition-all duration-300 font-mono text-xs font-bold" style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-3">
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
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4 transition-all duration-300">
              <Button variant="outline" className="w-full transition-all duration-300 hover:scale-105" onClick={() => setPreviewEval(null)}>
                Cerrar Vista Previa
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
                {editing ? "Editar" : "Nueva"} Evaluación
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
                    Nombre *
                  </label>
                  <input
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Evaluación de Seguridad Industrial"
                    className="w-full rounded-md border px-3 py-2 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
                    style={{ borderColor: "var(--border)", background: "var(--background)" }}
                  />
                </div>
                <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
                  <label className="mb-1 block text-xs font-medium transition-colors duration-300" style={{ color: "var(--muted-foreground)" }}>
                    Descripción
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
                      Tiempo límite (min, 0 = sin límite)
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
                      Intentos permitidos
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
                  {form.activa ? "Evaluación activa" : "Evaluación inactiva"}
                </button>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Fecha y hora de vencimiento
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fecha_vencimiento || ""}
                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opcional — cuando se cumpla la fecha se inactivará automáticamente para todos los participantes
                  </p>
                </div>
                {areas.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Área
                    </label>
                    <select
                      value={form.area_id || ""}
                      onChange={(e) =>
                        setForm({ ...form, area_id: e.target.value || null })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Sin área (solo por asignación directa)</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <Settings className="size-4 text-accent" />
                  <h4 className="text-sm font-semibold">Configuración de Preguntas</h4>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        N° de preguntas
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
                        <span className="text-muted-foreground">Peso por pregunta:</span>
                        <span className="font-mono font-bold text-accent">{pesoPorPregunta}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Dificultad
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
                        <option value="mixto">Mixto</option>
                        <option value="facil">Fácil</option>
                        <option value="medio">Medio</option>
                        <option value="dificil">Difícil</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Porcentaje de aprobación (%)
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
                      El participante aprueba si obtiene al menos este puntaje
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Distribución por tipo{" "}
                      {totalDist !== 100 && (
                        <span className="ml-1 text-destructive">
                          (debe sumar 100% — actual: {totalDist}%)
                        </span>
                      )}
                    </label>
                    {(
                      [
                        { key: "dist_unica", label: "Selección Única" },
                        { key: "dist_multiple", label: "Selección Múltiple" },
                        { key: "dist_vf", label: "Verdadero / Falso" },
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
                    Orden aleatorio de preguntas
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Categorías incluidas{" "}
                  <span className="text-muted-foreground/70">(vacío = todas)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = form.categorias.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-accent/40"
                        }`}
                      >
                        <Tag className="size-3" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={totalDist !== 100}>
                  <Save className="size-4" />
                  {editing ? "Actualizar" : "Crear"}
                </Button>

                <ConfirmDialog
                  open={showSaveConfirm}
                  title={editing ? "¿Actualizar evaluación?" : "¿Crear evaluación?"}
                  description={editing ? `Confirma que deseas guardar los cambios en "${form.nombre}".` : `Confirma que deseas crear la evaluación "${form.nombre}".`}
                  confirmLabel={editing ? "Actualizar" : "Crear"}
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
