import { db } from "./db";
import { getAuthContext, AuthUser, getPermissionLevel, levelAtLeast } from "./server-auth";
import { normalizeResultFeedback, generateForoArticuloServer } from "./services/openai-server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function auth(request: Request): Promise<AuthUser | null> {
  return getAuthContext(request);
}

async function requireAuth(request: Request): Promise<AuthUser | Response> {
  const user = await auth(request);
  if (!user) return json({ error: "No autenticado" }, 401);
  return user;
}

async function requireAdmin(request: Request): Promise<AuthUser | Response> {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role === "participant" || user.role === "Pendiente")
    return json({ error: "Se requieren permisos de administrador" }, 403);
  return user;
}

// ── Main router ───────────────────────────────────────────────────────────────

export async function handleApiRequest(
  request: Request,
  pathname: string,
  url: URL
): Promise<Response | null> {
  try {
    return await route(request, pathname, url);
  } catch (err: any) {
    console.error("[API]", err);
    return json({ error: err.message || "Error interno" }, 500);
  }
}

async function route(
  request: Request,
  pathname: string,
  url: URL
): Promise<Response | null> {
  const m = request.method;
  const p = pathname.split("/").filter(Boolean);
  if (p[0] !== "api") return null;

  const [, sub, res, id, sub2] = p;

  // ── Identity (SSO — header-based) ────────────────────────────────────────
  if (sub === "me" && m === "GET") {
    const user = await auth(request);
    if (!user) return json({ error: "No autenticado" }, 401);
    return json(user);
  }

  // ── User management ──────────────────────────────────────────────────────
  if (sub === "self-activate" && m === "POST") return selfActivate(request);
  if (sub === "create-user" && m === "POST") return createUser(request);
  if (sub === "delete-user" && m === "POST") return deleteUser(request);

  if (sub !== "data") return null;

  // ── Evaluations ──────────────────────────────────────────────────────────
  if (res === "evaluations") {
    if (!id) {
      if (m === "GET") return listEvaluations();
      if (m === "POST") return createEvaluation(request);
    }
    if (id === "active" && m === "GET") return activeEvaluations();
    if (id && !sub2) {
      if (m === "GET") return getEvaluation(id);
      if (m === "PUT") return updateEvaluation(request, id);
      if (m === "DELETE") return deleteEvaluation(request, id);
    }
    if (id && sub2 === "with-questions" && m === "GET")
      return evalWithQuestions(id);
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  if (res === "questions") {
    if (!id) {
      if (m === "GET") return listQuestions();
      if (m === "POST") return createQuestion(request);
    }
    if (id === "batch" && m === "POST") return createQuestionsBatch(request);
    if (id === "by-ids" && m === "GET") return questionsByIds(url);
    if (id === "filtered" && m === "GET") return questionsFiltered(url);
    if (id === "by-evaluation" && sub2 && m === "GET")
      return questionsByEval(sub2);
    if (id && !sub2) {
      if (m === "PUT") return updateQuestion(request, id);
      if (m === "DELETE") return deleteQuestion(request, id);
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (res === "results") {
    if (!id) {
      if (m === "GET") return listResults();
      if (m === "POST") return createResult(request);
    }
    if (id === "by-user" && sub2 && m === "GET") return resultsByUser(sub2);
    if (id === "by-evaluation" && sub2 && m === "GET")
      return resultsByEval(sub2);
    if (id === "count" && !sub2 && m === "GET") return getResultCount(url);
    if (id && sub2 === "feedback" && m === "POST") return submitResultFeedback(request, id);
    if (id && !sub2 && m === "GET") return getResult(id);
  }

  // ── Areas ─────────────────────────────────────────────────────────────────
  if (res === "areas") {
    if (!id) {
      if (m === "GET") return listAreas();
      if (m === "POST") return createArea(request);
    }
    if (id && !sub2) {
      if (m === "PUT") return updateArea(request, id);
      if (m === "DELETE") return deleteArea(request, id);
    }
  }

  // ── Participants ──────────────────────────────────────────────────────────
  if (res === "participants" && !id && m === "GET") return listParticipants();

  // ── Evaluation participants ───────────────────────────────────────────────
  if (res === "eval-participants") {
    if (!id) {
      if (m === "POST") return assignParticipant(request);
      if (m === "DELETE") return unassignParticipant(request);
    }
    if (id === "by-user" && sub2 && m === "GET")
      return evalParticipantsByUser(sub2);
    if (id && !sub2 && m === "GET") return evalParticipantsByEval(id);
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  if (res === "progress") {
    if (!id) {
      if (m === "POST") return createProgress(request);
      if (m === "PUT") return updateProgress(request);
      if (m === "DELETE") return deleteProgress(request);
    }
    if (id && sub2 && m === "GET") return getProgress(id, sub2);
  }

  // ── Temporary diagnostic endpoint (remove after use) ─────────────────────
  if (sub === "diag" && m === "GET") {
    const key = url.searchParams.get("key");
    if (key !== "DATAICO_DIAG_2026") return json({ error: "Forbidden" }, 403);
    const evalId = url.searchParams.get("eval");
    if (!evalId) return json({ error: "eval param required" }, 400);
    const results = await db`
      SELECT r.id, r.score, r.answers, r.completed_at,
             p.full_name, p.email,
             (SELECT COUNT(*) FROM jsonb_object_keys(r.answers)) AS answered_count
      FROM results r
      LEFT JOIN profiles p ON p.id = r.user_id
      WHERE r.evaluation_id = ${evalId}
      ORDER BY r.score DESC
    `;
    const questions = await db`
      SELECT q.id, q.question_text, q.correct_answer,
             array_length(string_to_array(q.correct_answer, ','), 1) AS correct_count
      FROM questions q
      WHERE q.evaluation_id = ${evalId}
      ORDER BY q.created_at
    `;
    return json({ results, questions });
  }

  // ── System settings ──────────────────────────────────────────────────────
  if (res === "settings") {
    if (!id && m === "GET") return getSettings();
    if (id === "brand-logo" && m === "POST") return setBrandLogo(request);
    if (id === "brand-logo" && m === "DELETE") return deleteBrandLogo(request);
  }

  // ── Etiquetas ─────────────────────────────────────────────────────────────
  if (res === "etiquetas") {
    if (!id && m === "GET") return listEtiquetas();
    if (!id && m === "POST") return createEtiqueta(request);
  }

  // ── Categories ────────────────────────────────────────────────────────────
  if (res === "categories" && !id && m === "GET") return listCategories();

  // ── Question areas (distinct 'area' values on questions, not the org 'areas' table) ──
  if (res === "question-areas" && !id && m === "GET") return listQuestionAreas();

  // ── Notifications ─────────────────────────────────────────────────────────
  if (res === "notifications") {
    if (!id && m === "GET") return getNotifications(request);
    if (id === "read-all" && m === "POST") return markAllNotificationsRead(request);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (res === "stats") {
    if (id === "dashboard" && m === "GET") return dashboardStats();
    if (id === "activity" && m === "GET") return activityFeed(url);
  }

  // ── Profiles (users admin page) ───────────────────────────────────────────
  if (res === "profiles") {
    if (!id && m === "GET") return listProfiles(request);
    if (id && m === "PUT") return updateProfileById(request, id);
  }

  // ── Role permissions ───────────────────────────────────────────────────────
  if (res === "role-permissions") {
    if (!id && m === "GET") return getRolePermissions(request);
    if (!id && m === "PUT") return setRolePermissions(request);
  }

  // ── Foro ──────────────────────────────────────────────────────────────────
  if (res === "foro-articulos") {
    if (!id) {
      if (m === "GET") return listForoArticulos(request, url);
      if (m === "POST") return createForoArticulo(request);
    }
    if (id && !sub2) {
      if (m === "GET") return getForoArticulo(request, id);
      if (m === "PUT") return updateForoArticulo(request, id);
      if (m === "DELETE") return deleteForoArticulo(request, id);
    }
  }

  if (res === "foro-comentarios") {
    if (!id && m === "POST") return createForoComentario(request);
    if (id === "by-articulo" && sub2 && m === "GET")
      return foroComentariosByArticulo(request, sub2);
    if (id && sub2 === "like" && m === "POST") return toggleForoLike(request, id);
    if (id && !sub2) {
      if (m === "PUT") return updateForoComentario(request, id);
      if (m === "DELETE") return deleteForoComentario(request, id);
    }
  }

  return null;
}

// ── Evaluations handlers ──────────────────────────────────────────────────────

// Genera o actualiza (mientras siga en borrador) el artículo del Foro asociado al documento
// de referencia de una evaluación. Nunca modifica un artículo ya publicado.
async function syncForoArticuloFromEvaluation(
  evaluationId: string,
  documentoTexto: string | null | undefined,
  idioma: string,
  autorId: string,
): Promise<{ status: "created" | "updated" | "skipped"; error?: string }> {
  if (!documentoTexto || !documentoTexto.trim()) return { status: "skipped" };

  const [existing] = await db`SELECT id, estado FROM foro_articulos WHERE evaluation_id = ${evaluationId}`;
  if (existing?.estado === "publicado") return { status: "skipped" };

  try {
    const generated = await generateForoArticuloServer(documentoTexto, idioma);
    if (existing) {
      await db`
        UPDATE foro_articulos SET
          titulo = ${generated.titulo},
          contenido = ${generated.contenido},
          resumen = ${generated.resumen || null},
          categoria = ${generated.categoria_sugerida || null},
          etiquetas = ${db.json(generated.etiquetas_sugeridas ?? [])},
          updated_at = now()
        WHERE id = ${existing.id}
      `;
      return { status: "updated" };
    }
    await db`
      INSERT INTO foro_articulos
        (titulo, contenido, resumen, autor_id, categoria, etiquetas, estado, origen, evaluation_id)
      VALUES
        (${generated.titulo}, ${generated.contenido}, ${generated.resumen || null}, ${autorId},
         ${generated.categoria_sugerida || null}, ${db.json(generated.etiquetas_sugeridas ?? [])},
         'borrador', 'ia', ${evaluationId})
    `;
    return { status: "created" };
  } catch (err) {
    console.error("Error generating Foro article from evaluation document:", err);
    return { status: "skipped", error: (err as Error).message };
  }
}

async function publishForoArticuloIfDeactivated(evaluationId: string): Promise<void> {
  await db`
    UPDATE foro_articulos SET estado = 'publicado', published_at = now()
    WHERE evaluation_id = ${evaluationId} AND estado = 'borrador'
  `;
}

async function listEvaluations(): Promise<Response> {
  const rows = await db`
    SELECT id, title, description, created_by, area_id, activa, tiempo_limite, intentos_permitidos,
           categorias, config, fecha_vencimiento, created_at, updated_at,
           feedback_trigger, feedback_documento_nombre, etiqueta_id
    FROM evaluations ORDER BY created_at DESC
  `;
  return json(rows.map(parseEvaluation));
}

async function activeEvaluations(): Promise<Response> {
  const rows = await db`
    SELECT id, title, description, created_by, area_id, activa, tiempo_limite, intentos_permitidos,
           categorias, config, fecha_vencimiento, created_at, updated_at,
           feedback_trigger, feedback_documento_nombre, etiqueta_id
    FROM evaluations
    WHERE activa = true
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento > now())
    ORDER BY created_at DESC
  `;
  return json(rows.map(parseEvaluation));
}

async function getEvaluation(id: string): Promise<Response> {
  const [row] = await db`
    SELECT e.*,
      (SELECT fa.id FROM foro_articulos fa
       WHERE fa.evaluation_id = e.id AND fa.estado = 'publicado' LIMIT 1) AS foro_articulo_id
    FROM evaluations e WHERE e.id = ${id}
  `;
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(parseEvaluation(row));
}

async function createEvaluation(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const {
    title, description, created_by, area_id, activa,
    tiempo_limite, intentos_permitidos, categorias, config, fecha_vencimiento,
    feedback_trigger, feedback_documento_texto, feedback_documento_nombre, feedback_documento_idioma,
    etiqueta_id,
  } = body;

  const feedbackTriggerFinal = ["ninguno", "al_finalizar", "inactiva"].includes(feedback_trigger)
    ? feedback_trigger
    : "ninguno";

  const [row] = await db`
    INSERT INTO evaluations
      (title, description, created_by, area_id, activa, tiempo_limite,
       intentos_permitidos, categorias, config, fecha_vencimiento,
       feedback_trigger, feedback_documento_texto, feedback_documento_nombre, etiqueta_id)
    VALUES
      (${title}, ${description ?? null}, ${created_by ?? null}, ${area_id ?? null},
       ${activa ?? true}, ${tiempo_limite ?? null}, ${intentos_permitidos ?? 1},
       ${db.json(categorias ?? [])}, ${db.json(config ?? {})},
       ${fecha_vencimiento ?? null},
       ${feedbackTriggerFinal}, ${feedback_documento_texto ?? null}, ${feedback_documento_nombre ?? null},
       ${etiqueta_id ?? null})
    RETURNING *
  `;

  // Auto-assign and notify all users in the area when evaluation has an area_id
  if (area_id) {
    const areaUsers = await db`
      SELECT id FROM profiles
      WHERE area_id = ${area_id}
    `;
    if (areaUsers.length > 0) {
      await db`
        INSERT INTO evaluation_participants (evaluation_id, user_id)
        SELECT ${row.id}, unnest(${areaUsers.map((u: any) => u.id)}::uuid[])
        ON CONFLICT DO NOTHING
      `;
      await db`
        INSERT INTO notifications (user_id, type, title, body)
        SELECT id, 'evaluation_assigned', 'Nueva evaluación disponible',
               ${"Tienes una nueva evaluación disponible: \"" + title + "\""}
        FROM profiles
        WHERE area_id = ${area_id}
      `;
    }
  }

  let foro_articulo_error: string | undefined;
  if (feedback_documento_texto) {
    const idioma = typeof feedback_documento_idioma === "string" ? feedback_documento_idioma : "Español";
    const result = await syncForoArticuloFromEvaluation(row.id, feedback_documento_texto, idioma, adminOrErr.id);
    foro_articulo_error = result.error;
  }
  if (row.activa === false) {
    await publishForoArticuloIfDeactivated(row.id);
  }

  return json({ ...parseEvaluation(row), foro_articulo_error }, 201);
}

async function updateEvaluation(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const allowed = [
    "title", "description", "activa", "tiempo_limite",
    "intentos_permitidos", "categorias", "config", "area_id",
    "fecha_vencimiento", "created_by",
    "feedback_trigger", "feedback_documento_texto", "feedback_documento_nombre",
    "etiqueta_id",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      if (k === "categorias" || k === "config") {
        patch[k] = db.json(body[k]);
      } else if (k === "feedback_trigger") {
        patch[k] = ["ninguno", "al_finalizar", "inactiva"].includes(body[k]) ? body[k] : "ninguno";
      } else {
        patch[k] = body[k];
      }
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: "Sin cambios" }, 400);

  const [before] = await db`SELECT feedback_documento_texto FROM evaluations WHERE id = ${id}`;

  const [row] = await db`
    UPDATE evaluations SET ${db(patch)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);

  let foro_articulo_error: string | undefined;
  const docChanged =
    "feedback_documento_texto" in patch && body.feedback_documento_texto !== before?.feedback_documento_texto;
  if (docChanged) {
    const idioma = typeof body.feedback_documento_idioma === "string" ? body.feedback_documento_idioma : "Español";
    const result = await syncForoArticuloFromEvaluation(id, row.feedback_documento_texto, idioma, adminOrErr.id);
    foro_articulo_error = result.error;
  }
  if (patch.activa === false) {
    await publishForoArticuloIfDeactivated(id);
  }

  return json({ ...parseEvaluation(row), foro_articulo_error });
}

async function deleteEvaluation(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  await db`DELETE FROM evaluations WHERE id = ${id}`;
  return json({ success: true });
}

async function evalWithQuestions(id: string): Promise<Response> {
  const [evaluation] = await db`SELECT * FROM evaluations WHERE id = ${id}`;
  if (!evaluation) return json({ error: "No encontrado" }, 404);
  const questions = await db`
    SELECT * FROM questions WHERE evaluation_id = ${id} ORDER BY created_at ASC
  `;
  return json({ ...parseEvaluation(evaluation), questions: questions.map(parseQuestion) });
}

// ── Evaluation helpers ────────────────────────────────────────────────────────

function parseEvaluation(row: any) {
  if (!row) return row;
  return {
    ...row,
    categorias: typeof row.categorias === "string"
      ? JSON.parse(row.categorias)
      : (row.categorias ?? []),
    config: typeof row.config === "string"
      ? JSON.parse(row.config)
      : (row.config ?? {}),
  };
}

// ── Questions handlers ────────────────────────────────────────────────────────

function parseQuestion(row: any) {
  if (!row) return row;
  return {
    ...row,
    options: typeof row.options === "string" ? JSON.parse(row.options) : (row.options ?? []),
  };
}

async function listQuestions(): Promise<Response> {
  const rows = await db`SELECT * FROM questions ORDER BY created_at DESC`;
  return json(rows.map(parseQuestion));
}

async function questionsByEval(evalId: string): Promise<Response> {
  const rows = await db`
    SELECT * FROM questions WHERE evaluation_id = ${evalId} ORDER BY created_at ASC
  `;
  return json(rows.map(parseQuestion));
}

async function questionsByIds(url: URL): Promise<Response> {
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return json([]);
  const rows = await db`SELECT * FROM questions WHERE id = ANY(${ids}::uuid[])`;
  return json(rows.map(parseQuestion));
}

async function questionsFiltered(url: URL): Promise<Response> {
  const rawCats = url.searchParams.get("categorias") ?? "";
  const dificultad = url.searchParams.get("dificultad") ?? "";
  const cats = rawCats.split(",").map((s) => s.trim()).filter(Boolean);

  let rows;
  if (cats.length > 0 && dificultad && dificultad !== "mixto") {
    rows = await db`
      SELECT * FROM questions
      WHERE categoria = ANY(${cats}::text[]) AND dificultad = ${dificultad}
      ORDER BY created_at DESC
    `;
  } else if (cats.length > 0) {
    rows = await db`
      SELECT * FROM questions
      WHERE categoria = ANY(${cats}::text[])
      ORDER BY created_at DESC
    `;
  } else if (dificultad && dificultad !== "mixto") {
    rows = await db`
      SELECT * FROM questions WHERE dificultad = ${dificultad} ORDER BY created_at DESC
    `;
  } else {
    rows = await db`SELECT * FROM questions ORDER BY created_at DESC`;
  }
  return json(rows.map(parseQuestion));
}

async function createQuestion(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const { evaluation_id, question_text, options, correct_answer,
    contexto, categoria, area, dificultad, estado, justificacion } = body;

  const [row] = await db`
    INSERT INTO questions
      (evaluation_id, question_text, options, correct_answer,
       contexto, categoria, area, dificultad, estado, justificacion)
    VALUES
      (${evaluation_id ?? null}, ${question_text}, ${JSON.stringify(options)},
       ${correct_answer}, ${contexto ?? null}, ${categoria ?? null}, ${area ?? null},
       ${dificultad ?? null}, ${estado ?? null}, ${justificacion ?? null})
    RETURNING *
  `;
  return json(parseQuestion(row), 201);
}

async function createQuestionsBatch(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const questions: any[] = await request.json();
  if (!questions.length) return json([]);

  const rows = await db`
    INSERT INTO questions ${db(questions.map((q) => ({
      evaluation_id: q.evaluation_id ?? null,
      question_text: q.question_text,
      options: JSON.stringify(q.options),
      correct_answer: q.correct_answer,
      contexto: q.contexto ?? null,
      categoria: q.categoria ?? null,
      area: q.area ?? null,
      dificultad: q.dificultad ?? null,
      estado: q.estado ?? null,
      justificacion: q.justificacion ?? null,
    })))}
    RETURNING *
  `;
  return json(rows.map(parseQuestion), 201);
}

async function updateQuestion(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const allowed = [
    "evaluation_id", "question_text", "options", "correct_answer",
    "contexto", "categoria", "area", "dificultad", "estado", "justificacion",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      patch[k] = k === "options" ? JSON.stringify(body[k]) : body[k];
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: "Sin cambios" }, 400);

  const [row] = await db`
    UPDATE questions SET ${db(patch)} WHERE id = ${id} RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);

  // If correct_answer changed, recalculate scores for all results that include this question
  if ("correct_answer" in patch) {
    await recalcScoresForQuestion(id);
  }

  return json(parseQuestion(row));
}

async function recalcScoresForQuestion(questionId: string): Promise<void> {
  // Find all results that contain this question in their answers
  const affected = await db`
    SELECT r.id, r.answers, r.evaluation_id
    FROM results r
    WHERE r.answers ? ${questionId}
  `;
  if (!affected.length) return;

  // Load all questions needed for recalculation (union of all answered question IDs)
  const allQIds = new Set<string>();
  for (const r of affected) {
    if (r.answers) Object.keys(r.answers).forEach((qId: string) => allQIds.add(qId));
  }
  const questions = await db`
    SELECT id, correct_answer FROM questions WHERE id = ANY(${[...allQIds]}::uuid[])
  `;
  const qMap: Record<string, string> = {};
  for (const q of questions) qMap[q.id] = q.correct_answer;

  for (const r of affected) {
    if (!r.answers) continue;
    const answeredIds = Object.keys(r.answers);
    const w = 100 / answeredIds.length;
    let total = 0;
    for (const qId of answeredIds) {
      const correctAnswer = qMap[qId];
      if (!correctAnswer) continue;
      const correctAnswers = correctAnswer.split(",").map((a: string) => a.trim());
      const rawAns = r.answers[qId];
      const userAnswers: string[] = Array.isArray(rawAns)
        ? rawAns.map((a: string) => String(a).trim())
        : String(rawAns ?? "").split(",").map((a: string) => a.trim()).filter(Boolean);
      if (!userAnswers.length) continue;
      if (userAnswers.length > correctAnswers.length) continue;
      if (userAnswers.some((a: string) => !correctAnswers.includes(a))) continue;
      total += (userAnswers.length / correctAnswers.length) * w;
    }
    const newScore = Math.round(total);
    await db`UPDATE results SET score = ${newScore} WHERE id = ${r.id}`;
  }
}

async function deleteQuestion(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const result = await db`DELETE FROM questions WHERE id = ${id} RETURNING id`;
  if (result.length === 0) return json({ error: "No encontrado" }, 404);
  return json({ success: true });
}

// ── Results handlers ──────────────────────────────────────────────────────────

async function listResults(): Promise<Response> {
  const rows = await db`
    SELECT
      r.id, r.user_id, r.evaluation_id, r.score, r.answers,
      r.started_at, r.completed_at, r.created_at,
      e.title  AS eval_title,
      e.area_id AS eval_area_id,
      p.full_name AS profile_full_name,
      p.email     AS profile_email
    FROM results r
    LEFT JOIN evaluations e ON e.id = r.evaluation_id
    LEFT JOIN profiles    p ON p.id = r.user_id
    ORDER BY r.completed_at DESC
  `;
  return json(
    rows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      evaluation_id: r.evaluation_id,
      score: r.score,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
      started_at: r.started_at,
      completed_at: r.completed_at,
      evaluations: { title: r.eval_title, area_id: r.eval_area_id },
      profiles: { full_name: r.profile_full_name, email: r.profile_email },
    }))
  );
}

