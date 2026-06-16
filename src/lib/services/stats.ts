import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  totalEvaluations: number
  totalParticipants: number
  totalResults: number
  averageScore: number
  completionRate: number
  totalQuestions: number
  recentEvaluations: Array<{
    id: string
    title: string
    participants: number
    averageScore: number
    created_at: string
  }>
  recentActivity: Array<{
    type: 'result' | 'evaluation'
    text: string
    meta: string
    timestamp: string
  }>
}

export const statsService = {
  // Dedicated activity feed — lighter than getDashboardStats() and supports
  // arbitrary limits for the full activity log page.
  async getRecentActivity(limit = 50): Promise<DashboardStats['recentActivity']> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const [
      { data: recentResultsRaw, error: resultsError },
      { data: recentEvaluationsRaw, error: evalsError },
    ] = await Promise.all([
      supabase
        .from('results')
        .select('score, completed_at, profiles(full_name), evaluations(title)')
        .order('completed_at', { ascending: false })
        .limit(limit),
      supabase
        .from('evaluations')
        .select('title, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 2)),
    ])

    if (resultsError) throw resultsError
    if (evalsError) throw evalsError

    const activity: DashboardStats['recentActivity'] = []

    for (const result of (recentResultsRaw || [])) {
      const profileData = (result as any).profiles
      const evaluationData = (result as any).evaluations
      activity.push({
        type: 'result',
        text: `${profileData?.full_name || 'Participante'} finalizó "${evaluationData?.title || 'Evaluación'}"`,
        meta: `Puntaje: ${result.score}%`,
        timestamp: result.completed_at,
      })
    }

    for (const evaluation of (recentEvaluationsRaw || [])) {
      activity.push({
        type: 'evaluation',
        text: `Evaluación "${evaluation.title}" creada`,
        meta: 'Nueva evaluación',
        timestamp: evaluation.created_at,
      })
    }

    activity.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return activity.slice(0, limit)
  },
  async getDashboardStats(): Promise<DashboardStats> {
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    // Run all independent queries in parallel — was 35+ sequential queries, now 5 parallel
    const [
      { count: totalEvaluations, error: evalCountError },
      { data: recentEvaluationsRaw, error: recentEvalError },
      { count: totalParticipants, error: participantsError },
      { data: resultsData, count: totalResults, error: resultsError },
      { count: totalQuestions, error: questionsError },
      { data: recentResultsRaw, error: recentResultsError },
    ] = await Promise.all([
      // 1. Total evaluations count (HEAD — no data transfer)
      supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true }),

      // 2. Last 10 evaluations with nested results for avg/count — replaces 20 N+1 queries
      supabase
        .from('evaluations')
        .select('id, title, created_at, results(score)')
        .order('created_at', { ascending: false })
        .limit(10),

      // 3. Total participants count (HEAD)
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }),

      // 4. All result scores for global average (only the score column)
      supabase
        .from('results')
        .select('score', { count: 'exact' }),

      // 5. Total questions count (HEAD)
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true }),

      // 6. Recent results with joined names — replaces 10 N+1 queries
      supabase
        .from('results')
        .select('score, completed_at, user_id, evaluation_id, profiles(full_name), evaluations(title)')
        .order('completed_at', { ascending: false })
        .limit(5),
    ])

    if (evalCountError) throw evalCountError
    if (recentEvalError) throw recentEvalError
    if (participantsError) throw participantsError
    if (resultsError) throw resultsError
    if (questionsError) throw questionsError
    if (recentResultsError) throw recentResultsError

    const totalResultsCount = totalResults || 0
    const averageScore = totalResultsCount > 0 && resultsData
      ? Math.round(resultsData.reduce((sum, r) => sum + r.score, 0) / totalResultsCount)
      : 0

    const completionRate = totalParticipants && totalParticipants > 0
      ? Math.round((totalResultsCount / totalParticipants) * 100)
      : 0

    // Build recentEvaluations from nested results — zero extra queries
    const recentEvaluations = (recentEvaluationsRaw || []).map((evaluation: any) => {
      const evalResults: Array<{ score: number }> = evaluation.results || []
      const participants = evalResults.length
      const avgScore = participants > 0
        ? Math.round(evalResults.reduce((sum, r) => sum + r.score, 0) / participants)
        : 0
      return {
        id: evaluation.id,
        title: evaluation.title,
        participants,
        averageScore: avgScore,
        created_at: evaluation.created_at,
      }
    })

    // Build activity from joined data — zero extra queries
    const recentActivity: DashboardStats['recentActivity'] = []

    for (const result of (recentResultsRaw || [])) {
      const profileData = (result as any).profiles
      const evaluationData = (result as any).evaluations
      recentActivity.push({
        type: 'result',
        text: `${profileData?.full_name || 'Participante'} finalizó "${evaluationData?.title || 'Evaluación'}"`,
        meta: `Puntaje: ${result.score}%`,
        timestamp: result.completed_at,
      })
    }

    // Add recent evaluations to activity feed
    for (const evaluation of (recentEvaluationsRaw || []).slice(0, 3)) {
      recentActivity.push({
        type: 'evaluation',
        text: `Evaluación "${evaluation.title}" creada`,
        meta: 'Nueva evaluación',
        timestamp: evaluation.created_at,
      })
    }

    recentActivity.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return {
      totalEvaluations: totalEvaluations || 0,
      totalParticipants: totalParticipants || 0,
      totalResults: totalResultsCount,
      averageScore,
      completionRate,
      totalQuestions: totalQuestions || 0,
      recentEvaluations,
      recentActivity: recentActivity.slice(0, 8),
    }
  },
}
