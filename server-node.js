import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { Readable } from 'stream';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load .env for local dev — Node.js 20.6+ built-in, no package needed.
// No-op when .env is absent (Dokku injects vars via the environment).
try { process.loadEnvFile(); } catch {}

const handler = (await import('./dist/server/server.js')).default;
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const port = process.env.PORT || 3000;

const mimeTypes = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Configuración del servidor incompleta: faltan SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAdminCaller(adminClient, token) {
  const { data: { user }, error } = await adminClient.auth.getUser(token);
  if (error || !user) throw new Error('No autorizado');
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'both'].includes(profile.role)) {
    throw new Error('No autorizado: se requiere rol de administrador');
  }
  return user;
}

function jsonOk(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res, message, status = 400) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ── Health check (must come before HTTPS redirect so Dokku can probe it) ─
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // ── HTTPS redirect in production (nginx sets X-Forwarded-Proto: http) ───
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
      res.end();
      return;
    }

    // ── Static files ────────────────────────────────────────────────────────
    if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      const filePath = join(__dirname, 'dist/client', url.pathname);
      const ext = extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      try {
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
        return;
      } catch {
        // fall through to SSR handler
      }
    }

    // ── Read body once for all POST routes ──────────────────────────────────
    let bodyBuffer;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (chunks.length > 0) bodyBuffer = Buffer.concat(chunks);
    }

    // ── Direct API: create user ──────────────────────────────────────────────
    if (url.pathname === '/api/create-user' && req.method === 'POST') {
      try {
        const body = JSON.parse(bodyBuffer?.toString() || '{}');
        const adminClient = getAdminClient();
        await verifyAdminCaller(adminClient, body._token);

        const { data: result, error } = await adminClient.auth.admin.createUser({
          email: body.email,
          password: body.password,
          user_metadata: { full_name: body.fullName, role: body.role, area_id: body.areaId },
          email_confirm: true,
        });
        if (error) throw new Error(error.message);

        const { error: profileError } = await adminClient.from('profiles').upsert({
          id: result.user.id,
          email: body.email,
          full_name: body.fullName,
          role: body.role,
          area_id: body.areaId ?? null,
        });
        if (profileError) throw new Error(profileError.message);

        jsonOk(res, { id: result.user.id, email: result.user.email });
      } catch (err) {
        jsonError(res, err.message);
      }
      return;
    }

    // ── Direct API: change password ─────────────────────────────────────────
    if (url.pathname === '/api/change-password' && req.method === 'POST') {
      try {
        const body = JSON.parse(bodyBuffer?.toString() || '{}');
        const adminClient = getAdminClient();

        // Verify caller identity via JWT
        const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(body._token);
        if (authError || !caller) throw new Error('No autorizado');

        if (!body.newPassword || body.newPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

        const isOwnPassword = body.userId === caller.id;

        if (isOwnPassword) {
          // Self-service: verify current password before updating
          if (!body.currentPassword) throw new Error('Se requiere la contraseña actual');
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
          const regularClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
          const { error: signInError } = await regularClient.auth.signInWithPassword({ email: caller.email, password: body.currentPassword });
          if (signInError) throw new Error('La contraseña actual es incorrecta');
        } else {
          // Admin changing another user's password
          const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single();
          if (!callerProfile || !['admin', 'both'].includes(callerProfile.role)) throw new Error('No autorizado: se requiere rol de administrador');
        }

        const { error } = await adminClient.auth.admin.updateUserById(body.userId, { password: body.newPassword });
        if (error) throw new Error(error.message);

        jsonOk(res, { success: true });
      } catch (err) {
        jsonError(res, err.message);
      }
      return;
    }

    // ── Direct API: delete user ──────────────────────────────────────────────
    if (url.pathname === '/api/delete-user' && req.method === 'POST') {
      try {
        const body = JSON.parse(bodyBuffer?.toString() || '{}');
        const adminClient = getAdminClient();
        const caller = await verifyAdminCaller(adminClient, body._token);

        if (body.userId === caller.id) throw new Error('No puedes eliminar tu propia cuenta');

        const { error } = await adminClient.auth.admin.deleteUser(body.userId);
        if (error) throw new Error(error.message);

        jsonOk(res, { success: true });
      } catch (err) {
        jsonError(res, err.message);
      }
      return;
    }

    // ── TanStack Start SSR handler ───────────────────────────────────────────
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: bodyBuffer || undefined,
    });

    const response = await handler.fetch(request, process.env, {});

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