async function resultsByUser(userId: string): Promise<Response> {
  const rows = await db`
    SELECT
      r.id, r.user_id, r.evaluation_id, r.score, r.answers,
      r.started_at, r.completed_at, r.created_at,
      e.title      AS eval_title,
      e.created_at AS eval_created_at,
      e.categorias AS eval_categorias
    FROM results r
    LEFT JOIN evaluations e ON e.id = r.evaluation_id
    WHERE r.user_id = ${userId}
    ORDER BY r.completed_at DESC
  `;
  return json(
    rows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      evaluation_id: r.evaluation_id,
      score: r.score,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
      started_at: r.started_at,
      completed_at: r.completed_at,
      evaluations: {
        title: r.eval_title,
        created_at: r.eval_created_at,
        categorias: r.eval_categorias,
      },
    }))
  );
}

async function resultsByEval(evalId: string): Promise<Response> {
  const rows = await db`
    SELECT
      r.id, r.user_id, r.evaluation_id, r.score, r.answers,
      r.started_at, r.completed_at, r.created_at,
      p.full_name AS profile_full_name,
      p.email     AS profile_email
    FROM results r
    LEFT JOIN profiles p ON p.id = r.user_id
    WHERE r.evaluation_id = ${evalId}
    ORDER BY r.completed_at DESC
  `;
  return json(
    rows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      evaluation_id: r.evaluation_id,
      score: r.score,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers,
      started_at: r.started_at,
      completed_at: r.completed_at,
      profiles: { full_name: r.profile_full_name, email: r.profile_email },
    }))
  );
}

