import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UsersTab } from "@/components/UsersTab";
import { RolePermissionsSection } from "@/components/RolePermissionsSection";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useSystemSettings, invalidateSystemSettings } from "@/hooks/useSystemSettings";
import { useEffect, useRef, useState } from "react";
import { Users, Shield, Building2, Paintbrush, ImageIcon, Upload } from "lucide-react";

export const Route = createFileRoute("/config")({
  head: () => ({ meta: [{ title: "Configuración — EvalPro" }] }),
  component: ConfigPage,
});

type TabKey = "users" | "roles" | "org" | "brand";

function ConfigPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  const ALL_TABS = [
    { key: "users" as const, label: t('config.tabUsers'), icon: Users,      perm: "config.users"  },
    { key: "roles" as const, label: t('config.tabRoles'), icon: Shield,     perm: "config.roles"  },
    { key: "org"   as const, label: t('config.tabOrg'),   icon: Building2,  perm: "config.org"    },
    { key: "brand" as const, label: t('config.tabBrand'), icon: Paintbrush, perm: "config.brand"  },
  ];

  // A tab is visible if the user can access its sub-module OR has full config access
  const { getLevel } = useRolePermissions();
  const visibleTabs = ALL_TABS.filter(tab => {
    if (!profile) return false;
    const role = profile.role;
    if (role === 'super_admin' || role === 'admin' || role === 'both') return true;
    // sub-module level takes precedence; fall back to parent 'config' level
    const subLevel = getLevel(tab.perm);
    if (subLevel !== 'none') return true;
    return false;
  });

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/account" }); return; }
    if (!permLoading && !canAccess('config')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  // Auto-select first visible tab once permissions load
  useEffect(() => {
    if (!permLoading && visibleTabs.length > 0 && activeTab === null) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [permLoading, visibleTabs.length]);

  return (
    <AppShell>
      <PageHeader title={t('config.title')} subtitle={t('config.subtitle')} />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 border-b border-[var(--border)]">
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "text-[#ED5650]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon className="size-[15px]" strokeWidth={1.5} />
              {tab.label}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                  style={{ background: "#ED5650" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {activeTab === "users"  && <UsersTab />}
      {activeTab === "roles"  && <RolePermissionsSection />}
      {activeTab === "org"    && <OrgTab />}
      {activeTab === "brand"  && <BrandTab />}
    </AppShell>
  );
}

// ── Organización tab ──────────────────────────────────────────────────────────

function OrgTab() {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "#ED5650" }}
          >
            <Building2 className="size-[16px]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">{t('config.orgTitle')}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{t('config.orgDesc')}</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('config.orgSoon')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Marca tab (logo management) ───────────────────────────────────────────────

function BrandTab() {
  const { t } = useTranslation();
  const { settings } = useSystemSettings();
  const [logoPreview,      setLogoPreview]      = useState<string | null>(null);
  const [logoSaving,       setLogoSaving]       = useState(false);
  const [logoError,        setLogoError]        = useState<string | null>(null);
  const [logoSuccess,      setLogoSuccess]      = useState(false);
  const [showDeleteConfirm,setShowDeleteConfirm]= useState(false);
  const [isDragging,       setIsDragging]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLogo = settings.brand_logo ?? null;
  const displayLogo = logoPreview ?? currentLogo;

  function processFile(file: File) {
    setLogoError(null); setLogoSuccess(false);
    if (!["image/png","image/jpeg","image/svg+xml","image/webp"].includes(file.type))
      return setLogoError(t('config.brandRules1'));
    if (file.size > 500_000) return setLogoError(t('config.brandRules2'));
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function saveLogo() {
    if (!logoPreview) return;
    setLogoSaving(true); setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: logoPreview }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error al guardar"); }
      invalidateSystemSettings();
      setLogoSuccess(true); setLogoPreview(null);
    } catch (err: any) { setLogoError(err.message); }
    finally { setLogoSaving(false); }
  }

  async function deleteLogo() {
    setLogoSaving(true); setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      invalidateSystemSettings();
      setLogoPreview(null); setLogoSuccess(false); setShowDeleteConfirm(false);
    } catch (err: any) { setLogoError(err.message); }
    finally { setLogoSaving(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "#ED5650" }}
          >
            <Paintbrush className="size-[16px]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">{t('config.brandTitle')}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{t('config.brandDesc')}</p>
          </div>
        </div>

        <div className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); if (fileInputRef.current) fileInputRef.current.value = ""; }}
          />

          <div
            onClick={() => !logoSaving && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
            className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-150 ${
              isDragging
                ? "border-[var(--sidebar-primary)] bg-[rgba(237,86,80,0.06)]"
                : "border-[var(--border-strong)] bg-[var(--secondary)]/40 hover:border-[var(--sidebar-primary)] hover:bg-[rgba(237,86,80,0.04)]"
            }`}
          >
            {displayLogo ? (
              <img src={displayLogo} alt="Logo" className="max-h-24 max-w-[280px] object-contain" />
            ) : (
              <>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <ImageIcon className="size-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">{t('config.brandClickToSelect')}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{t('config.brandFileTypes')}</p>
                </div>
              </>
            )}
            {logoPreview && (
              <div className="absolute bottom-3 right-3 rounded-md bg-[var(--card)] px-2 py-1 text-[10px] font-semibold text-[var(--muted-foreground)] shadow border border-[var(--border)]">
                {t('config.brandPreview')}
              </div>
            )}
          </div>

          {logoError   && <p className="mt-3 text-xs text-destructive">{logoError}</p>}
          {logoSuccess && !logoPreview && <p className="mt-3 text-xs text-emerald-600">{t('config.brandSaved')}</p>}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={logoSaving}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)] disabled:opacity-50"
            >
              <Upload className="size-4" strokeWidth={1.5} />
              {t('config.brandSelectLogo')}
            </button>
            {logoPreview && (
              <button onClick={saveLogo} disabled={logoSaving} className="rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50" style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}>
                {logoSaving ? t('common.saving') : t('config.brandSaveLogo')}
              </button>
            )}
            {logoPreview && (
              <button onClick={() => { setLogoPreview(null); setLogoError(null); }} disabled={logoSaving} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)] disabled:opacity-50">
                {t('common.cancel')}
              </button>
            )}
            {currentLogo && !logoPreview && (
              <button onClick={() => setShowDeleteConfirm(true)} disabled={logoSaving} className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                {t('config.brandDeleteLogo')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('config.brandDeleteTitle')}
        description={t('config.brandDeleteDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={deleteLogo}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
