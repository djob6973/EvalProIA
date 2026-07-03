import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, UserPlus, RefreshCw, Edit2, Trash2, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Paginator } from "@/components/Paginator";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { areasService, Area } from "@/lib/services/evaluations";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: "super_admin" | "admin" | "supervisor" | "leader" | "participant" | "both";
  created_at: string;
  evaluation_count?: number;
  is_active?: boolean;
  area_id?: string | null;
}

function avatarInitials(u: UserProfile) {
  return (
    u.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ||
    u.email[0].toUpperCase()
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const ROLE_OPTIONS: Array<{ value: string }> = [
  { value: "super_admin" },
  { value: "admin"       },
  { value: "supervisor"  },
  { value: "leader"      },
  { value: "participant" },
];

export function UsersTab() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { hasCapability } = useRolePermissions();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "both";
  const canCreate = isAdmin || hasCapability("create_users");
  const canEdit   = isAdmin || hasCapability("edit_users");
  const canDelete = isAdmin || hasCapability("delete_users");

  // Hierarchy: which target roles the current user is allowed to act on
  const EDITABLE_ROLES: Record<string, string[]> = {
    super_admin: ["super_admin", "admin", "supervisor", "leader", "participant", "both"],
    both:        ["super_admin", "admin", "supervisor", "leader", "participant", "both"],
    admin:       ["admin", "supervisor", "leader", "participant", "both"],
    supervisor:  ["leader", "participant"],
    leader:      ["leader", "participant"],
    participant: [],
  };
  function canActOn(targetRole: string): boolean {
    const myRole = profile?.role ?? "participant";
    return (EDITABLE_ROLES[myRole] ?? []).includes(targetRole);
  }

  const [users,        setUsers]        = useState<UserProfile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterArea,   setFilterArea]   = useState("todas");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [areas,        setAreas]        = useState<Area[]>([]);
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 10;

  // ── Invite ─────────────────────────────────────────────────────────────────
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteFullName,setInviteFullName]= useState("");
  const [inviteRole,    setInviteRole]    = useState("participant");
  const [inviteAreaId,  setInviteAreaId]  = useState("");
  const [inviting,      setInviting]      = useState(false);
  const [inviteError,   setInviteError]   = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [confirmInvite, setConfirmInvite] = useState(false);

  // ── Edit ───────────────────────────────────────────────────────────────────
  const [showEdit,      setShowEdit]      = useState(false);
  const [editUser,      setEditUser]      = useState<UserProfile | null>(null);
  const [editFullName,  setEditFullName]  = useState("");
  const [editRole,      setEditRole]      = useState("participant");
  const [editAreaId,    setEditAreaId]    = useState("");
  const [editIsActive,  setEditIsActive]  = useState(true);
  const [updating,      setUpdating]      = useState(false);
  const [editError,     setEditError]     = useState<string | null>(null);
  const [confirmEdit,   setConfirmEdit]   = useState(false);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [showDelete,    setShowDelete]    = useState(false);
  const [deleteUser,    setDeleteUser]    = useState<UserProfile | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  async function fetchUsers() {
    setLoading(true);
    try {
      const r = await fetch("/api/data/profiles");
      if (!r.ok) throw new Error();
      setUsers(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchUsers();
    areasService.getAll().then(setAreas).catch(console.error);
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchArea =
      filterArea === "todas" ||
      (filterArea === "sin_area" ? !u.area_id : u.area_id === filterArea);
    const matchStatus =
      filterStatus === "todos" ||
      (filterStatus === "activo" ? u.is_active !== false : u.is_active === false);
    return matchSearch && matchArea && matchStatus;
  });
  const pagedUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Invite handlers ────────────────────────────────────────────────────────
  function openInvite() {
    setInviteEmail(""); setInviteFullName("");
    setInviteRole("participant"); setInviteAreaId("");
    setInviteError(null); setInviteSuccess(false);
    setShowInvite(true);
  }

  async function executeInvite() {
    setInviting(true);
    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, fullName: inviteFullName, role: inviteRole, areaId: inviteAreaId || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setConfirmInvite(false);
      setInviteSuccess(true);
      setTimeout(fetchUsers, 800);
    } catch (e: any) {
      setConfirmInvite(false);
      setInviteError(e.message || t('users.createError'));
    } finally { setInviting(false); }
  }

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function openEdit(u: UserProfile) {
    setEditUser(u); setEditFullName(u.full_name || "");
    setEditRole(u.role); setEditAreaId(u.area_id || "");
    setEditIsActive(u.is_active ?? true);
    setEditError(null); setShowEdit(true);
  }

  async function executeEdit() {
    if (!editUser) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/data/profiles/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: editFullName, role: editRole, area_id: editAreaId || null, is_active: editIsActive }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setConfirmEdit(false); setShowEdit(false); setEditUser(null);
      fetchUsers();
    } catch (e: any) {
      setEditError(e.message || t('users.updateError'));
    } finally { setUpdating(false); }
  }

  // ── Delete handlers ────────────────────────────────────────────────────────
  function openDelete(u: UserProfile) {
    setDeleteUser(u); setDeleteError(null); setShowDelete(true);
  }

  async function executeDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteUser.id }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setShowDelete(false); setDeleteUser(null);
      fetchUsers();
    } catch (e: any) {
      setDeleteError(e.message || t('users.deleteError'));
    } finally { setDeleting(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <input
            placeholder={t('users.searchPlaceholder')}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent hover:border-accent/50"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={filterArea}
          onChange={(e) => { setFilterArea(e.target.value); setPage(1); }}
          className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <option value="todas">Todas las áreas</option>
          <option value="sin_area">Sin área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{users.filter(u => u.is_active !== false).length}</span> {t('users.activeUsers')}
          </span>
          <button
            onClick={fetchUsers}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition"
          >
            <RefreshCw className="size-[14px]" strokeWidth={1.5} />
          </button>
          {canCreate && (
            <Button onClick={openInvite}>
              <UserPlus className="size-4" strokeWidth={1.5} />
              {t('users.newUser')}
            </Button>
          )}
        </div>
      </div>

      {/* table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">{t('users.loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[t('users.colUser'), t('users.colRole'), t('users.colArea'), t('users.colJoined'), t('users.colActions')].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((u, i) => (
                  <tr key={u.id} className={`border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--secondary)]/40 transition-colors ${i % 2 !== 0 ? "bg-[var(--secondary)]/20" : ""}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                          style={{ background: "#FBE6E6", color: "#B43C35" }}
                        >
                          {avatarInitials(u)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--foreground)]">{u.full_name || u.email}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-lg bg-black/[0.07] dark:bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                        {t(`roles.${u.role}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--muted-foreground)]">
                      {u.area_id ? (areas.find((a) => a.id === u.area_id)?.name ?? "—") : <span className="text-[var(--muted-foreground)]/40">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--muted-foreground)]">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      {(canEdit || canDelete) && canActOn(u.role) && (
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button onClick={() => openEdit(u)} title={t('users.tooltipEdit')} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition">
                              <Edit2 className="size-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                          {canDelete && u.id !== profile?.id && (
                            <button onClick={() => openDelete(u)} title={t('users.tooltipDelete')} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-destructive/10 hover:text-destructive transition">
                              <Trash2 className="size-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-[var(--muted-foreground)]">{t('users.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Paginator page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />

      {/* ── Invite modal ───────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-2xl border border-[var(--border)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('users.newUserTitle')}</h3>
              <button onClick={() => setShowInvite(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600">{t('users.createdOk')}</div>
                <Button onClick={() => setShowInvite(false)} className="w-full">{t('common.close')}</Button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (!inviteEmail || !inviteFullName) { setInviteError(t('users.fillFields')); return; } setConfirmInvite(true); }} className="space-y-4">
                {inviteError && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{inviteError}</div>}

                <Field label={t('users.nameLabel')}>
                  <Input placeholder={t('users.namePlaceholder')} value={inviteFullName} onChange={(e) => setInviteFullName(e.target.value)} disabled={inviting} />
                </Field>
                <Field label={t('users.emailLabel')}>
                  <Input type="email" placeholder={t('users.emailPlaceholder')} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={inviting} />
                </Field>
                <Field label={t('users.roleLabel')}>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={inviting} className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{t(`roles.${r.value}`)}</option>)}
                  </select>
                </Field>
                {areas.length > 0 && (
                  <Field label={t('users.areaLabel')}>
                    <select value={inviteAreaId} onChange={(e) => setInviteAreaId(e.target.value)} disabled={inviting} className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                      <option value="">{t('users.noArea')}</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </Field>
                )}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setShowInvite(false)} disabled={inviting} className="flex-1">{t('common.cancel')}</Button>
                  <Button type="submit" disabled={inviting} className="flex-1">{inviting ? t('users.creating') : t('users.createUser')}</Button>
                </div>
                <ConfirmDialog open={confirmInvite} title="¿Crear usuario?" description={t('users.confirmCreate', { email: inviteEmail, role: t(`roles.${inviteRole}`) })} confirmLabel="Crear" loading={inviting} onConfirm={executeInvite} onCancel={() => setConfirmInvite(false)} />
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {showEdit && editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-2xl border border-[var(--border)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('users.editUserTitle')}</h3>
              <button onClick={() => { setShowEdit(false); setEditUser(null); }} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setEditError(null); setConfirmEdit(true); }} className="space-y-4">
              {editError && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{editError}</div>}
              <Field label={t('users.nameLabel')}>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  disabled={updating}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
                />
              </Field>
              <Field label={t('users.roleLabel')}>
                <div className="relative">
                  <div className="pointer-events-none flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
                    <span className="text-sm">{t(`roles.${editRole}`)}</span>
                    <ChevronDown className="size-4 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                  </div>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={updating} className="absolute inset-0 w-full cursor-pointer opacity-0">
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{t(`roles.${r.value}`)}</option>)}
                  </select>
                </div>
              </Field>
              {areas.length > 0 && (
                <Field label={t('users.areaLabel')}>
                  <div className="relative">
                    <div className="pointer-devices-none flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
                      <span className="text-sm">{areas.find((a) => a.id === editAreaId)?.name || t('users.noArea')}</span>
                      <ChevronDown className="size-4 text-[var(--muted-foreground)]" strokeWidth={1.5} />
                    </div>
                    <select value={editAreaId} onChange={(e) => setEditAreaId(e.target.value)} disabled={updating} className="absolute inset-0 w-full cursor-pointer opacity-0">
                      <option value="">{t('users.noArea')}</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </Field>
              )}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('users.accountStatus')}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{editIsActive ? t('users.accountActive') : t('users.accountInactive')}</p>
                  </div>
                  <button type="button" onClick={() => setEditIsActive(!editIsActive)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${editIsActive ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
                    <span className={`inline-block size-1.5 rounded-full ${editIsActive ? "bg-emerald-500" : "bg-[var(--muted-foreground)]"}`} />
                    {editIsActive ? t('users.statusActive') : t('users.statusInactive')}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => { setShowEdit(false); setEditUser(null); }} disabled={updating} className="flex-1">{t('common.cancel')}</Button>
                <Button type="submit" disabled={updating} className="flex-1 border-0 bg-[#ED5650] text-white hover:bg-[#d94d47]">{updating ? t('common.saving') : t('common.save')}</Button>
              </div>
              <ConfirmDialog open={confirmEdit} title="¿Guardar cambios?" description={t('users.confirmEdit', { email: editUser.email })} confirmLabel="Guardar" loading={updating} onConfirm={executeEdit} onCancel={() => setConfirmEdit(false)} />
            </form>
          </div>
        </div>
      )}

      {/* ── Delete modal ───────────────────────────────────────────────────── */}
      {showDelete && deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-6 shadow-2xl border border-[var(--border)]">
            <h3 className="text-lg font-semibold">{t('users.deleteUserTitle')}</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]"
              dangerouslySetInnerHTML={{ __html: t('users.confirmDelete', { email: `<strong>${deleteUser.email}</strong>` }) }}
            />
            {deleteError && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>}
            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => { setShowDelete(false); setDeleteUser(null); }} disabled={deleting} className="flex-1">{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={executeDelete} disabled={deleting} className="flex-1">{deleting ? t('common.deleting') : t('common.delete')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</Label>
      {children}
    </div>
  );
}