async function getResult(id: string): Promise<Response> {
  const [row] = await db`SELECT * FROM results WHERE id = ${id}`;
  if (!row) return json({ error: "No encontrado" }, 404);
  if (typeof row.answers === 'string') row.answers = JSON.parse(row.answers);
  if (typeof row.feedback === 'string') row.feedback = JSON.parse(row.feedback);
  return json(row);
}

async function submitResultFeedback(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT user_id, feedback FROM results WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);
  if (existing.user_id !== user.id) return json({ error: "No autorizado" }, 403);

  if (existing.feedback) {
    const feedback = typeof existing.feedback === 'string' ? JSON.parse(existing.feedback) : existing.feedback;
    return json(feedback);
  }

  const body = await request.json();
  const feedback = normalizeResultFeedback(body);

  const [row] = await db`
    UPDATE results SET feedback = ${db.json(feedback)}
    WHERE id = ${id} AND feedback IS NULL
    RETURNING feedback
  `;

  if (!row) {
    const [reread] = await db`SELECT feedback FROM results WHERE id = ${id}`;
    return json(typeof reread.feedback === 'string' ? JSON.parse(reread.feedback) : reread.feedback);
  }

  return json(typeof row.feedback === 'string' ? JSON.parse(row.feedback) : row.feedback, 201);
}

