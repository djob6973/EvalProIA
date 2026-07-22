import { db } from "./db";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  area_id: string | null;
  created_at: string;
  updated_at: string;
}

// Emails that are always bootstrapped as super_admin.
// Set ADMIN_EMAILS=a@corp.com,b@corp.com in the environment.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Resolves the authenticated user from the incoming request.
 *
 * On Dokku/apps.dataico.world the oauth2-proxy sets X-Forwarded-Email after
 * verifying the Google SSO cookie.  nginx strips the header from client
 * requests so it cannot be spoofed.
 *
 * In local dev (NODE_ENV !== "production") fall back to DEV_USER_EMAIL so
 * engineers can work without the proxy.
 */
export async function getAuthContext(request: Request): Promise<AuthUser | null> {
  const email =
    request.headers.get("x-forwarded-email") ??
    (process.env.NODE_ENV !== "production" ? (process.env.DEV_USER_EMAIL ?? null) : null);

  if (!email) return null;

  const displayName = email.split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  const [user] = await db`
    INSERT INTO profiles (email, full_name, role)
    VALUES (${email}, ${displayName}, ${isAdmin ? "super_admin" : "Pendiente"})
    ON CONFLICT (email) DO UPDATE SET
      full_name  = EXCLUDED.full_name,
      role       = CASE WHEN ${isAdmin} THEN 'super_admin' ELSE profiles.role END,
      updated_at = now()
    RETURNING id, email, full_name, role, area_id, created_at, updated_at
  `;

  return user as unknown as AuthUser;
}

// Mirrors UsersTab.tsx's EDITABLE_ROLES — keep both in sync. Defines which
// roles a given caller role is allowed to assign/edit/delete.
const EDITABLE_ROLES: Record<string, string[]> = {
  super_admin: ["super_admin", "admin", "supervisor", "leader", "participant", "both"],
  both:        ["super_admin", "admin", "supervisor", "leader", "participant", "both"],
  admin:       ["admin", "supervisor", "leader", "participant", "both"],
  supervisor:  ["leader", "participant"],
  leader:      ["leader", "participant"],
  participant: [],
};

export function canActOnRole(callerRole: string, targetRole: string): boolean {
  return (EDITABLE_ROLES[callerRole] ?? []).includes(targetRole);
}

// "Staff" = any role above plain participant — used to gate access to
// data (like correct answers) that must never reach someone taking an exam.
export function isStaffRole(role: string): boolean {
  return role !== "participant" && role !== "Pendiente";
}

export type PermissionLevel = "none" | "ver" | "editar" | "full";

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, ver: 1, editar: 2, full: 3 };

/**
 * Server-side counterpart to the client's useRolePermissions().getLevel().
 * role_permissions is otherwise only ever read from the browser, so any
 * endpoint that needs to enforce a minimum level (not just "is authenticated")
 * must go through this.
 */
export async function getPermissionLevel(user: AuthUser, module: string): Promise<PermissionLevel> {
  if (user.role === "super_admin") return "full";
  const role = user.role === "both" ? "admin" : user.role;
  const [row] = await db`
    SELECT level FROM role_permissions WHERE role = ${role} AND module = ${module}
  `;
  return (row?.level as PermissionLevel) ?? "none";
}

export function levelAtLeast(level: PermissionLevel, min: PermissionLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[min];
}
