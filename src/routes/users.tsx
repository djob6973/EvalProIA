import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, X, Edit2, Trash2, KeyRound, ChevronDown } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { areasService, Area } from "@/lib/services/evaluations";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Usuarios — EvalPro" }] }),
  component: UsersPage,
});

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'participant' | 'both';
  created_at: string;
  evaluation_count?: number;
  is_active?: boolean;
  area_id?: string | null;
}

function UsersPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'both';
  const navigate = useNavigate();

  // Redirigir a participantes a /participant solo si el perfil está cargado
  useEffect(() => {
    if (profile && !isAdmin) {
      navigate({ to: "/participant" });
    }
  }, [profile, isAdmin, navigate]);
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'participant' | 'both'>('participant');
  const [inviteFullName, setInviteFullName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<'admin' | 'participant' | 'both'>('participant');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  const [areas, setAreas] = useState<Area[]>([]);
  const [inviteAreaId, setInviteAreaId] = useState<string>("");
  const [editAreaId, setEditAreaId] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    fetchUsers();
    areasService.getAll().then(setAreas).catch(console.error);
  }, []);

  const fetchUsers = async () => {
    try {
      const r = await fetch('/api/data/profiles');
      if (!r.ok) throw new Error('Error al cargar usuarios');
      const data = await r.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (!inviteEmail || !inviteFullName || !invitePassword) {
      setInviteError("Por favor, completa todos los campos");
      return;
    }

    setShowInviteConfirm(true);
  };

  const executeInvite = async () => {
    setIsInviting(true);
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          fullName: inviteFullName,
          role: inviteRole,
          areaId: inviteAreaId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear usuario');
      }

      setShowInviteConfirm(false);
      setInviteSuccess(true);
      setInviteEmail("");
      setInviteFullName("");
      setInvitePassword("");
      setInviteRole('participant');

      setTimeout(() => { fetchUsers(); }, 1000);
    } catch (error: any) {
      setShowInviteConfirm(false);
      setInviteError(error.message || "Error al crear usuario");
    } finally {
      setIsInviting(false);
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteFullName("");
    setInvitePassword("");
    setInviteRole('participant');
    setInviteAreaId("");
    setInviteError(null);
    setInviteSuccess(false);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
    setEditRole(user.role);
    setEditAreaId(user.area_id || "");
    setEditIsActive(user.is_active ?? true);
    setShowEditModal(true);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    if (!editingUser) return;
    setShowUpdateConfirm(true);
  };

  const executeUpdateUser = async () => {
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/data/profiles/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: editFullName, role: editRole, area_id: editAreaId || null, is_active: editIsActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar usuario');
      }

      setShowUpdateConfirm(false);
      setShowEditModal(false);
      setEditingUser(null);
      setUpdateError(null);
      fetchUsers();
    } catch (error: any) {
      setUpdateError(error.message || "Error al actualizar usuario");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = (user: UserProfile) => {
    setPasswordUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowPasswordModal(true);
  };

  const executeChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 6) { setPasswordError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Las contraseñas no coinciden"); return; }
    if (!passwordUser) return;

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passwordUser.id, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar contraseña');
      }
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Error al cambiar contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteUser = (user: UserProfile) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deletingUser.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar usuario');
      }

      setShowDeleteModal(false);
      setDeletingUser(null);
      setDeleteError(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setDeleteError(error.message || "Error al eliminar usuario");
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <AppShell>
      <PageHeader
        title="Usuarios"
        actions={isAdmin ? <Button onClick={() => setShowInviteModal(true)}><Plus className="size-4" /> Invitar Usuario</Button> : undefined}
      />
      <div className="space-y-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar usuarios…"
            className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Cargando usuarios...
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">Rol</th>
                  {areas.length > 0 && <th className="px-6 py-3">Área</th>}
                  <th className="px-6 py-3">Evaluaciones</th>
                  <th className="px-6 py-3">Ingreso</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full font-mono text-[10px] font-bold text-white" style={{ background: "#333333" }}>
                          {u.full_name
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("") || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.full_name || u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          u.role === "admin"
                            ? "bg-accent/10 text-accent"
                            : u.role === "both"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {u.role === "admin" ? "Administrador" : u.role === "both" ? "Admin + Part." : "Participante"}
                      </span>
                    </td>
                    {areas.length > 0 && (
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {u.area_id
                          ? areas.find((a) => a.id === u.area_id)?.name ?? "—"
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    )}
                    <td className="px-6 py-4 font-mono text-muted-foreground">{u.evaluation_count || 0}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditUser(u)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                            title="Editar usuario"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleChangePassword(u)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                            title="Cambiar contraseña"
                          >
                            <KeyRound className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Invitar Usuario</h3>
              <button
                onClick={closeInviteModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                  Usuario invitado exitosamente. Se ha enviado un email de invitación.
                </div>
                <Button onClick={closeInviteModal} className="w-full">
                  Cerrar
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                {inviteError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {inviteError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="invite-fullname" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre Completo
                  </Label>
                  <Input
                    id="invite-fullname"
                    type="text"
                    placeholder="Juan Pérez"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    disabled={isInviting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="juan@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contraseña
                  </Label>
                  <Input
                    id="invite-password"
                    type="password"
                    placeholder="••••••••"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    disabled={isInviting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Rol
                  </Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'participant' | 'both')}
                    disabled={isInviting}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  >
                    <option value="participant">Participante</option>
                    <option value="admin">Administrador</option>
                    <option value="both">Administrador + Participante</option>
                  </select>
                </div>

                {areas.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-area" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Área
                    </Label>
                    <select
                      id="invite-area"
                      value={inviteAreaId}
                      onChange={(e) => setInviteAreaId(e.target.value)}
                      disabled={isInviting}
                      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeInviteModal}
                    disabled={isInviting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isInviting} className="flex-1">
                    {isInviting ? "Invitando..." : "Invitar"}
                  </Button>
                </div>

                <ConfirmDialog
                  open={showInviteConfirm}
                  title="¿Registrar nuevo usuario?"
                  description={`Se enviará una invitación a "${inviteEmail}" con el rol ${inviteRole === 'admin' ? 'Administrador' : 'Participante'}.`}
                  confirmLabel="Registrar"
                  loading={isInviting}
                  onConfirm={executeInvite}
                  onCancel={() => setShowInviteConfirm(false)}
                />
              </form>
            )}
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar Usuario</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              {updateError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {updateError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-fullname" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nombre Completo
                </Label>
                <Input
                  id="edit-fullname"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  disabled={isUpdating}
                />
              </div>

              {isAdmin && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Rol
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none flex items-center justify-between rounded-lg border border-input bg-secondary px-3 py-2.5">
                      <span className={
                        editRole === 'admin'
                          ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400"
                          : editRole === 'both'
                          ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-violet-500/15 text-violet-400"
                          : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-sky-500/15 text-sky-400"
                      }>
                        {editRole === 'admin' ? 'Administrador' : editRole === 'both' ? 'Admin + Participante' : 'Participante'}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </div>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'admin' | 'participant' | 'both')}
                      disabled={isUpdating}
                      className="absolute inset-0 w-full cursor-pointer opacity-0"
                    >
                      <option value="participant">Participante</option>
                      <option value="admin">Administrador</option>
                      <option value="both">Administrador + Participante</option>
                    </select>
                  </div>
                </div>
              )}

              {areas.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Área
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none flex items-center justify-between rounded-lg border border-input bg-secondary px-3 py-2.5">
                      <span className="text-sm">
                        {areas.find((a) => a.id === editAreaId)?.name || 'Sin área'}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </div>
                    <select
                      value={editAreaId}
                      onChange={(e) => setEditAreaId(e.target.value)}
                      disabled={isUpdating}
                      className="absolute inset-0 w-full cursor-pointer opacity-0"
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-input bg-secondary px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Estado de la cuenta</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {editIsActive ? 'El usuario puede iniciar sesión' : 'El usuario no puede iniciar sesión'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(!editIsActive)}
                    disabled={isUpdating}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      editIsActive
                        ? 'bg-green-500/15 text-green-500'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className={`inline-block size-1.5 rounded-full ${editIsActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    {editIsActive ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 border-0 bg-[#ED5650] text-white hover:bg-[#d94d47]"
                >
                  {isUpdating ? "Guardando..." : "Guardar"}
                </Button>
              </div>

              <ConfirmDialog
                open={showUpdateConfirm}
                title="¿Guardar cambios?"
                description={`Confirma que deseas actualizar los datos de "${editingUser?.email}".`}
                confirmLabel="Guardar cambios"
                loading={isUpdating}
                onConfirm={executeUpdateUser}
                onCancel={() => setShowUpdateConfirm(false)}
              />
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Cambiar Contraseña</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{passwordUser.email}</p>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                  Contraseña actualizada correctamente.
                </div>
                <Button onClick={() => setShowPasswordModal(false)} className="w-full">Cerrar</Button>
              </div>
            ) : (
              <form onSubmit={executeChangePassword} className="space-y-4">
                {passwordError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{passwordError}</div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nueva contraseña
                  </Label>
                  <Input id="new-password" type="password" placeholder="••••••••" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} disabled={isChangingPassword} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Confirmar contraseña
                  </Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} disabled={isChangingPassword} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowPasswordModal(false)}
                    disabled={isChangingPassword} className="flex-1">Cancelar</Button>
                  <Button type="submit" disabled={isChangingPassword} className="flex-1">
                    {isChangingPassword ? "Guardando..." : "Cambiar contraseña"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Eliminar Usuario</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Estás seguro de que deseas eliminar al usuario <strong>{deletingUser.email}</strong>? Esta acción no se puede deshacer.
              </p>
              {deleteError && (
                <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