async function getResultCount(url: URL): Promise<Response> {
  const userId = url.searchParams.get("userId");
  const evalId = url.searchParams.get("evalId");
  if (!userId || !evalId) return json({ error: "Parámetros faltantes" }, 400);
  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count FROM results
    WHERE user_id = ${userId} AND evaluation_id = ${evalId}
  `;
  return json({ count: count as number });
}

async function createResult(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;

  const body = await request.json();
  const { user_id, evaluation_id, score, answers, started_at } = body;

  const [row] = await db`
    INSERT INTO results (user_id, evaluation_id, score, answers, started_at)
    VALUES (
      ${user_id}, ${evaluation_id}, ${score},
      ${db.json(answers)}, ${started_at ?? null}
    )
    RETURNING *
  `;
  if (typeof row.answers === 'string') row.answers = JSON.parse(row.answers);
  return json(row, 201);
}

// ── Areas handlers ────────────────────────────────────────────────────────────

async function listAreas(): Promise<Response> {
  const rows = await db`SELECT * FROM areas ORDER BY name ASC`;
  return json(rows);
}

async function createArea(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { name, description } = await request.json();
  const [row] = await db`
    INSERT INTO areas (name, description) VALUES (${name}, ${description ?? null})
    RETURNING *
  `;
  return json(row, 201);
}

async function updateArea(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { name, description } = await request.json();
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (Object.keys(patch).length === 0) return json({ error: "Sin cambios" }, 400);

  const [row] = await db`
    UPDATE areas SET ${db(patch)}, updated_at = now() WHERE id = ${id} RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
}

async function deleteArea(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  await db`DELETE FROM areas WHERE id = ${id}`;
  return json({ success: true });
}

// ── Participants ──────────────────────────────────────────────────────────────

async function listParticipants(): Promise<Response> {
  const rows = await db`
    SELECT id, email, full_name, area_id, role
    FROM profiles
    ORDER BY full_name ASC
  `;
  return json(rows);
}

// ── Eval-participants ─────────────────────────────────────────────────────────

async function evalParticipantsByEval(evalId: string): Promise<Response> {
  const rows = await db`
    SELECT user_id FROM evaluation_participants WHERE evaluation_id = ${evalId}
  `;
  return json(rows.map((r: any) => r.user_id));
}

async function evalParticipantsByUser(userId: string): Promise<Response> {
  const rows = await db`
    SELECT evaluation_id FROM evaluation_participants WHERE user_id = ${userId}
  `;
  return json(rows.map((r: any) => r.evaluation_id));
}

async function assignParticipant(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { evaluationId, userId } = await request.json();
  const [existing] = await db`
    INSERT INTO evaluation_participants (evaluation_id, user_id)
    VALUES (${evaluationId}, ${userId})
    ON CONFLICT DO NOTHING
    RETURNING evaluation_id
  `;

  // Create a notification for the newly assigned participant
  if (existing) {
    const [evaluation] = await db`SELECT title FROM evaluations WHERE id = ${evaluationId}`;
    if (evaluation) {
      await db`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES (${userId}, 'evaluation_assigned',
                'Nueva evaluación disponible',
                ${"Tienes una nueva evaluación disponible: \"" + evaluation.title + "\""})
      `;
    }
  }

  return json({ success: true });
}

