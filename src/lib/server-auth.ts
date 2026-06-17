import { db } from "./db";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "participant" | "both";
  area_id: string | null;
  created_at: string;
  updated_at: string;
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const entry = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

async function getOrProvision(email: string): Promise<AuthUser> {
  const rows = await db`
    SELECT id, email, full_name, role, area_id, created_at, updated_at
    FROM profiles WHERE email = ${email}
  `;
  if (rows.length > 0) return rows[0] as unknown as AuthUser;

  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM profiles`;
  const role = count === 0 ? "admin" : "participant";
  const full_name = email.split("@")[0].replace(/[._-]+/g, " ");

  const [profile] = await db`
    INSERT INTO profiles (email, full_name, role)
    VALUES (${email}, ${full_name}, ${role})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, email, full_name, role, area_id, created_at, updated_at
  `;
  return profile as unknown as AuthUser;
}

export async function getAuthContext(
  request: Request
): Promise<AuthUser | null> {
  // 1. Google SSO via oauth2-proxy — only trusted when explicitly enabled.
  // Without this gate any client could spoof x-forwarded-email and bypass auth.
  if (process.env.TRUST_FORWARDED_EMAIL === "true") {
    const forwarded = request.headers.get("x-forwarded-email");
    if (forwarded) return getOrProvision(forwarded);
  }

  // 2. Local dev shortcut — disabled in production so it never blocks signout.
  if (process.env.NODE_ENV !== "production") {
    const devEmail = process.env.DEV_USER_EMAIL;
    if (devEmail) return getOrProvision(devEmail);
  }

  // 3. Cookie-based session
  const token = parseCookie(
    request.headers.get("cookie"),
    "smartpath_session"
  );
  if (!token) return null;

  const rows = await db`
    SELECT p.id, p.email, p.full_name, p.role, p.area_id, p.created_at, p.updated_at
    FROM sessions s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
  `;
  return rows.length > 0 ? (rows[0] as unknown as AuthUser) : null;
}
