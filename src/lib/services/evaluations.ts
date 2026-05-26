import { supabase } from '@/lib/supabase'

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

// Evaluations CRUD
export const evaluationsService = {
  async getAll() {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Evaluation[]
  },

  async getById(id: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as Evaluation
  },

  async create(evaluation: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluations')
      .insert(evaluation)
      .select()
      .single()
    
    if (error) throw error
    return data as Evaluation
  },

  async update(id: string, evaluation: Partial<Evaluation>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluations')
      .update(evaluation)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as Evaluation
  },

  async delete(id: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { error } = await supabase
      .from('evaluations')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async getWithQuestions(id: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        questions(*)
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as Evaluation & { questions: Question[] }
  }
}

// Questions CRUD
export const questionsService = {
  async getAll() {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Question[]
  },

  async getByEvaluationId(evaluationId: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('evaluation_id', evaluationId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data as Question[]
  },

  async create(question: Omit<Question, 'id' | 'created_at'>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .insert(question)
      .select()
      .single()
    
    if (error) throw error
    return data as Question
  },

  async update(id: string, question: Partial<Question>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .update(question)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as Question
  },

  async delete(id: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async createBatch(questions: Omit<Question, 'id' | 'created_at'>[]) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select()
    
    if (error) throw error
    return data as Question[]
  },

  async getByIds(ids: string[]) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('id', ids)
    
    if (error) throw error
    return data as Question[]
  }
}

// Results CRUD
export const resultsService = {
  async getAll() {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        evaluations(title),
        profiles(full_name, email)
      `)
      .order('completed_at', { ascending: false })
    
    if (error) throw error
    return data as (Result & { evaluations: { title: string }, profiles: { full_name: string | null, email: string } })[]
  },

  async getByUserId(userId: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        evaluations(title)
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
    
    if (error) throw error
    return data as (Result & { evaluations: { title: string } })[]
  },

  async getByEvaluationId(evaluationId: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        profiles(full_name, email)
      `)
      .eq('evaluation_id', evaluationId)
      .order('completed_at', { ascending: false })
    
    if (error) throw error
    return data as (Result & { profiles: { full_name: string | null, email: string } })[]
  },

  async create(result: Omit<Result, 'id' | 'completed_at'>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('results')
      .insert(result)
      .select()
      .single()
    
    if (error) throw error
    return data as Result
  },

  async getById(id: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as Result
  }
}

// Get unique categories from questions table
export async function getUniqueCategories(): Promise<string[]> {
  if (!supabase) throw new Error('Supabase client not initialized')
  
  const { data, error } = await supabase
    .from('questions')
    .select('categoria')
    .not('categoria', 'is', null)
  
  if (error) throw error
  
  // Extract unique categories
  const categories = [...new Set(data?.map(q => q.categoria).filter(Boolean) || [])]
  return categories.sort()
}

// Calcular puntaje de una pregunta con reglas anti-gaming
export function calculateQuestionScore(
  question: Question,
  userAnswer: string | string[],
  questionWeight: number
): number {
  // Parse correct answers (can be single index or comma-separated for multiple)
  const correctAnswers = question.correct_answer.split(',').map(a => a.trim());
  
  // Parse user answers
  const userAnswers = Array.isArray(userAnswer) 
    ? userAnswer.map(a => String(a).trim())
    : [String(userAnswer).trim()];
  
  const totalOptions = question.options.length;
  const correctCount = correctAnswers.length;
  const userSelectedCount = userAnswers.length;
  
  console.log('=== DEBUG calculateQuestionScore ===');
  console.log('Question ID:', question.id);
  console.log('Correct answers:', correctAnswers);
  console.log('User answer (raw):', userAnswer);
  console.log('User answers (parsed):', userAnswers);
  console.log('Total options:', totalOptions);
  console.log('Correct count:', correctCount);
  console.log('User selected count:', userSelectedCount);
  console.log('Question weight:', questionWeight);
  
  // REGLA 1: Si marca TODAS las opciones y no todas eran correctas → puntos = 0
  if (userSelectedCount === totalOptions && correctCount !== totalOptions) {
    console.log('REGLA 1: Marca todas las opciones pero no todas son correctas → 0');
    return 0;
  }
  
  // REGLA 2: Si marca MÁS opciones que la cantidad de respuestas correctas → puntos = 0
  if (userSelectedCount > correctCount) {
    console.log('REGLA 2: Marca más opciones que correctas → 0');
    return 0;
  }
  
  // REGLA 3: Si marca AL MENOS una respuesta incorrecta → puntos = 0
  const hasIncorrectAnswer = userAnswers.some(answer => !correctAnswers.includes(answer));
  if (hasIncorrectAnswer) {
    console.log('REGLA 3: Marca al menos una respuesta incorrecta → 0');
    return 0;
  }
  
  // REGLA 4: Si todas las opciones marcadas son correctas y NO hay opciones incorrectas seleccionadas
  const allSelectedAreCorrect = userAnswers.every(answer => correctAnswers.includes(answer));
  if (allSelectedAreCorrect && !hasIncorrectAnswer) {
    // Si seleccionó TODAS las respuestas correctas → puntaje completo
    if (userSelectedCount === correctCount) {
      console.log('REGLA 4a: Seleccionó todas las correctas →', questionWeight);
      return questionWeight;
    }
    // Si seleccionó ALGUNAS respuestas correctas → puntaje parcial
    const partialScore = (userSelectedCount / correctCount) * questionWeight;
    console.log('REGLA 4b: Seleccionó algunas correctas →', partialScore);
    return partialScore;
  }
  
  console.log('Por defecto: 0 puntos');
  // Por defecto, 0 puntos
  return 0;
}

