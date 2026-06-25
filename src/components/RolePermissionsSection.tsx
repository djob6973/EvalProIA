import { useState, useEffect } from "react";
import { Shield, RotateCcw } from "lucide-react";
import {
  LayoutDashboard, Users, Layers, ClipboardList, Library,
  Sparkles, BarChart3, Settings, SlidersHorizontal, Home, History,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { key: "super_admin",  label: "Super Admin"   },
  { key: "admin",        label: "Administrador" },
  { key: "supervisor",   label: "Supervisor"    },
  { key: "leader",       label: "Líder"         },
  { key: "participant",  label: "Participante"  },
] as const;

type RoleKey = typeof ROLES[number]["key"];

const MODULES = [
  { key: "dashboard",     label: "Dashboard"          },
  { key: "users",         label: "Usuarios"           },
  { key: "areas",         label: "Áreas"              },
  { key: "evaluations",   label: "Evaluaciones"       },
  { key: "question_bank", label: "Banco de Preguntas" },
  { key: "generate",      label: "Generador IA"       },
  { key: "results",       label: "Resultados Globales"},
  { key: "settings",      label: "Prompts IA"         },
  { key: "config",        label: "Configuración"      },
  { key: "participant",   label: "Panel Participante" },
  { key: "my_history",    label: "Mi Historial"       },
] as const;

const CAPABILITIES = [
  { key: "create_users",   label: "Crear usuarios"         },
  { key: "delete_users",   label: "Eliminar usuarios"      },
  { key: "manage_areas",   label: "Gestionar áreas"        },
  { key: "export_results", label: "Exportar resultados"    },
  { key: "generate_ai",    label: "Generar con IA"         },
  { key: "manage_config",  label: "Gestionar configuración"},
] as const;

const LEVELS = ["none", "ver", "editar", "full"] as const;
type Level = typeof LEVELS[number];

type Matrix       = Record<string, Record<string, Level>>;
type Capabilities = Record<string, Record<string, boolean>>;

