import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { Readable } from 'stream';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

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