async function unassignParticipant(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { evaluationId, userId } = await request.json();
  await db`
    DELETE FROM evaluation_participants
    WHERE evaluation_id = ${evaluationId} AND user_id = ${userId}
  `;
  return json({ success: true });
}

// ── Progress ──────────────────────────────────────────────────────────────────

async function getProgress(userId: string, evalId: string): Promise<Response> {
  const [row] = await db`
    SELECT * FROM evaluation_progress
    WHERE user_id = ${userId} AND evaluation_id = ${evalId}
  `;
  if (!row) return json(null);
  if (typeof row.question_order === 'string') row.question_order = JSON.parse(row.question_order);
  if (typeof row.answers === 'string') row.answers = JSON.parse(row.answers);
  return json(row);
}

async function createProgress(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;

  const body = await request.json();
  const {
    user_id, evaluation_id, current_question_index,
    answers, time_remaining, question_order,
  } = body;

  const [row] = await db`
    INSERT INTO evaluation_progress
      (user_id, evaluation_id, current_question_index,
       answers, time_remaining, question_order)
    VALUES
      (${user_id}, ${evaluation_id}, ${current_question_index ?? 0},
       ${db.json(answers ?? {})}, ${time_remaining ?? null},
       ${db.json(question_order ?? [])})
    RETURNING *
  `;
  if (typeof row.question_order === 'string') row.question_order = JSON.parse(row.question_order);
  if (typeof row.answers === 'string') row.answers = JSON.parse(row.answers);
  return json(row, 201);
}

async function updateProgress(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;

  const body = await request.json();
  const { userId, evaluationId, ...rest } = body;
  const allowed = [
    "current_question_index", "answers", "time_remaining", "question_order",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in rest) {
      patch[k] = k === "answers" || k === "question_order"
        ? db.json(rest[k])
        : rest[k];
    }
  }
  patch.updated_at = new Date().toISOString();

  const [row] = await db`
    UPDATE evaluation_progress SET ${db(patch)}
    WHERE user_id = ${userId} AND evaluation_id = ${evaluationId}
    RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);
  if (typeof row.question_order === 'string') row.question_order = JSON.parse(row.question_order);
  if (typeof row.answers === 'string') row.answers = JSON.parse(row.answers);
  return json(row);
}

async function deleteProgress(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;

  const { userId, evaluationId } = await request.json();
  await db`
    DELETE FROM evaluation_progress
    WHERE user_id = ${userId} AND evaluation_id = ${evaluationId}
  `;
  return json({ success: true });
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function getNotifications(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const rows = await db`
    SELECT id, type, title, body, read, created_at
    FROM notifications
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return json(rows);
}

async function markAllNotificationsRead(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  await db`
    UPDATE notifications SET read = true
    WHERE user_id = ${user.id} AND read = false
  `;
  return json({ success: true });
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────

async function listEtiquetas(): Promise<Response> {
  const rows = await db`SELECT id, nombre, created_at FROM etiquetas ORDER BY nombre ASC`;
  return json(rows);
}

async function createEtiqueta(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) return json({ error: "El nombre es requerido" }, 400);

  const [existing] = await db`SELECT id FROM etiquetas WHERE lower(nombre) = lower(${nombre})`;
  if (existing) return json({ error: "Ya existe una etiqueta con ese nombre" }, 409);

  const [row] = await db`
    INSERT INTO etiquetas (nombre) VALUES (${nombre}) RETURNING *
  `;
  return json(row, 201);
}

// ── Categories ────────────────────────────────────────────────────────────────

async function listCategories(): Promise<Response> {
  const rows = await db`
    SELECT DISTINCT categoria FROM questions WHERE categoria IS NOT NULL
  `;
  const cats = rows
    .map((r: any) => r.categoria as string)
    .filter(Boolean)
    .sort();
  return json(cats);
}

