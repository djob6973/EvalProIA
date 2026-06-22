import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings, invalidateSystemSettings } from "@/hooks/useSystemSettings";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, Paintbrush } from "lucide-react";

export const Route = createFileRoute("/config")({
  head: () => ({ meta: [{ title: "Configuración — EvalPro" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "both";
  const navigate = useNavigate();
  const { settings } = useSystemSettings();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLogo = settings.brand_logo ?? null;
  const displayLogo = logoPreview ?? currentLogo;

  useEffect(() => {
    if (profile && !isAdmin) navigate({ to: "/account" });
  }, [profile, isAdmin, navigate]);

  function processFile(file: File) {
    setLogoError(null);
    setLogoSuccess(false);

    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type))
      return setLogoError("Solo se aceptan imágenes PNG, JPG o SVG.");

    if (file.size > 500_000)
      return setLogoError("La imagen no debe superar 500 KB.");

    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function saveLogo() {
    if (!logoPreview) return;
    setLogoSaving(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: logoPreview }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      invalidateSystemSettings();
      setLogoSuccess(true);
      setLogoPreview(null);
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setLogoSaving(false);
    }
  }

  async function deleteLogo() {
    setLogoSaving(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/data/settings/brand-logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      invalidateSystemSettings();
      setLogoPreview(null);
      setLogoSuccess(false);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setLogoSaving(false);
    }
  }

  return (
    <AppShell breadcrumb={[{ label: "Herramientas" }, { label: "Configuración" }]}>
      <div className="max-w-2xl space-y-6">
        {/* ── Identidad visual ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
            >
              <Paintbrush className="size-[16px]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Identidad visual</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                El logo aparecerá en el menú lateral del sistema
              </p>
            </div>
          </div>

          {/* Upload zone */}
          <div className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileInput}
            />

            <div
              onClick={() => !logoSaving && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-150 ${
                isDragging
                  ? "border-[var(--sidebar-primary)] bg-[rgba(237,86,80,0.06)]"
                  : "border-[var(--border-strong)] bg-[var(--secondary)]/40 hover:border-[var(--sidebar-primary)] hover:bg-[rgba(237,86,80,0.04)]"
              }`}
            >
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt="Logo organización"
                  className="max-h-24 max-w-[280px] object-contain"
                />
              ) : (
                <>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <ImageIcon className="size-6 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Haz clic para seleccionar imagen
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      PNG, JPG, SVG · máx 500 KB
                    </p>
                  </div>
                </>
              )}

              {logoPreview && (
                <div className="absolute bottom-3 right-3 rounded-md bg-[var(--card)] px-2 py-1 text-[10px] font-semibold text-[var(--muted-foreground)] shadow border border-[var(--border)]">
                  Vista previa
                </div>
              )}
            </div>

            {/* Error / success */}
            {logoError && (
              <p className="mt-3 text-xs text-destructive">{logoError}</p>
            )}
            {logoSuccess && !logoPreview && (
              <p className="mt-3 text-xs text-emerald-600">Logo guardado correctamente.</p>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoSaving}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)] disabled:opacity-50"
              >
                <Upload className="size-4" strokeWidth={1.5} />
                Seleccionar logo
              </button>

              {logoPreview && (
                <button
                  onClick={saveLogo}
                  disabled={logoSaving}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(180deg, rgba(237,86,80,0.95), #B43C35)" }}
                >
                  {logoSaving ? "Guardando…" : "Guardar logo"}
                </button>
              )}

              {logoPreview && (
                <button
                  onClick={() => { setLogoPreview(null); setLogoError(null); }}
                  disabled={logoSaving}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)] disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}

              {currentLogo && !logoPreview && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={logoSaving}
                  className="ml-auto rounded-xl px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                >
                  Eliminar logo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="¿Eliminar logo de la organización?"
        description="Se eliminará el logo de marca del sistema. El logo de EvalPro permanecerá intacto."
        confirmLabel="Eliminar"
        onConfirm={deleteLogo}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </AppShell>
  );
}
