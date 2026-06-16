import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { getAuthContext, AuthUser } from "./server-auth";

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
  if (user.role !== "admin" && user.role !== "both")
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

  // ── User management ──────────────────────────────────────────────────────
  if (sub === "create-user" && m === "POST") return createUser(request);
  if (sub === "delete-user" && m === "POST") return deleteUser(request);
  if (sub === "change-password" && m === "POST") return changeUserPassword(request);
  if (sub === "change-own-password" && m === "POST") return changeOwnPassword(request);

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

  // ── Categories ────────────────────────────────────────────────────────────
  if (res === "categories" && !id && m === "GET") return listCategories();

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

  return null;
}

// ── Evaluations handlers ──────────────────────────────────────────────────────

async function listEvaluations(): Promise<Response> {
  const rows = await db`SELECT * FROM evaluations ORDER BY created_at DESC`;
  return json(rows.map(parseEvaluation));
}

async function activeEvaluations(): Promise<Response> {
  const rows = await db`
    SELECT * FROM evaluations
    WHERE activa = true
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento > now())
    ORDER BY created_at DESC
  `;
  return json(rows.map(parseEvaluation));
}

async function getEvaluation(id: string): Promise<Response> {
  const [row] = await db`SELECT * FROM evaluations WHERE id = ${id}`;
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
  } = body;

  const [row] = await db`
    INSERT INTO evaluations
      (title, description, created_by, area_id, activa, tiempo_limite,
       intentos_permitidos, categorias, config, fecha_vencimiento)
    VALUES
      (${title}, ${description ?? null}, ${created_by ?? null}, ${area_id ?? null},
       ${activa ?? true}, ${tiempo_limite ?? null}, ${intentos_permitidos ?? 1},
       ${db.json(categorias ?? [])}, ${db.json(config ?? {})},
       ${fecha_vencimiento ?? null})
    RETURNING *
  `;
  return json(parseEvaluation(row), 201);
}

async function updateEvaluation(request: Request, id: string): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const body = await request.json();
  const allowed = [
    "title", "description", "activa", "tiempo_limite",
    "intentos_permitidos", "categorias", "config", "area_id",
    "fecha_vencimiento", "created_by",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      patch[k] = (k === "categorias" || k === "config") ? db.json(body[k]) : body[k];
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: "Sin cambios" }, 400);

  const [row] = await db`
    UPDATE evaluations SET ${db(patch)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(parseEvaluation(row));
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
    contexto, categoria, dificultad, estado, justificacion } = body;

  const [row] = await db`
    INSERT INTO questions
      (evaluation_id, question_text, options, correct_answer,
       contexto, categoria, dificultad, estado, justificacion)
    VALUES
      (${evaluation_id ?? null}, ${question_text}, ${JSON.stringify(options)},
       ${correct_answer}, ${contexto ?? null}, ${categoria ?? null},
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
    "contexto", "categoria", "dificultad", "estado", "justificacion",
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
  return json(parseQuestion(row));
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
      answers: r.answers,
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
      answers: r.answers,
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
      answers: r.answers,
      started_at: r.started_at,
      completed_at: r.completed_at,
      profiles: { full_name: r.profile_full_name, email: r.profile_email },
    }))
  );
}

async function getResult(id: string): Promise<Response> {
  const [row] = await db`SELECT * FROM results WHERE id = ${id}`;
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
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
      ${JSON.stringify(answers)}, ${started_at ?? null}
    )
    RETURNING *
  `;
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
    WHERE role IN ('participant', 'both')
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
  await db`
    INSERT INTO evaluation_participants (evaluation_id, user_id)
    VALUES (${evaluationId}, ${userId})
    ON CONFLICT DO NOTHING
  `;
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
  return json(row ?? null);
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
       ${JSON.stringify(answers ?? {})}, ${time_remaining ?? null},
       ${JSON.stringify(question_order ?? [])})
    RETURNING *
  `;
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
        ? JSON.stringify(rest[k])
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

async function createUser(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { email, password, fullName, role, areaId } = await request.json();
  if (!email || !password || !fullName || !role)
    return json({ error: "Campos requeridos faltantes" }, 400);

  const password_hash = hashPassword(password);
  const [profile] = await db`
    INSERT INTO profiles (email, full_name, role, area_id, password_hash)
    VALUES (${email}, ${fullName}, ${role}, ${areaId ?? null}, ${password_hash})
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

async function changeUserPassword(request: Request): Promise<Response> {
  const adminOrErr = await requireAdmin(request);
  if (adminOrErr instanceof Response) return adminOrErr;

  const { userId, newPassword } = await request.json();
  if (!userId || !newPassword)
    return json({ error: "Campos requeridos faltantes" }, 400);

  const password_hash = hashPassword(newPassword);
  await db`
    UPDATE profiles SET password_hash = ${password_hash}, updated_at = now()
    WHERE id = ${userId}
  `;
  return json({ success: true });
}

async function changeOwnPassword(request: Request): Promise<Response> {
  const userOrErr = await requireAuth(request);
  if (userOrErr instanceof Response) return userOrErr;
  const caller = userOrErr as AuthUser;

  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword)
    return json({ error: "Campos requeridos faltantes" }, 400);
  if (newPassword.length < 6)
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);

  const [user] = await db`SELECT password_hash FROM profiles WHERE id = ${caller.id}`;
  if (!user?.password_hash)
    return json({ error: "Este usuario no tiene contraseña local configurada" }, 400);

  if (!verifyPassword(currentPassword, user.password_hash))
    return json({ error: "La contraseña actual es incorrecta" }, 401);

  const password_hash = hashPassword(newPassword);
  await db`
    UPDATE profiles SET password_hash = ${password_hash}, updated_at = now()
    WHERE id = ${caller.id}
  `;
  return json({ success: true });
}