async function listQuestionAreas(): Promise<Response> {
  const rows = await db`
    SELECT DISTINCT area FROM questions WHERE area IS NOT NULL
  `;
  const areas = rows
    .map((r: any) => r.area as string)
    .filter(Boolean)
    .sort();
  return json(areas);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function dashboardStats(): Promise<Response> {
  const [
    [{ count: totalEvaluations }],
    recentEvalsRaw,
    [{ count: totalParticipants }],
    allScores,
    [{ count: totalQuestions }],
    recentResultsRaw,
  ] = await Promise.all([
    db`SELECT COUNT(*)::int AS count FROM evaluations`,
    db`
      SELECT e.id, e.title, e.created_at,
             COALESCE(AVG(r.score), 0)::float AS avg_score,
             COUNT(r.id)::int                 AS result_count
      FROM evaluations e
      LEFT JOIN results r ON r.evaluation_id = e.id
      GROUP BY e.id, e.title, e.created_at
      ORDER BY e.created_at DESC
      LIMIT 10
    `,
    db`SELECT COUNT(*)::int AS count FROM profiles`,
    db`SELECT score FROM results`,
    db`SELECT COUNT(*)::int AS count FROM questions`,
    db`
      SELECT r.score, r.completed_at,
             p.full_name AS profile_full_name,
             e.title     AS evaluation_title
      FROM results r
      LEFT JOIN profiles    p ON p.id = r.user_id
      LEFT JOIN evaluations e ON e.id = r.evaluation_id
      ORDER BY r.completed_at DESC
      LIMIT 5
    `,
  ]);

  const totalResultsCount = allScores.length;
  const averageScore =
    totalResultsCount > 0
      ? Math.round(
          allScores.reduce((s: number, r: any) => s + r.score, 0) /
            totalResultsCount
        )
      : 0;

  const completionRate =
    totalParticipants > 0
      ? Math.round((totalResultsCount / totalParticipants) * 100)
      : 0;

  const recentEvaluations = recentEvalsRaw.map((e: any) => ({
    id: e.id,
    title: e.title,
    participants: e.result_count,
    averageScore: Math.round(e.avg_score),
    created_at: e.created_at,
  }));

  const recentActivity: any[] = [];
  for (const r of recentResultsRaw) {
    recentActivity.push({
      type: "result",
      text: `${(r as any).profile_full_name || "Participante"} finalizó "${(r as any).evaluation_title || "Evaluación"}"`,
      meta: `Puntaje: ${(r as any).score}%`,
      timestamp: (r as any).completed_at,
    });
  }
  for (const e of recentEvalsRaw.slice(0, 3)) {
    recentActivity.push({
      type: "evaluation",
      text: `Evaluación "${(e as any).title}" creada`,
      meta: "Nueva evaluación",
      timestamp: (e as any).created_at,
    });
  }
  recentActivity.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return json({
    totalEvaluations,
    totalParticipants,
    totalResults: totalResultsCount,
    averageScore,
    completionRate,
    totalQuestions,
    recentEvaluations,
    recentActivity: recentActivity.slice(0, 8),
  });
}

async function activityFeed(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  const [recentResultsRaw, recentEvalsRaw] = await Promise.all([
    db`
      SELECT r.score, r.completed_at,
             p.full_name AS profile_full_name,
             e.title     AS evaluation_title
      FROM results r
      LEFT JOIN profiles    p ON p.id = r.user_id
      LEFT JOIN evaluations e ON e.id = r.evaluation_id
      ORDER BY r.completed_at DESC
      LIMIT ${limit}
    `,
    db`
      SELECT title, created_at FROM evaluations
      ORDER BY created_at DESC
      LIMIT ${Math.ceil(limit / 2)}
    `,
  ]);

  const activity: any[] = [];
  for (const r of recentResultsRaw) {
    activity.push({
      type: "result",
      text: `${(r as any).profile_full_name || "Participante"} finalizó "${(r as any).evaluation_title || "Evaluación"}"`,
      meta: `Puntaje: ${(r as any).score}%`,
      timestamp: (r as any).completed_at,
    });
  }
  for (const e of recentEvalsRaw) {
    activity.push({
      type: "evaluation",
      text: `Evaluación "${(e as any).title}" creada`,
      meta: "Nueva evaluación",
      timestamp: (e as any).created_at,
    });
  }
  activity.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return json(activity.slice(0, limit));
}

// ── Profiles (users page) ─────────────────────────────────────────────────────

async function listProfiles(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const rows = await db`
    SELECT
      p.id, p.email, p.full_name, p.role, p.area_id,
      p.created_at, p.updated_at,
      COUNT(r.id)::int AS evaluation_count
    FROM profiles p
    LEFT JOIN results r ON r.user_id = p.id
    GROUP BY p.id, p.email, p.full_name, p.role, p.area_id, p.created_at, p.updated_at
    ORDER BY p.created_at DESC
  `;
  return json(rows);
}

async function updateProfileById(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const allowed = ["full_name", "role", "area_id"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) return json({ error: "Sin cambios" }, 400);
  patch.updated_at = new Date().toISOString();

  const [row] = await db`
    UPDATE profiles SET ${db(patch)} WHERE id = ${id} RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);
  const { password_hash: _ph, ...profile } = row as any;
  return json(profile);
}

// ── User management ───────────────────────────────────────────────────────────

async function selfActivate(request: Request): Promise<Response> {
  const user = await auth(request);
  if (!user) return json({ error: "No autenticado" }, 401);
  if (user.role !== "Pendiente")
    return json({ error: "Tu cuenta ya tiene un rol asignado" }, 400);

  const [updated] = await db`
    UPDATE profiles SET role = 'participant', updated_at = now()
    WHERE id = ${user.id} AND role = 'Pendiente'
    RETURNING id, email, full_name, role, area_id, created_at, updated_at
  `;
  return json(updated);
}

async function createUser(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { email, fullName, role, areaId } = await request.json();
  if (!email || !fullName || !role)
    return json({ error: "Campos requeridos faltantes" }, 400);

  const [profile] = await db`
    INSERT INTO profiles (email, full_name, role, area_id)
    VALUES (${email}, ${fullName}, ${role}, ${areaId ?? null})
    ON CONFLICT (email) DO UPDATE SET
      full_name  = EXCLUDED.full_name,
      role       = EXCLUDED.role,
      area_id    = EXCLUDED.area_id,
      updated_at = now()
    RETURNING id, email, full_name, role, area_id, created_at, updated_at
  `;
  return json({ id: profile.id, email: profile.email }, 201);
}

async function deleteUser(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;
  const caller = adminOrErr as AuthUser;

  const { userId } = await request.json();
  if (userId === caller.id)
    return json({ error: "No puedes eliminar tu propia cuenta" }, 400);

  await db`DELETE FROM profiles WHERE id = ${userId}`;
  return json({ success: true });
}


// ── System settings ───────────────────────────────────────────────────────────

async function getSettings(): Promise<Response> {
  const rows = await db`SELECT key, value FROM system_settings`;
  const settings: Record<string, string> = {};
  for (const row of rows as any[]) settings[row.key] = row.value;
  return json(settings);
}

async function setBrandLogo(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { dataUrl } = await request.json();
  if (!dataUrl || typeof dataUrl !== "string")
    return json({ error: "dataUrl requerido" }, 400);

  const MAX_BYTES = 1_500_000;
  if (dataUrl.length > MAX_BYTES)
    return json({ error: "La imagen supera el límite de 1 MB" }, 400);

  if (!/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/.test(dataUrl))
    return json({ error: "Formato de imagen no válido" }, 400);

  await db`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('brand_logo', ${dataUrl}, now())
    ON CONFLICT (key) DO UPDATE SET value = ${dataUrl}, updated_at = now()
  `;
  return json({ success: true });
}

async function deleteBrandLogo(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  await db`DELETE FROM system_settings WHERE key = 'brand_logo'`;
  return json({ success: true });
}

// ── Role permissions ───────────────────────────────────────────────────────────

async function getRolePermissions(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const permRows  = await db`SELECT role, module, level FROM role_permissions` as any[];
  const capRows   = await db`SELECT role, capability, enabled FROM role_capabilities` as any[];

  const matrix: Record<string, Record<string, string>> = {};
  for (const r of permRows) {
    if (!matrix[r.role]) matrix[r.role] = {};
    matrix[r.role][r.module] = r.level;
  }

  const capabilities: Record<string, Record<string, boolean>> = {};
  for (const r of capRows) {
    if (!capabilities[r.role]) capabilities[r.role] = {};
    capabilities[r.role][r.capability] = r.enabled;
  }

  return json({ matrix, capabilities });
}

async function setRolePermissions(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { matrix, capabilities } = await request.json();

  for (const [role, modules] of Object.entries(matrix as Record<string, Record<string, string>>)) {
    for (const [module, level] of Object.entries(modules)) {
      await db`
        INSERT INTO role_permissions (role, module, level)
        VALUES (${role}, ${module}, ${level})
        ON CONFLICT (role, module) DO UPDATE SET level = ${level}
      `;
    }
  }

  for (const [role, caps] of Object.entries(capabilities as Record<string, Record<string, boolean>>)) {
    for (const [capability, enabled] of Object.entries(caps)) {
      await db`
        INSERT INTO role_capabilities (role, capability, enabled)
        VALUES (${role}, ${capability}, ${enabled})
        ON CONFLICT (role, capability) DO UPDATE SET enabled = ${enabled}
      `;
    }
  }

  return json({ success: true });
}

// ── Foro ────────────────────────────────────────────────────────────────────

const FORO_ADJUNTO_MAX_BYTES = 5_000_000; // 5MB per file
const FORO_ADJUNTOS_TOTAL_MAX_BYTES = 20_000_000; // 20MB total per article
const FORO_ADJUNTO_MIME_RE =
  /^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain);base64,/;

function parseForoArticulo(row: any) {
  if (!row) return row;
  return {
    ...row,
    etiquetas: typeof row.etiquetas === "string" ? JSON.parse(row.etiquetas) : (row.etiquetas ?? []),
  };
}

function parseForoComentario(row: any) {
  if (!row) return row;
  return {
    ...row,
    mentions: typeof row.mentions === "string" ? JSON.parse(row.mentions) : (row.mentions ?? []),
  };
}

function validateForoAdjuntos(adjuntos: unknown): string | null {
  if (adjuntos === undefined || adjuntos === null) return null;
  if (!Array.isArray(adjuntos)) return "Formato de adjuntos inválido";
  if (adjuntos.length > 10) return "Máximo 10 adjuntos por artículo";
  let total = 0;
  for (const a of adjuntos) {
    if (
      !a ||
      typeof a.nombre !== "string" ||
      typeof a.tipo !== "string" ||
      typeof a.data_url !== "string" ||
      typeof a.tamano !== "number"
    )
      return "Adjunto inválido";
    if (!FORO_ADJUNTO_MIME_RE.test(a.data_url)) return `Tipo de archivo no permitido: ${a.nombre}`;
    if (a.tamano > FORO_ADJUNTO_MAX_BYTES) return `El archivo "${a.nombre}" supera el límite de 5MB`;
    total += a.tamano;
  }
  if (total > FORO_ADJUNTOS_TOTAL_MAX_BYTES) return "El total de adjuntos supera el límite de 20MB";
  return null;
}

async function replaceForoAdjuntos(articuloId: string, adjuntos: any[] | undefined): Promise<void> {
  await db`DELETE FROM foro_adjuntos WHERE articulo_id = ${articuloId}`;
  if (!Array.isArray(adjuntos)) return;
  for (const a of adjuntos) {
    await db`
      INSERT INTO foro_adjuntos (articulo_id, nombre, tipo, data_url, tamano)
      VALUES (${articuloId}, ${a.nombre}, ${a.tipo}, ${a.data_url}, ${a.tamano})
    `;
  }
}

async function resolveForoMentions(mentions: unknown): Promise<string[]> {
  if (!Array.isArray(mentions) || mentions.length === 0) return [];
  const ids = mentions.filter((m): m is string => typeof m === "string").slice(0, 20);
  if (ids.length === 0) return [];
  const rows = await db`SELECT id FROM profiles WHERE id = ANY(${ids}::uuid[])`;
  return rows.map((r: any) => r.id);
}

async function listForoArticulos(request: Request, url: URL): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const level = await getPermissionLevel(user, "foro");
  if (level === "none") return json({ error: "Sin acceso al módulo Foro" }, 403);

  const search = url.searchParams.get("search") || null;
  const categoria = url.searchParams.get("categoria") || null;
  const etiqueta = url.searchParams.get("etiqueta") || null;
  const autor = url.searchParams.get("autor") || null;
  const desde = url.searchParams.get("desde") || null;
  const hasta = url.searchParams.get("hasta") || null;
  const populares = url.searchParams.get("orden") === "populares";
  const canSeeAllDrafts = level === "full";

  const whereClause = db`
    (a.estado = 'publicado' OR a.autor_id = ${user.id} OR ${canSeeAllDrafts})
    AND (${search}::text IS NULL OR a.titulo ILIKE '%' || ${search} || '%' OR a.contenido ILIKE '%' || ${search} || '%')
    AND (${categoria}::text IS NULL OR a.categoria = ${categoria})
    AND (${etiqueta}::text IS NULL OR a.etiquetas ? ${etiqueta})
    AND (${autor}::uuid IS NULL OR a.autor_id = ${autor}::uuid)
    AND (${desde}::date IS NULL OR a.created_at >= ${desde}::date)
    AND (${hasta}::date IS NULL OR a.created_at < (${hasta}::date + interval '1 day'))
  `;

  const rows = populares
    ? await db`
        SELECT a.id, a.titulo, a.resumen, a.autor_id, p.full_name AS autor_nombre, a.categoria, a.etiquetas,
               a.estado, a.vistas, a.published_at, a.created_at,
               (SELECT COUNT(*) FROM foro_comentarios c WHERE c.articulo_id = a.id) AS comentarios
        FROM foro_articulos a
        JOIN profiles p ON p.id = a.autor_id
        WHERE ${whereClause}
        ORDER BY a.vistas DESC, a.created_at DESC
      `
    : await db`
        SELECT a.id, a.titulo, a.resumen, a.autor_id, p.full_name AS autor_nombre, a.categoria, a.etiquetas,
               a.estado, a.vistas, a.published_at, a.created_at,
               (SELECT COUNT(*) FROM foro_comentarios c WHERE c.articulo_id = a.id) AS comentarios
        FROM foro_articulos a
        JOIN profiles p ON p.id = a.autor_id
        WHERE ${whereClause}
        ORDER BY COALESCE(a.published_at, a.created_at) DESC
      `;

  return json(rows.map((r: any) => parseForoArticulo({ ...r, comentarios: parseInt(r.comentarios) })));
}

async function getForoArticulo(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const level = await getPermissionLevel(user, "foro");
  if (level === "none") return json({ error: "Sin acceso al módulo Foro" }, 403);

  const [article] = await db`
    SELECT a.*, p.full_name AS autor_nombre, p.email AS autor_email
    FROM foro_articulos a
    JOIN profiles p ON p.id = a.autor_id
    WHERE a.id = ${id}
  `;
  if (!article) return json({ error: "No encontrado" }, 404);

  const isOwner = article.autor_id === user.id;
  if (article.estado !== "publicado" && !isOwner && level !== "full")
    return json({ error: "No encontrado" }, 404);

  await db`
    WITH ins AS (
      INSERT INTO foro_vistas (articulo_id, user_id) VALUES (${id}, ${user.id})
      ON CONFLICT DO NOTHING RETURNING 1
    )
    UPDATE foro_articulos SET vistas = vistas + 1
    WHERE id = ${id} AND EXISTS (SELECT 1 FROM ins)
  `;

  const [{ vistas }] = await db`SELECT vistas FROM foro_articulos WHERE id = ${id}`;
  const adjuntos = await db`
    SELECT id, nombre, tipo, data_url, tamano FROM foro_adjuntos
    WHERE articulo_id = ${id} ORDER BY created_at ASC
  `;
  const [{ count: comentarios }] = await db`
    SELECT COUNT(*) AS count FROM foro_comentarios WHERE articulo_id = ${id}
  ` as any[];

  return json(parseForoArticulo({ ...article, vistas, adjuntos, comentarios: parseInt(comentarios) }));
}

async function createForoArticulo(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const level = await getPermissionLevel(user, "foro");
  if (!levelAtLeast(level, "editar"))
    return json({ error: "No tienes permiso para crear artículos" }, 403);

  const body = await request.json();
  const { titulo, contenido, resumen, categoria, etiquetas, estado, adjuntos, origen } = body;

  if (!titulo || typeof titulo !== "string" || !titulo.trim())
    return json({ error: "El título es requerido" }, 400);
  if (!contenido || typeof contenido !== "string" || !contenido.trim())
    return json({ error: "El contenido es requerido" }, 400);

  const attachmentsErr = validateForoAdjuntos(adjuntos);
  if (attachmentsErr) return json({ error: attachmentsErr }, 400);

  const estadoFinal = estado === "publicado" ? "publicado" : "borrador";
  const origenFinal = origen === "ia" ? "ia" : "manual";
  const etiquetasFinal = Array.isArray(etiquetas)
    ? etiquetas.filter((t: any) => typeof t === "string").slice(0, 20)
    : [];
  const publishedAt = estadoFinal === "publicado" ? new Date() : null;

  const [row] = await db`
    INSERT INTO foro_articulos (titulo, contenido, resumen, autor_id, categoria, etiquetas, estado, origen, published_at)
    VALUES (${titulo.trim()}, ${contenido}, ${resumen ?? null}, ${user.id}, ${categoria ?? null},
            ${db.json(etiquetasFinal)}, ${estadoFinal}, ${origenFinal}, ${publishedAt})
    RETURNING *
  `;

  await replaceForoAdjuntos(row.id, adjuntos);

  return json(parseForoArticulo(row), 201);
}

async function updateForoArticulo(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT autor_id, estado, published_at FROM foro_articulos WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);

  const level = await getPermissionLevel(user, "foro");
  const isOwner = existing.autor_id === user.id;
  if (!(level === "full" || (levelAtLeast(level, "editar") && isOwner)))
    return json({ error: "No tienes permiso para editar este artículo" }, 403);

  const body = await request.json();
  const { titulo, contenido, resumen, categoria, etiquetas, estado, adjuntos } = body;

  if (!titulo || typeof titulo !== "string" || !titulo.trim())
    return json({ error: "El título es requerido" }, 400);
  if (!contenido || typeof contenido !== "string" || !contenido.trim())
    return json({ error: "El contenido es requerido" }, 400);

  const attachmentsErr = validateForoAdjuntos(adjuntos);
  if (attachmentsErr) return json({ error: attachmentsErr }, 400);

  const estadoFinal = estado === "publicado" ? "publicado" : "borrador";
  const etiquetasFinal = Array.isArray(etiquetas)
    ? etiquetas.filter((t: any) => typeof t === "string").slice(0, 20)
    : [];
  const publishedAt =
    estadoFinal === "publicado" ? (existing.published_at ?? new Date()) : existing.published_at;

  const [row] = await db`
    UPDATE foro_articulos SET
      titulo = ${titulo.trim()},
      contenido = ${contenido},
      resumen = ${resumen ?? null},
      categoria = ${categoria ?? null},
      etiquetas = ${db.json(etiquetasFinal)},
      estado = ${estadoFinal},
      published_at = ${publishedAt},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  await replaceForoAdjuntos(id, adjuntos);

  return json(parseForoArticulo(row));
}

async function deleteForoArticulo(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT autor_id FROM foro_articulos WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);

  const level = await getPermissionLevel(user, "foro");
  const isOwner = existing.autor_id === user.id;
  if (!(level === "full" || (levelAtLeast(level, "editar") && isOwner)))
    return json({ error: "No tienes permiso para eliminar este artículo" }, 403);

  await db`DELETE FROM foro_articulos WHERE id = ${id}`;
  return json({ success: true });
}

