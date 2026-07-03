import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Mi Cuenta — EvalPro" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuario';
  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.split('@')[0]?.toUpperCase().slice(0, 2) || 'US';
  const roleLabel = t(`roles.${profile?.role}`);

  return (
    <AppShell>
      <PageHeader title={t('account.title')} />
      <div className="mx-auto max-w-[480px] flex flex-col gap-[20px]">
        {/* Profile card */}
        <div
          className="rounded-[20px] p-[22px] flex items-center gap-[16px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="grid size-[52px] shrink-0 place-items-center rounded-full font-mono text-[16px] font-bold"
            style={{ background: "#FBE6E6", color: "#B43C35" }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[17px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
              {displayName}
            </div>
            <div className="mt-[2px] text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              {profile?.email}
            </div>
            <span
              className="mt-[6px] inline-block font-mono text-[9px] font-bold uppercase tracking-[.12em]"
              style={{ background: "var(--coral-soft)", color: "var(--coral-text)", borderRadius: 6, padding: "2px 8px" }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        {/* SSO info card */}
        <div
          className="rounded-[20px] px-[22px] py-[16px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Tu sesión está gestionada por Google SSO. No se requiere contraseña adicional.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
