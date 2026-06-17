import { randomBytes } from "node:crypto";
import { db } from "./db";
import { hashPassword } from "./password";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function setCookieHeader(token: string): string {
  const exp = new Date(Date.now() + SESSION_MS).toUTCString();
  return `smartpath_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${exp}`;
}

export async function handleSetupCheck(_request: Request): Promise<Response> {
  // Setup is needed if no user has a password set (SSO-only accounts can't log in)
  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM profiles WHERE password_hash IS NOT NULL`;
  return Response.json({ needed: count === 0 });
}

export async function handleSetupCreate(request: Request): Promise<Response> {
  // Double-check: block if any user already has a password
  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM profiles WHERE password_hash IS NOT NULL`;
  if (count > 0) {
    return Response.json({ error: "El sistema ya está configurado. Ve al login." }, { status: 409 });
  }

  let body: { email?: string; fullName?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
  }

  const { email, fullName, password } = body;
  if (!email || !password) {
    return Response.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  const ph = hashPassword(password);
  const normalizedEmail = email.toLowerCase().trim();
  const name = fullName?.trim() || normalizedEmail.split("@")[0].replace(/[._-]+/g, " ");

  // Upsert: create if not exists, or set password + promote to admin if already exists (SSO user)
  const [profile] = await db`
    INSERT INTO profiles (email, full_name, role, password_hash)
    VALUES (${normalizedEmail}, ${name}, 'admin', ${ph})
    ON CONFLICT (email) DO UPDATE
      SET password_hash = ${ph}, role = 'admin', full_name = COALESCE(NULLIF(${name}, ''), profiles.full_name), updated_at = now()
    RETURNING id, email, full_name, role, area_id, created_at, updated_at
  `;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await db`INSERT INTO sessions (user_id, token, expires_at) VALUES (${profile.id}, ${token}, ${expiresAt})`;

  return new Response(JSON.stringify({ ok: true, profile }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setCookieHeader(token),
    },
  });
}
