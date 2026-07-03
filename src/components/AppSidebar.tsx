import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  Library,
  Sparkles,
  BarChart3,
  Settings,
  Brain,
  History,
  Home,
  Layers,
  User,
  X,
  SlidersHorizontal,
  Sun,
  Moon,
  ChevronRight,
  Languages,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toTitleCase } from "@/lib/utils";

const adminNavDef = [
  { titleKey: "nav.dashboard",      url: "/dashboard",     icon: LayoutDashboard,   groupKey: "nav.management", module: "dashboard"     },
  { titleKey: "nav.areas",          url: "/areas",         icon: Layers,            groupKey: "nav.management", module: "areas"         },
  { titleKey: "nav.evaluations",    url: "/evaluations",   icon: ClipboardList,     groupKey: "nav.management", module: "evaluations"   },
  { titleKey: "nav.questionBank",   url: "/question-bank", icon: Library,           groupKey: "nav.management", module: "question_bank" },
  { titleKey: "nav.generateAI",     url: "/generate",      icon: Sparkles,          groupKey: "nav.tools",      module: "generate"      },
  { titleKey: "nav.globalResults",  url: "/results",       icon: BarChart3,         groupKey: "nav.tools",      module: "results"       },
  { titleKey: "nav.promptsAI",      url: "/settings",      icon: Settings,          groupKey: "nav.tools",      module: "settings"      },
  { titleKey: "nav.config",         url: "/config",        icon: SlidersHorizontal, groupKey: "nav.tools",      module: "config"        },
];

const participantNavDef = [
  { titleKey: "nav.home",      url: "/participant", icon: Home,    groupKey: "nav.participant", module: "participant" },
  { titleKey: "nav.myHistory", url: "/my-history",  icon: History, groupKey: "nav.participant", module: "my-history"  },
];

type AppSidebarProps = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isDark: boolean;
  toggleTheme: () => void;
};