// Calcular puntaje total de una evaluación
export async function calculateEvaluationScore(
  evaluationId: string,
  userAnswers: Record<string, string | string[]>,
  providedQuestions?: Question[]
): Promise<number> {
  if (!supabase) throw new Error('Supabase client not initialized')
  
  let questions: Question[];
  
  // Si se proporcionan preguntas, usarlas (para mantener consistencia con IDs)
  if (providedQuestions && providedQuestions.length > 0) {
    questions = providedQuestions;
  } else {
    // Obtener la evaluación
    const evaluation = await evaluationsService.getById(evaluationId);
    
    // Cargar preguntas usando la misma lógica que el quiz
    questions = await questionsService.getByEvaluationId(evaluationId);
    
    // Si no hay preguntas asociadas, cargar del banco de preguntas
    if (questions.length === 0) {
      const allQuestions = await questionsService.getAll();
      
      // Filtrar por categorías si están especificadas
      let filteredQuestions = allQuestions;
      if (evaluation.categorias && evaluation.categorias.length > 0) {
        filteredQuestions = allQuestions.filter(q => 
          q.categoria && evaluation.categorias.includes(q.categoria)
        );
      }
      
      // Filtrar por dificultad si no es "mixto"
      if (evaluation.config?.dificultad && evaluation.config.dificultad !== 'mixto') {
        filteredQuestions = filteredQuestions.filter(q => 
          q.dificultad === evaluation.config.dificultad
        );
      }
      
      // Limitar según num_preguntas
      const numPreguntas = evaluation.config?.num_preguntas || filteredQuestions.length;
      questions = filteredQuestions.slice(0, numPreguntas);
    }
  }
  
  if (questions.length === 0) {
    return 0;
  }
  
  // Calcular peso por pregunta (100% / cantidad de preguntas)
  const questionWeight = 100 / questions.length;
  
  let totalScore = 0;
  
  console.log('=== DEBUG calculateEvaluationScore ===');
  console.log('Evaluation ID:', evaluationId);
  console.log('Questions loaded:', questions.length);
  console.log('Question IDs:', questions.map(q => q.id));
  console.log('User answers keys:', Object.keys(userAnswers));
  console.log('User answers:', userAnswers);
  console.log('Question weight:', questionWeight);
  
  for (const question of questions) {
    const userAnswer = userAnswers[question.id];
    console.log('--- Processing question:', question.id);
    console.log('User answer for this question:', userAnswer);
    
    if (userAnswer === undefined || userAnswer === null) {
      console.log('No answer provided, skipping');
      continue; // No respondió, 0 puntos
    }
    
    // Para arrays, verificar que no esté vacío
    if (Array.isArray(userAnswer) && userAnswer.length === 0) {
      console.log('Empty array, skipping');
      continue; // Array vacío, 0 puntos
    }
    
    // Para strings, verificar que no esté vacío
    if (typeof userAnswer === 'string' && userAnswer === '') {
      console.log('Empty string, skipping');
      continue; // String vacío, 0 puntos
    }
    
    const questionScore = calculateQuestionScore(question, userAnswer, questionWeight);
    console.log('Question score:', questionScore);
    totalScore += questionScore;
  }
  
  console.log('Total score before rounding:', totalScore);
  const finalScore = Math.round(totalScore * 100) / 100;
  console.log('Final score:', finalScore);
  return finalScore; // Redondear a 2 decimales
}

// Evaluation Progress CRUD
export const evaluationProgressService = {
  async getByUserAndEvaluation(userId: string, evaluationId: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluation_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('evaluation_id', evaluationId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data as EvaluationProgress | null
  },

  async create(progress: Omit<EvaluationProgress, 'id' | 'started_at' | 'updated_at'>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluation_progress')
      .insert(progress)
      .select()
      .single()
    
    if (error) throw error
    return data as EvaluationProgress
  },

  async update(userId: string, evaluationId: string, progress: Partial<EvaluationProgress>) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { data, error } = await supabase
      .from('evaluation_progress')
      .update(progress)
      .eq('user_id', userId)
      .eq('evaluation_id', evaluationId)
      .select()
      .single()
    
    if (error) throw error
    return data as EvaluationProgress
  },

  async delete(userId: string, evaluationId: string) {
    if (!supabase) throw new Error('Supabase client not initialized')
    
    const { error } = await supabase
      .from('evaluation_progress')
      .delete()
      .eq('user_id', userId)
      .eq('evaluation_id', evaluationId)
    
    if (error) throw error
  }
}
