// All data access goes through the local REST API (/api/data/*)
// so this layer runs safely in the browser without any DB driver.

export interface Area {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Evaluation {
  id: string
  title: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  tiempo_limite?: number
  intentos_permitidos?: number
  activa?: boolean
  categorias?: string[]
  config?: any
  fecha_vencimiento?: string | null
  area_id?: string | null
}

export interface Question {
  id: string
  evaluation_id: string | null
  question_text: string
  options: string[]
  correct_answer: string
  created_at: string
  contexto?: string
  categoria?: string
  area?: string
  dificultad?: string
  estado?: string
  justificacion?: string
}

export interface Result {
  id: string
  user_id: string
  evaluation_id: string
  score: number
  answers: Record<string, string | string[]>
  started_at: string
  completed_at: string
}

export interface EvaluationProgress {
  id: string
  user_id: string
  evaluation_id: string
  current_question_index: number
  answers: Record<string, string | string[]>
  time_remaining: number
  question_order: string[]
  started_at: string
  updated_at: string
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const r = await fetch(path, options);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error || r.statusText);
  }
  return r.json();
}

// ── Evaluations CRUD ──────────────────────────────────────────────────────────

export const evaluationsService = {
  async getAll(): Promise<Evaluation[]> {
    return apiFetch('/api/data/evaluations');
  },

  async getActive(): Promise<Evaluation[]> {
    return apiFetch('/api/data/evaluations/active');
  },

  async getById(id: string): Promise<Evaluation> {
    return apiFetch(`/api/data/evaluations/${id}`);
  },

  async create(evaluation: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>): Promise<Evaluation> {
    return apiFetch('/api/data/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evaluation),
    });
  },

  async update(id: string, evaluation: Partial<Evaluation>): Promise<Evaluation> {
    return apiFetch(`/api/data/evaluations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evaluation),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/data/evaluations/${id}`, { method: 'DELETE' });
  },

  async getWithQuestions(id: string): Promise<Evaluation & { questions: Question[] }> {
    return apiFetch(`/api/data/evaluations/${id}/with-questions`);
  },
}

// ── Questions CRUD ────────────────────────────────────────────────────────────

export const questionsService = {
  async getAll(): Promise<Question[]> {
    return apiFetch('/api/data/questions');
  },

  async getByEvaluationId(evaluationId: string): Promise<Question[]> {
    return apiFetch(`/api/data/questions/by-evaluation/${evaluationId}`);
  },

  async create(question: Omit<Question, 'id' | 'created_at'>): Promise<Question> {
    return apiFetch('/api/data/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(question),
    });
  },

  async update(id: string, question: Partial<Question>): Promise<Question> {
    return apiFetch(`/api/data/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(question),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/data/questions/${id}`, { method: 'DELETE' });
  },

  async createBatch(questions: Omit<Question, 'id' | 'created_at'>[]): Promise<Question[]> {
    return apiFetch('/api/data/questions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questions),
    });
  },

  async getByIds(ids: string[] | string): Promise<Question[]> {
    const arr: string[] = Array.isArray(ids) ? ids : (typeof ids === 'string' ? JSON.parse(ids) : []);
    if (arr.length === 0) return [];
    return apiFetch(`/api/data/questions/by-ids?ids=${arr.join(',')}`);
  },

  async getFiltered(filters: {
    categorias?: string[]
    dificultad?: string
  }): Promise<Question[]> {
    const params = new URLSearchParams();
    if (filters.categorias?.length) params.set('categorias', filters.categorias.join(','));
    if (filters.dificultad) params.set('dificultad', filters.dificultad);
    return apiFetch(`/api/data/questions/filtered?${params}`);
  },
}

// ── Results CRUD ──────────────────────────────────────────────────────────────

export const resultsService = {
  async getAll(): Promise<(Result & { evaluations: { title: string; area_id: string | null }, profiles: { full_name: string | null, email: string } })[]> {
    return apiFetch('/api/data/results');
  },

  async getByUserId(userId: string): Promise<(Result & { evaluations: { title: string; created_at: string; categorias: string[] | null } })[]> {
    return apiFetch(`/api/data/results/by-user/${userId}`);
  },

  async getByEvaluationId(evaluationId: string): Promise<(Result & { profiles: { full_name: string | null, email: string } })[]> {
    return apiFetch(`/api/data/results/by-evaluation/${evaluationId}`);
  },

  async create(result: Omit<Result, 'id' | 'completed_at'>): Promise<Result> {
    return apiFetch('/api/data/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
  },

  async getById(id: string): Promise<Result> {
    return apiFetch(`/api/data/results/${id}`);
  },

  async getCountByUserAndEvaluation(userId: string, evaluationId: string): Promise<number> {
    const data: { count: number } = await apiFetch(
      `/api/data/results/count?userId=${encodeURIComponent(userId)}&evalId=${encodeURIComponent(evaluationId)}`
    );
    return data.count;
  },
}

// ── Areas CRUD ────────────────────────────────────────────────────────────────

export const areasService = {
  async getAll(): Promise<Area[]> {
    return apiFetch('/api/data/areas');
  },

  async create(area: Omit<Area, 'id' | 'created_at' | 'updated_at'>): Promise<Area> {
    return apiFetch('/api/data/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    });
  },

  async update(id: string, area: Partial<Pick<Area, 'name' | 'description'>>): Promise<Area> {
    return apiFetch(`/api/data/areas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/data/areas/${id}`, { method: 'DELETE' });
  },
}

// ── Evaluation participants ────────────────────────────────────────────────────

export interface ParticipantProfile {
  id: string
  email: string
  full_name: string | null
  area_id: string | null
  role: 'participant' | 'both'
}

export const evaluationParticipantsService = {
  async getByEvaluationId(evaluationId: string): Promise<string[]> {
    return apiFetch(`/api/data/eval-participants/${evaluationId}`);
  },

  async getByUserId(userId: string): Promise<string[]> {
    return apiFetch(`/api/data/eval-participants/by-user/${userId}`);
  },

  async assign(evaluationId: string, userId: string): Promise<void> {
    await apiFetch('/api/data/eval-participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluationId, userId }),
    });
  },

  async unassign(evaluationId: string, userId: string): Promise<void> {
    await apiFetch('/api/data/eval-participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluationId, userId }),
    });
  },
}