const NAV_PREVIEW = [
  { key: "dashboard",     label: "Dashboard",           icon: LayoutDashboard   },
  { key: "users",         label: "Usuarios",            icon: Users             },
  { key: "areas",         label: "Áreas",               icon: Layers            },
  { key: "evaluations",   label: "Evaluaciones",        icon: ClipboardList     },
  { key: "question_bank", label: "Banco de Preguntas",  icon: Library           },
  { key: "generate",      label: "Generador IA",        icon: Sparkles          },
  { key: "results",       label: "Resultados Globales", icon: BarChart3         },
  { key: "settings",      label: "Prompts IA",          icon: Settings          },
  { key: "config",        label: "Configuración",       icon: SlidersHorizontal },
  { key: "participant",   label: "Participante",        icon: Home              },
  { key: "my_history",    label: "Mi Historial",        icon: History           },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextLevel(current: Level): Level {
  return LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
}

function deepEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── LevelBadge ────────────────────────────────────────────────────────────────

function LevelBadge({ level, onClick }: { level: Level; onClick: () => void }) {
  if (level === "none") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex justify-center py-0.5 text-sm text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)] transition-colors cursor-pointer"
      >
        —
      </button>
    );
  }

  const isStrong = level === "editar" || level === "full";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
        isStrong
          ? "bg-[rgba(237,86,80,0.12)] text-[#ED5650] hover:bg-[rgba(237,86,80,0.22)]"
          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
      }`}
    >
      {level === "full" ? "Full" : level === "editar" ? "Editar" : "Ver"}
    </button>
  );
}

// ── CapabilityToggle ──────────────────────────────────────────────────────────

function CapabilityToggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-base font-bold transition cursor-pointer ${
        enabled
          ? "text-[#ED5650] hover:text-[#c94040]"
          : "text-[var(--muted-foreground)]/30 hover:text-[var(--muted-foreground)]"
      }`}
    >
      {enabled ? "✓" : "✕"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RolePermissionsSection() {
  const [matrix,           setMatrix]           = useState<Matrix>({});
  const [capabilities,     setCapabilities]     = useState<Capabilities>({});
  const [savedMatrix,      setSavedMatrix]      = useState<Matrix>({});
  const [savedCapabilities,setSavedCapabilities]= useState<Capabilities>({});
  const [saving,   setSaving]  = useState(false);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState<string | null>(null);
  const [previewRole, setPreviewRole] = useState<RoleKey>("super_admin");

  const hasPendingChanges =
    !deepEqual(matrix, savedMatrix) || !deepEqual(capabilities, savedCapabilities);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/data/role-permissions");
      if (!res.ok) throw new Error("Error al cargar permisos");
      const data = await res.json();
      setMatrix(data.matrix);
      setSavedMatrix(data.matrix);
      setCapabilities(data.capabilities);
      setSavedCapabilities(data.capabilities);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function cyclePermission(role: string, module: string) {
    setMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [module]: nextLevel((prev[role]?.[module] ?? "none") as Level) },
    }));
  }

  function toggleCapability(role: string, cap: string) {
    setCapabilities(prev => ({
      ...prev,
      [role]: { ...prev[role], [cap]: !(prev[role]?.[cap] ?? false) },
    }));
  }

  function discard() {
    setMatrix(savedMatrix);
    setCapabilities(savedCapabilities);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/data/role-permissions", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ matrix, capabilities }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setSavedMatrix(matrix);
      setSavedCapabilities(capabilities);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        Cargando configuración de roles…
      </div>
    );
  }

  const thClass = "px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]";

  return (
    <div className="space-y-4">
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
          style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
        >
          <Shield className="size-[16px]" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">Gestión de Permisos</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Configuración de Roles — define qué puede ver y hacer cada rol
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* ── 1. Matriz de permisos por módulo ───────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Matriz de permisos por módulo
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Clic en una celda para cambiar: — → Ver → Editar → Full
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            title="Recargar"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition"
          >
            <RotateCcw className="size-[14px]" strokeWidth={1.5} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] w-44">
                  Módulo
                </th>
                {ROLES.map(r => (
                  <th key={r.key} className={thClass}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, i) => (
                <tr key={mod.key} className={i % 2 !== 0 ? "bg-[var(--secondary)]/25" : ""}>
                  <td className="px-6 py-2.5 text-sm font-medium text-[var(--foreground)]">
                    {mod.label}
                  </td>
                  {ROLES.map(role => (
                    <td key={role.key} className="px-3 py-2.5 text-center">
                      <LevelBadge
                        level={(matrix[role.key]?.[mod.key] ?? "none") as Level}
                        onClick={() => cyclePermission(role.key, mod.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
          <span className="text-xs text-[var(--muted-foreground)]">
            {hasPendingChanges ? "Cambios pendientes" : "Sin cambios pendientes"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={!hasPendingChanges || saving}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)] disabled:opacity-40"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!hasPendingChanges || saving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
              style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
            >
              {saving ? "Guardando…" : "✓ Guardar cambios"}
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Límites granulares ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Límites granulares</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Clic para activar o desactivar capacidades por rol
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] w-44">
                  Capacidad
                </th>
                {ROLES.map(r => (
                  <th key={r.key} className={thClass}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap, i) => (
                <tr key={cap.key} className={i % 2 !== 0 ? "bg-[var(--secondary)]/25" : ""}>
                  <td className="px-6 py-2.5 text-sm font-medium text-[var(--foreground)]">
                    {cap.label}
                  </td>
                  {ROLES.map(role => (
                    <td key={role.key} className="px-3 py-2.5 text-center">
                      <CapabilityToggle
                        enabled={capabilities[role.key]?.[cap.key] ?? false}
                        onClick={() => toggleCapability(role.key, cap.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Vista previa del menú por rol ───────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Vista previa del menú por rol
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Lo que ve cada rol en la barra lateral
          </p>
        </div>

        <div className="p-6">
          {/* Role selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {ROLES.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setPreviewRole(r.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  previewRole === r.key
                    ? "bg-[rgba(237,86,80,0.12)] text-[#ED5650]"
                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                ROL: {r.label}
              </button>
            ))}
          </div>

          {/* Nav items preview */}
          <div className="flex flex-wrap gap-2">
            {NAV_PREVIEW.map(item => {
              const level = (matrix[previewRole]?.[item.key] ?? "none") as Level;
              if (level === "none") return null;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2 text-xs font-medium text-[var(--foreground)]"
                >
                  <item.icon className="size-[14px] text-[var(--muted-foreground)]" strokeWidth={1.5} />
                  {item.label}
                </div>
              );
            })}
            {NAV_PREVIEW.every(item => (matrix[previewRole]?.[item.key] ?? "none") === "none") && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Este rol no tiene acceso a ningún módulo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
