import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Plus, Edit2, Trash2, X, Save, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { areasService, Area } from "@/lib/services/evaluations";

export const Route = createFileRoute("/areas")({
  head: () => ({ meta: [{ title: "Áreas — EvalPro" }] }),
  component: AreasPage,
});

function AreasPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile ? profile.role !== 'participant' : false;
  const { canAccess, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { navigate({ to: "/participant" }); return; }
    if (!permLoading && !canAccess('areas')) navigate({ to: "/dashboard" });
  }, [profile, isAdmin, permLoading, canAccess, navigate]);

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingArea, setDeletingArea] = useState<Area | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const data = await areasService.getAll();
      setAreas(data);
    } catch (err) {
      console.error("Error fetching areas:", err);
      showToast(t('areas.loadError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (area: Area) => {
    setEditing(area);
    setFormName(area.name);
    setFormDesc(area.description || "");
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    setShowSaveConfirm(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (editing) {
        const updated = await areasService.update(editing.id, {
          name: formName.trim(),
          description: formDesc.trim() || null,
        });
        setAreas((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
        showToast(t('areas.updated'));
      } else {
        const created = await areasService.create({
          name: formName.trim(),
          description: formDesc.trim() || null,
        });
        setAreas((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        showToast(t('areas.created'));
      }
      setShowModal(false);
      setShowSaveConfirm(false);
    } catch (err: any) {
      setFormError(err.message || t('areas.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (area: Area) => {
    setDeletingArea(area);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingArea) return;
    setIsDeleting(true);
    try {
      await areasService.delete(deletingArea.id);
      setAreas((prev) => prev.filter((a) => a.id !== deletingArea.id));
      showToast(t('areas.deleted'));
      setShowDeleteModal(false);
      setDeletingArea(null);
    } catch (err: any) {
      showToast(err.message || t('areas.deleteError'), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Áreas"
        actions={isAdmin ? <Button onClick={openCreate}><Plus className="size-4" /> {t('areas.newArea')}</Button> : undefined}
      />
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "error"
              ? "bg-destructive text-destructive-foreground"
              : "bg-emerald-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {t('areas.loading')}
          </div>
        ) : areas.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Layers className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t('areas.emptyState')}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-3">{t('areas.colName')}</th>
                  <th className="px-6 py-3">{t('areas.colDescription')}</th>
                  <th className="px-6 py-3">{t('areas.colCreated')}</th>
                  <th className="px-6 py-3">{t('areas.colActions')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {areas.map((area) => (
                  <tr
                    key={area.id}
                    className="border-b border-border/50 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-6 py-4 font-medium">{area.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {area.description || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(area.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(area)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          title={t('areas.editArea')}
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(area)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title={t('areas.deleteArea')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing ? t('areas.editTitle') : t('areas.newArea')}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('areas.nameLabel')}
                </Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('areas.namePlaceholder')}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('common.description')}
                </Label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={t('areas.descPlaceholder')}
                  disabled={isSaving}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1">
                  <Save className="size-4" />
                  {editing ? t('common.update') : t('common.create')}
                </Button>
              </div>

              <ConfirmDialog
                open={showSaveConfirm}
                title={editing ? t('areas.confirmUpdate') : t('areas.confirmCreate')}
                description={
                  editing
                    ? t('areas.confirmUpdateDesc', { name: formName })
                    : t('areas.confirmCreateDesc', { name: formName })
                }
                confirmLabel={editing ? t('common.update') : t('common.create')}
                loading={isSaving}
                onConfirm={executeSave}
                onCancel={() => setShowSaveConfirm(false)}
              />
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deletingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{t('areas.deleteTitle')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('areas.deleteConfirm', { name: deletingArea.name })}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingArea(null);
                }}
                disabled={isDeleting}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? t('common.deleting') : t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
