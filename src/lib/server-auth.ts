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