async function foroComentariosByArticulo(request: Request, articuloId: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const level = await getPermissionLevel(user, "foro");
  if (level === "none") return json({ error: "Sin acceso al módulo Foro" }, 403);

  const rows = await db`
    SELECT c.id, c.articulo_id, c.autor_id, p.full_name AS autor_nombre, c.parent_id,
           c.contenido, c.mentions, c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM foro_reacciones r WHERE r.comentario_id = c.id) AS likes,
           EXISTS(
             SELECT 1 FROM foro_reacciones r WHERE r.comentario_id = c.id AND r.user_id = ${user.id}
           ) AS liked_by_me
    FROM foro_comentarios c
    JOIN profiles p ON p.id = c.autor_id
    WHERE c.articulo_id = ${articuloId}
    ORDER BY c.created_at ASC
  `;
  return json(rows.map((r: any) => parseForoComentario({ ...r, likes: parseInt(r.likes) })));
}

async function createForoComentario(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const level = await getPermissionLevel(user, "foro");
  if (level === "none") return json({ error: "Sin acceso al módulo Foro" }, 403);

  const body = await request.json();
  const { articulo_id, contenido, parent_id, mentions } = body;

  if (!articulo_id || typeof articulo_id !== "string")
    return json({ error: "articulo_id requerido" }, 400);
  if (!contenido || typeof contenido !== "string" || !contenido.trim())
    return json({ error: "El comentario no puede estar vacío" }, 400);

  const [article] = await db`SELECT id, titulo, estado FROM foro_articulos WHERE id = ${articulo_id}`;
  if (!article) return json({ error: "Artículo no encontrado" }, 404);
  if (article.estado !== "publicado")
    return json({ error: "No se puede comentar un borrador" }, 400);

  let parentComment: any = null;
  if (parent_id) {
    const [parent] = await db`
      SELECT id, articulo_id, autor_id, parent_id FROM foro_comentarios WHERE id = ${parent_id}
    `;
    if (!parent || parent.articulo_id !== articulo_id)
      return json({ error: "Comentario padre inválido" }, 400);
    if (parent.parent_id)
      return json({ error: "Solo se puede responder a comentarios de nivel superior" }, 400);
    parentComment = parent;
  }

  const validMentions = await resolveForoMentions(mentions);

  const [row] = await db`
    INSERT INTO foro_comentarios (articulo_id, autor_id, parent_id, contenido, mentions)
    VALUES (${articulo_id}, ${user.id}, ${parent_id ?? null}, ${contenido.trim()}, ${db.json(validMentions)})
    RETURNING *
  `;

  if (parentComment && parentComment.autor_id !== user.id) {
    await db`
      INSERT INTO notifications (user_id, type, title, body)
      VALUES (${parentComment.autor_id}, 'foro_reply', 'Nueva respuesta a tu comentario',
              ${'Respondieron tu comentario en "' + article.titulo + '"'})
    `;
  }

  for (const uid of validMentions) {
    if (uid === user.id) continue;
    if (parentComment && uid === parentComment.autor_id) continue;
    await db`
      INSERT INTO notifications (user_id, type, title, body)
      VALUES (${uid}, 'foro_mention', 'Te mencionaron en el Foro',
              ${'Te mencionaron en un comentario de "' + article.titulo + '"'})
    `;
  }

  return json(parseForoComentario(row), 201);
}

