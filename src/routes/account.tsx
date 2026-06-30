import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Mi Cuenta — EvalPro" }] }), // static head, translated at runtime in component
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!currentPassword) { setError(t('account.currentRequired')); return; }
    if (newPassword.length < 6) { setError(t('account.minChars')); return; }
    if (newPassword !== confirmPassword) { setError(t('account.mismatch')); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/change-own-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('account.changeError'));
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || t('account.changeError'));
    } finally {
      setIsLoading(false);
    }
  }

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
            className="grid size-[52px] shrink-0 place-items-center rounded-full bg-foreground font-mono text-[16px] font-bold text-background"
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

        {/* Password form card */}
        <div
          className="overflow-hidden rounded-[20px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="flex items-center justify-between px-[22px] py-[18px] border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="font-display text-[17px] font-medium m-0" style={{ color: "var(--foreground)" }}>
              {t('account.security')}
            </h2>
          </div>
          <div className="p-[22px]">
            {success && (
              <div
                className="mb-[16px] rounded-[10px] p-3 text-[13px] font-medium"
                style={{ background: "#ECFDF5", color: "#059669" }}
              >
                {t('account.passwordUpdated')}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
              {error && (
                <div
                  className="rounded-[10px] p-3 text-[13px]"
                  style={{ background: "var(--coral-soft)", color: "var(--coral-text)" }}
                >
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-[6px]">
                <Label
                  htmlFor="current"
                  className="font-mono text-[9px] font-bold uppercase tracking-[.12em]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {t('account.currentPassword')}
                </Label>
                <Input id="current" type="password" placeholder="••••••••"
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label
                  htmlFor="new"
                  className="font-mono text-[9px] font-bold uppercase tracking-[.12em]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {t('account.newPassword')}
                </Label>
                <Input id="new" type="password" placeholder="••••••••"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label
                  htmlFor="confirm"
                  className="font-mono text-[9px] font-bold uppercase tracking-[.12em]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {t('account.confirmPassword')}
                </Label>
                <Input id="confirm" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full mt-[6px]">
                {isLoading ? t('common.saving') : t('account.changeButton')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
