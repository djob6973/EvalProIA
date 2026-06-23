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
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const adminNav = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard, group: "Gestión" },
  { title: "Usuarios", url: "/users", icon: Users, group: "Gestión" },
  { title: "Áreas", url: "/areas", icon: Layers, group: "Gestión" },
  { title: "Evaluaciones", url: "/evaluations", icon: ClipboardList, group: "Gestión" },
  { title: "Banco de Preguntas", url: "/question-bank", icon: Library, group: "Gestión" },
  { title: "Generador IA", url: "/generate", icon: Sparkles, group: "Herramientas" },
  { title: "Resultados Globales", url: "/results", icon: BarChart3, group: "Herramientas" },
  { title: "Prompts IA", url: "/settings", icon: Settings, group: "Herramientas" },
  { title: "Configuración", url: "/config", icon: SlidersHorizontal, group: "Herramientas" },
  { title: "Mi Cuenta", url: "/account", icon: KeyRound, group: "Cuenta" },
];

const participantNav = [
  { title: "Inicio", url: "/participant", icon: Home, group: "Participante" },
  { title: "Mi Historial", url: "/my-history", icon: History, group: "Participante" },
  { title: "Mi Cuenta", url: "/account", icon: KeyRound, group: "Cuenta" },
];

type AppSidebarProps = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

export function AppSidebar({ mobileOpen, setMobileOpen }: AppSidebarProps) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const isMobile = useIsMobile();
  const { settings } = useSystemSettings();

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

  const renderNavItem = (item: typeof adminNav[number]) => {
    const active = path === item.url;
    return (
      <Link
        key={item.url}
        to={item.url}
        onClick={() => isMobile && setMobileOpen(false)}
        className={
          "flex items-center gap-3 rounded-[14px] px-3 py-2 text-[14px] font-medium transition-all duration-150 " +
          (active
            ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-[0_8px_24px_rgba(237,86,80,0.12)]"
            : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]")
        }
      >
        <item.icon className="size-[18px] shrink-0" strokeWidth={1.5} />
        {item.title}
      </Link>
    );
  };

  const logoSection = (
    <div className="shrink-0 border-b border-[var(--sidebar-border)] px-6 py-6 pb-5">
      <Link to="/dashboard" className="flex items-center gap-3">
        {settings.brand_logo ? (
          <img
            src={settings.brand_logo}
            alt="Logo organización"
            className="h-11 max-w-[88px] shrink-0 object-contain"
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-white"
            style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
          >
            <Brain className="size-[18px]" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex min-w-0 flex-col leading-none">
          <span className="font-display text-[18px] font-medium tracking-tight text-[var(--foreground)]">
            EvalPro
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[.2em] text-[var(--text-faint)]">
            Sistema de Evaluación
          </span>
        </div>
      </Link>
    </div>
  );

  const navSection = (
    <nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group}>
          <div className="mb-1 px-3 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[var(--text-faint)]">
            {group}
          </div>
          <div className="flex flex-col gap-2">
            {nav.filter((n) => n.group === group).map(renderNavItem)}
          </div>
        </div>
      ))}
    </nav>
  );

  const footerSection = (
    <div className="shrink-0 border-t border-[var(--sidebar-border)] p-5">
      {!isParticipantRole && (
        <Link to={isParticipantPath ? "/dashboard" : "/participant"} className="mb-4 block">
          <div className="rounded-full border border-[var(--border-strong)] bg-[var(--sidebar-accent)] px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[.2em] text-[var(--sidebar-foreground)] transition hover:border-[var(--sidebar-primary)] hover:text-[var(--sidebar-primary)]">
            Cambiar a {isParticipantPath ? "Administrador" : "Participante"}
          </div>
        </Link>
      )}
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sidebar-primary)] font-mono text-[11px] font-bold text-[var(--sidebar-primary-foreground)]">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {displayName}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            {profile?.role === 'both' ? "Admin + Participante" : isParticipantRole ? "Participante" : "Administrador"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="grid h-10 w-10 place-items-center rounded-[14px] border border-[var(--border)] bg-transparent text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--coral-soft)] hover:text-[var(--coral-text)]"
        >
          <LogOut className="size-[16px]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="fixed left-4 top-4 hidden w-[260px] flex-col bg-[var(--sidebar)] md:flex"
        style={{ height: 'calc(100vh - 32px)', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      >
        {logoSection}
        {navSection}
        {footerSection}
      </aside>

      <Sheet open={isMobile ? mobileOpen : false} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex flex-col w-[300px] max-w-[85vw] bg-[var(--sidebar)] p-0 shadow-2xl"
        >
          {/* Header móvil con logo y botón de cierre */}
          <div className="shrink-0 flex items-center justify-between border-b border-[var(--sidebar-border)] px-5 py-5">
            <div className="flex items-center gap-3">
              {settings.brand_logo ? (
                <img
                  src={settings.brand_logo}
                  alt="Logo organización"
                  className="h-11 max-w-[88px] shrink-0 object-contain"
                />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-white"
                  style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
                >
                  <Brain className="size-[18px]" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex min-w-0 flex-col leading-none">
                <span className="font-display text-[17px] font-medium tracking-tight text-[var(--foreground)]">
                  EvalPro
                </span>
                <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[.2em] text-[var(--text-faint)]">
                  Menú
                </span>
              </div>
            </div>
            <SheetClose asChild>
              <button className="grid h-10 w-10 place-items-center rounded-[14px] border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--sidebar-accent)]">
                <X className="size-[18px]" strokeWidth={1.5} />
              </button>
            </SheetClose>
          </div>
          {navSection}
          {footerSection}
        </SheetContent>
      </Sheet>
    </>
  );
}
