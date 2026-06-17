import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Library,
  Sparkles,
  BarChart3,
  Settings,
  Brain,
  History,
  Home,
  LogOut,
  Layers,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const adminNav = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard, group: "Gestión" },
  { title: "Usuarios", url: "/users", icon: Users, group: "Gestión" },
  { title: "Áreas", url: "/areas", icon: Layers, group: "Gestión" },
  { title: "Evaluaciones", url: "/evaluations", icon: ClipboardList, group: "Gestión" },
  { title: "Banco de Preguntas", url: "/question-bank", icon: Library, group: "Gestión" },
  { title: "Generador IA", url: "/generate", icon: Sparkles, group: "Herramientas" },
  { title: "Resultados Globales", url: "/results", icon: BarChart3, group: "Herramientas" },
  { title: "Configuración de Prompts", url: "/settings", icon: Settings, group: "Herramientas" },
  { title: "Mi Cuenta", url: "/account", icon: KeyRound, group: "Cuenta" },
];

const participantNav = [
  { title: "Inicio", url: "/participant", icon: Home, group: "Participante" },
  { title: "Mi Historial", url: "/my-history", icon: History, group: "Participante" },
  { title: "Mi Cuenta", url: "/account", icon: KeyRound, group: "Cuenta" },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const isParticipantRole = profile?.role === 'participant';
  const isOnParticipantPath = ["/participant", "/my-history", "/my-results", "/take"].some(
    (p) => path.startsWith(p)
  );
  const showParticipantNav = isParticipantRole || isOnParticipantPath;
  const nav = showParticipantNav ? participantNav : adminNav;
  const isParticipantPath = isOnParticipantPath;
  const groups = Array.from(new Set(nav.map((n) => n.group)));

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuario';
  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.split('@')[0]?.toUpperCase().slice(0, 2) || 'US';

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate({ to: "/login" });
    }
  };

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[260px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] md:flex">
      {/* Logo */}
      <div className="border-b border-[var(--sidebar-border)] px-[22px] py-[22px] pb-[18px]">
        <Link to="/dashboard" className="flex items-center gap-[11px]">
          <div
            className="flex size-9 items-center justify-center text-white flex-shrink-0"
            style={{ borderRadius: "11px", background: "var(--primary)" }}
          >
            <Brain className="size-[18px]" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="font-display text-[17px] font-medium tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              EvalPro
            </span>
            <span
              className="mt-[3px] font-mono text-[9px] uppercase tracking-[.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              Sistema de Evaluación
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[14px] py-[16px] flex flex-col gap-[22px]">
        {groups.map((group) => (
          <div key={group}>
            <div
              className="mb-2 px-3 font-mono text-[9px] font-bold uppercase tracking-[.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              {group}
            </div>
            <div className="flex flex-col gap-[3px]">
              {nav
                .filter((n) => n.group === group)
                .map((item) => {
                  const active = path === item.url;
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      className="flex items-center gap-[11px] w-full text-left rounded-[10px] px-3 py-[9px] text-[14px] font-medium transition-colors duration-100"
                      style={
                        active
                          ? { background: "var(--accent)", color: "#fff", fontWeight: 700 }
                          : { background: "transparent", color: "var(--muted-foreground)" }
                      }
                    >
                      <item.icon className="size-[17px] shrink-0" strokeWidth={1.5} />
                      {item.title}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-[var(--sidebar-border)] p-[14px]">
        {!isParticipantRole && (
          <Link to={isParticipantPath ? "/dashboard" : "/participant"} className="mb-3 block">
            <div
              className="rounded-[10px] border px-3 py-[9px] text-center font-mono text-[9px] uppercase tracking-[.14em] transition-colors"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--muted-foreground)",
              }}
            >
              Cambiar a {isParticipantPath ? "Administrador" : "Participante"}
            </div>
          </Link>
        )}
        <div className="flex items-center gap-[11px] px-[2px] py-1">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[13px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {displayName}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {profile?.role === 'both' ? "Admin + Participante" : isParticipantRole ? "Participante" : "Administrador"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="grid size-8 place-items-center rounded-[8px] border transition-all duration-100"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--muted-foreground)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "var(--coral-soft)";
              el.style.color = "var(--coral-text)";
              el.style.borderColor = "var(--coral-soft)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "transparent";
              el.style.color = "var(--muted-foreground)";
              el.style.borderColor = "var(--border)";
            }}
          >
            <LogOut className="size-[15px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
