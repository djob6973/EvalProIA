import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { runMigrations } from "./lib/migrate";
import { handleLogin, handleSignout, handleMe } from "./lib/auth-handlers";
import { handleSetupCheck, handleSetupCreate } from "./lib/setup-handler";
import { handleApiRequest } from "./lib/api-handlers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
// Migrations run once on first request; subsequent calls resolve immediately.
const migrationPromise = runMigrations().catch((err) => {
  console.error("[migrate] Error al ejecutar migraciones:", err);
});

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    await migrationPromise;

    try {
      const url = new URL(request.url);
      const { pathname } = url;

      // ── First-run setup (no auth required) ────────────────────────────
      if (pathname === "/api/setup" && request.method === "GET")
        return handleSetupCheck(request);
      if (pathname === "/api/setup" && request.method === "POST")
        return handleSetupCreate(request);

      // ── Auth routes (intercepted before TanStack Start) ────────────────
      if (pathname === "/api/auth/login" && request.method === "POST")
        return handleLogin(request);
      if (pathname === "/api/auth/signout")
        return handleSignout(request);
      if (pathname === "/api/me")
        return handleMe(request);

      // ── Data API routes ────────────────────────────────────────────────
      if (pathname.startsWith("/api/")) {
        const apiResponse = await handleApiRequest(request, pathname, url);
        if (apiResponse) return apiResponse;
      }

      // ── TanStack Start (SSR + SPA) ─────────────────────────────────────
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