export async function getAllParticipants(): Promise<ParticipantProfile[]> {
  return apiFetch('/api/data/participants');
}

export async function getUniqueCategories(): Promise<string[]> {
  return apiFetch('/api/data/categories');
}

export async function getUniqueAreas(): Promise<string[]> {
  return apiFetch('/api/data/question-areas');
}

// ── Scoring logic (pure, no network calls needed) ────────────────────────────

export type AnswerStatus = "correct" | "partial" | "incorrect";

/**
 * Determines the display status of a single answer using the same logic as
 * calculateQuestionScore so that UI counts always match the stored score.
 */
export function getAnswerStatus(
  question: Question,
  userAnswer: string | string[]
): AnswerStatus {
  const correctAnswers = question.correct_answer.split(",").map((a) => a.trim());
  // Properly handle both array (multi-select from DB) and string (single-select) answers
  const userAnswers = Array.isArray(userAnswer)
    ? userAnswer.map((a) => String(a).trim())
    : String(userAnswer ?? "").split(",").map((a) => a.trim()).filter(Boolean);

  const correctCount = correctAnswers.length;
  const userSelectedCount = userAnswers.length;

  if (userSelectedCount === 0) return "incorrect";

  // Anti-gaming: selected more than the number of correct answers → no credit
  if (userSelectedCount > correctCount) return "incorrect";

  const hasIncorrectAnswer = userAnswers.some((a) => !correctAnswers.includes(a));
  if (hasIncorrectAnswer) return "incorrect";

  // All selected answers are correct
  if (userSelectedCount === correctCount) return "correct";
  return "partial";
}

export function calculateQuestionScore(
  question: Question,
  userAnswer: string | string[],
  questionWeight: number
): number {
  const correctAnswers = question.correct_answer.split(',').map(a => a.trim());
  const userAnswers = Array.isArray(userAnswer)
    ? userAnswer.map(a => String(a).trim())
    : [String(userAnswer).trim()];

  const totalOptions = question.options.length;
  const correctCount = correctAnswers.length;
  const userSelectedCount = userAnswers.length;

  if (userSelectedCount === totalOptions && correctCount !== totalOptions) return 0;
  if (userSelectedCount > correctCount) return 0;

  const hasIncorrectAnswer = userAnswers.some(a => !correctAnswers.includes(a));
  if (hasIncorrectAnswer) return 0;

  const allSelectedAreCorrect = userAnswers.every(a => correctAnswers.includes(a));
  if (allSelectedAreCorrect) {
    if (userSelectedCount === correctCount) return questionWeight;
    return (userSelectedCount / correctCount) * questionWeight;
  }

  return 0;
}

export async function calculateEvaluationScore(
  evaluationId: string,
  userAnswers: Record<string, string | string[]>,
  providedQuestions?: Question[]
): Promise<number> {
  let questions: Question[];

  if (providedQuestions && providedQuestions.length > 0) {
    questions = providedQuestions;
  } else {
    questions = await questionsService.getByEvaluationId(evaluationId);
    if (questions.length === 0) {
      const answeredIds = Object.keys(userAnswers);
      if (answeredIds.length > 0) {
        questions = await questionsService.getByIds(answeredIds);
      }
    }
  }

  if (questions.length === 0) return 0;

  const questionWeight = 100 / questions.length;
  let totalScore = 0;

  for (const question of questions) {
    const userAnswer = userAnswers[question.id];
    if (userAnswer === undefined || userAnswer === null) continue;
    if (Array.isArray(userAnswer) && userAnswer.length === 0) continue;
    if (typeof userAnswer === 'string' && userAnswer === '') continue;
    totalScore += calculateQuestionScore(question, userAnswer, questionWeight);
  }

  return Math.round(totalScore * 100) / 100;
}

// ── Evaluation Progress ───────────────────────────────────────────────────────

export const evaluationProgressService = {
  async getByUserAndEvaluation(userId: string, evaluationId: string): Promise<EvaluationProgress | null> {
    return apiFetch(`/api/data/progress/${userId}/${evaluationId}`);
  },

  async create(progress: Omit<EvaluationProgress, 'id' | 'started_at' | 'updated_at'>): Promise<EvaluationProgress> {
    return apiFetch('/api/data/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    });
  },

  async update(userId: string, evaluationId: string, progress: Partial<EvaluationProgress>): Promise<EvaluationProgress> {
    return apiFetch('/api/data/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, evaluationId, ...progress }),
    });
  },

  async delete(userId: string, evaluationId: string): Promise<void> {
    await apiFetch('/api/data/progress', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, evaluationId }),
    });
  },
}
