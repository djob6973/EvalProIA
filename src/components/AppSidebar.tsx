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
  
  const role = profile?.role;
  const isParticipantRole = role === 'participant';
  // /account is neutral — context follows role, not path.
  const participantPaths = ["/participant", "/my-history", "/my-results", "/take"];
  const isOnParticipantPath = participantPaths.some((p) => path.startsWith(p));
  // 'both' role users switch context via path; plain 'admin' always sees admin nav.
  const showParticipantNav = isParticipantRole || (role === 'both' && isOnParticipantPath);
  const nav = showParticipantNav ? participantNav : adminNav;
  const isParticipantPath = isOnParticipantPath;
  const groups = Array.from(new Set(nav.map((n) => n.group)));

  // Obtener iniciales del nombre del usuario
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
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-border bg-sidebar md:flex">
      <div className="border-b border-border p-6">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">EvalPro</span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sistema de Evaluación
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-2 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group}
            </div>
            <div className="space-y-0.5">
              {nav
                .filter((n) => n.group === group)
                .map((item) => {
                  const active = path === item.url;
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={2} />
                      {item.title}
                      {active && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-4">
        {!isParticipantRole && (
          <Link to={isParticipantPath ? "/dashboard" : "/participant"} className="mb-3 block">
            <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary">
              Cambiar a {isParticipantPath ? "Administrador" : "Participante"}
            </div>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-3" />
          Cerrar Sesión
        </button>
        <div className="flex items-center gap-3 px-1">
          <div className="grid size-9 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight">{displayName}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {profile?.role === 'both' ? "Admin + Participante" : isParticipantRole ? "Participante" : "Administrador"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