async function updateForoComentario(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT * FROM foro_comentarios WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);
  if (existing.autor_id !== user.id)
    return json({ error: "Solo puedes editar tus propios comentarios" }, 403);

  const body = await request.json();
  const { contenido, mentions } = body;
  if (!contenido || typeof contenido !== "string" || !contenido.trim())
    return json({ error: "El comentario no puede estar vacío" }, 400);

  const validMentions = await resolveForoMentions(mentions);
  const prevMentions: string[] =
    typeof existing.mentions === "string" ? JSON.parse(existing.mentions) : (existing.mentions ?? []);
  const newMentions = validMentions.filter((uid) => !prevMentions.includes(uid));

  const [row] = await db`
    UPDATE foro_comentarios SET
      contenido = ${contenido.trim()}, mentions = ${db.json(validMentions)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (newMentions.length > 0) {
    const [article] = await db`SELECT titulo FROM foro_articulos WHERE id = ${existing.articulo_id}`;
    for (const uid of newMentions) {
      if (uid === user.id) continue;
      await db`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES (${uid}, 'foro_mention', 'Te mencionaron en el Foro',
                ${'Te mencionaron en un comentario de "' + (article?.titulo ?? "") + '"'})
      `;
    }
  }

  return json(parseForoComentario(row));
}

async function deleteForoComentario(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT autor_id FROM foro_comentarios WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);

  const level = await getPermissionLevel(user, "foro");
  if (existing.autor_id !== user.id && level !== "full")
    return json({ error: "No tienes permiso para eliminar este comentario" }, 403);

  await db`DELETE FROM foro_comentarios WHERE id = ${id}`;
  return json({ success: true });
}

async function toggleForoLike(request: Request, id: string): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const user = userOrErr as AuthUser;

  const [existing] = await db`SELECT 1 FROM foro_comentarios WHERE id = ${id}`;
  if (!existing) return json({ error: "No encontrado" }, 404);

  const [already] = await db`
    SELECT 1 FROM foro_reacciones WHERE comentario_id = ${id} AND user_id = ${user.id}
  `;
  if (already) {
    await db`DELETE FROM foro_reacciones WHERE comentario_id = ${id} AND user_id = ${user.id}`;
  } else {
    await db`INSERT INTO foro_reacciones (comentario_id, user_id) VALUES (${id}, ${user.id})`;
  }

  const [{ count }] = await db`
    SELECT COUNT(*) AS count FROM foro_reacciones WHERE comentario_id = ${id}
  ` as any[];
  return json({ liked: !already, likes: parseInt(count) });
}
