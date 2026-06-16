import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";


export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Mi Cuenta — EvalPro" }] }),
  component: AccountPage,
});

function AccountPage() {
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
    if (!currentPassword) { setError("Ingresa tu contraseña actual"); return; }
    if (newPassword.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/change-own-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar contraseña');
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Error al cambiar contraseña");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell breadcrumb={[{ label: "Mi Cuenta" }]}>
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <h2 className="font-bold">Seguridad de la Cuenta</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile?.email}
            </p>
          </div>
          <div className="p-6">
            {success && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                Contraseña actualizada correctamente.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="current" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Contraseña actual
                </Label>
                <Input id="current" type="password" placeholder="••••••••"
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nueva contraseña
                </Label>
                <Input id="new" type="password" placeholder="••••••••"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Confirmar nueva contraseña
                </Label>
                <Input id="confirm" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading} />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