export function AppSidebar({ mobileOpen, setMobileOpen, isDark, toggleTheme }: AppSidebarProps) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { settings } = useSystemSettings();
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  const LANGUAGES = [
    { code: "es", label: "Español" },
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
  ];

  const { canAccess, loading: permLoading } = useRolePermissions();
  const isParticipantRole = profile?.role === 'participant';
  const isOnParticipantPath = ["/participant", "/my-history", "/my-results", "/take"].some(
    (p) => path.startsWith(p)
  );
  const showParticipantNav = isParticipantRole || isOnParticipantPath;
  const adminNav = adminNavDef.map(item => ({ ...item, title: t(item.titleKey), group: t(item.groupKey) }));
  const participantNav = participantNavDef.map(item => ({ ...item, title: t(item.titleKey), group: t(item.groupKey) }));
  const filteredAdminNav = permLoading ? [] : adminNav.filter((item) => canAccess(item.module));
  const nav = showParticipantNav ? participantNav : filteredAdminNav;
  const isParticipantPath = isOnParticipantPath;
  const groups = Array.from(new Set(nav.map((n) => n.group)));

  const displayName = toTitleCase(profile?.full_name) || profile?.email?.split('@')[0] || t('roles.user');
  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.split('@')[0]?.toUpperCase().slice(0, 2) || 'US';
  const roleLabel = profile?.role ? t(`roles.${profile.role}`) : t('roles.user');

  const renderNavItem = (item: typeof adminNav[number]) => {
    const active = path === item.url;
    return (
      <Link
        key={item.url}
        to={item.url}
        onClick={() => isMobile && setMobileOpen(false)}
        className={
          "flex items-center gap-3 rounded-[14px] px-3 py-[10px] text-[14px] font-medium transition-all duration-150 " +
          (active
            ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-[0_8px_24px_rgba(237,86,80,0.12)]"
            : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]")
        }
      >
        <item.icon className="size-[20px] shrink-0" strokeWidth={1.5} />
        {item.title}
      </Link>
    );
  };

  const logoSection = (
    <div className="shrink-0 px-5 py-5">
      <Link to="/dashboard" className="flex items-center gap-3">
        {settings.brand_logo ? (
          <img
            src={settings.brand_logo}
            alt="Logo organización"
            className="h-10 max-w-[80px] shrink-0 object-contain"
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white"
            style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
          >
            <Brain className="size-[18px]" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="font-sans text-[17px] font-bold leading-[1.2] text-[var(--foreground)]">
            {t('common.appName')}
          </span>
          <span className="mt-[2px] text-[12px] text-[var(--muted-foreground)]">
            {t('common.appSubtitle')}
          </span>
        </div>
      </Link>
    </div>
  );

  const navSection = (
    <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group}>
          <div className="mb-1 px-3 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[var(--text-faint)]">
            {group}
          </div>
          <div className="flex flex-col gap-1">
            {nav.filter((n) => n.group === group).map(renderNavItem)}
          </div>
        </div>
      ))}
    </nav>
  );

  const footerSection = (
    <div className="shrink-0 px-4 py-4">
      {/* Role toggle — only for admins with both roles */}
      {!isParticipantRole && (
        <Link to={isParticipantPath ? "/dashboard" : "/participant"} className="mb-3 block">
          <div className="rounded-full border border-[var(--border-strong)] bg-[var(--sidebar-accent)] px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-[.2em] text-[var(--sidebar-foreground)] transition hover:border-[var(--sidebar-primary)] hover:text-[var(--sidebar-primary)]">
            {isParticipantPath ? t('nav.switchToAdmin') : t('nav.switchToParticipant')}
          </div>
        </Link>
      )}

      {/* Action row: language · theme toggle · change password · logout */}
      <div className="mb-3 flex items-center justify-evenly px-2 relative">
        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setLangOpen((v) => !v)}
            title={t('language.selector')}
            className="grid h-9 w-9 place-items-center rounded-[12px] bg-transparent text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]"
          >
            <Languages className="size-[16px]" strokeWidth={1.5} />
          </button>
          {langOpen && (
            <div className="absolute bottom-10 left-0 z-50 min-w-[120px] rounded-[12px] border border-[var(--border)] bg-[var(--sidebar)] py-1 shadow-lg">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                  className={
                    "w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--sidebar-accent)] " +
                    (i18n.language === lang.code ? "font-semibold text-[var(--sidebar-primary)]" : "text-[var(--sidebar-foreground)]")
                  }
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          title={isDark ? t('nav.lightMode') : t('nav.darkMode')}
          className="grid h-9 w-9 place-items-center rounded-[12px] bg-transparent text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]"
        >
          {isDark
            ? <Sun className="size-[16px]" strokeWidth={1.5} />
            : <Moon className="size-[16px]" strokeWidth={1.5} />}
        </button>
        <Link
          to="/account"
          title={t('account.title')}
          className="grid h-9 w-9 place-items-center rounded-[12px] bg-transparent text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]"
          onClick={() => isMobile && setMobileOpen(false)}
        >
          <User className="size-[16px]" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Profile block → Mi Cuenta */}
      <Link
        to="/account"
        onClick={() => isMobile && setMobileOpen(false)}
        className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-all duration-150 hover:bg-[var(--sidebar-accent)]"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold text-white" style={{ background: "#E65656" }}>
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {displayName}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            {roleLabel}
          </div>
        </div>
        <ChevronRight className="size-[16px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.5} />
      </Link>
    </div>
  );

  return (
    <>
      <aside
        className="fixed left-4 top-4 hidden w-[240px] flex-col bg-[var(--sidebar)] md:flex"
        style={{ height: 'calc(100vh - 2rem)', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      >
        {logoSection}
        {navSection}
        {footerSection}
      </aside>

      <Sheet open={isMobile ? mobileOpen : false} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex flex-col w-[280px] max-w-[85vw] bg-[var(--sidebar)] p-0 shadow-2xl"
        >
          {/* Mobile header: logo + close */}
          <div className="shrink-0 flex items-center justify-between border-b border-[var(--sidebar-border)] px-5 py-5">
            <div className="flex items-center gap-3">
              {settings.brand_logo ? (
                <img
                  src={settings.brand_logo}
                  alt="Logo organización"
                  className="h-10 max-w-[80px] shrink-0 object-contain"
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white"
                  style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
                >
                  <Brain className="size-[18px]" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex min-w-0 flex-col">
                <span className="font-sans text-[17px] font-bold leading-[1.2] text-[var(--foreground)]">
                  {t('common.appName')}
                </span>
                <span className="mt-[2px] text-[12px] text-[var(--muted-foreground)]">
                  {t('common.appSubtitle')}
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
