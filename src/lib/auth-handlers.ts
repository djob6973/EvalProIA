import { randomBytes } from "node:crypto";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { getAuthContext } from "./server-auth";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function setCookieHeader(token: string): string {
  const exp = new Date(Date.now() + SESSION_MS).toUTCString();
  return `smartpath_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${exp}`;
}

function clearCookieHeader(): string {
  return `smartpath_session=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function handleLogin(request: Request): Promise<Response> {
  try {
    const { email, password } = await request.json();
    if (!email || !password)
      return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });

    const [user] = await db`SELECT * FROM profiles WHERE email = ${email}`;
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash))
      return Response.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
    await db`INSERT INTO sessions (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expiresAt})`;

    const { password_hash: _ph, ...profile } = user;
    return new Response(JSON.stringify({ ok: true, profile }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookieHeader(token),
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function handleSignout(request: Request): Promise<Response> {
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("smartpath_session="));
    if (match) {
      const token = decodeURIComponent(match.slice("smartpath_session=".length));
      await db`DELETE FROM sessions WHERE token = ${token}`.catch(() => {});
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookieHeader(),
    },
  });
}

export async function handleMe(request: Request): Promise<Response> {
  const user = await getAuthContext(request);
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  return Response.json(user);
}

export async function handleRegister(request: Request): Promise<Response> {
  try {
    const { email, password, fullName } = await request.json();
    if (!email || !password)
      return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    if (password.length < 6)
      return Response.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

    const [existing] = await db`SELECT id FROM profiles WHERE email = ${email}`;
    if (existing)
      return Response.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });

    const password_hash = hashPassword(password);
    const [user] = await db`
      INSERT INTO profiles (email, full_name, role, password_hash)
      VALUES (${email}, ${fullName || null}, 'participant', ${password_hash})
      RETURNING *
    `;

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
    await db`INSERT INTO sessions (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expiresAt})`;

    const { password_hash: _ph, ...profile } = user;
    return new Response(JSON.stringify({ ok: true, profile }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookieHeader(token),
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
