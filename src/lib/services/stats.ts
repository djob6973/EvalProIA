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
  async getDashboardStats(): Promise<DashboardStats> {
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    // Get total evaluations
    const { data: evaluations, error: evalError } = await supabase
      .from('evaluations')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })

    if (evalError) throw evalError

    // Get total participants (profiles)
    const { count: totalParticipants, error: participantsError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (participantsError) throw participantsError

    // Get total results
    const { data: results, error: resultsError } = await supabase
      .from('results')
      .select('score, completed_at, evaluation_id, user_id')

    if (resultsError) throw resultsError

    // Get total questions
    const { count: totalQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })

    if (questionsError) throw questionsError

    // Calculate average score
    const averageScore = results && results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0

    // Calculate completion rate (results / participants)
    const completionRate = totalParticipants && totalParticipants > 0
      ? Math.round(((results?.length || 0) / totalParticipants) * 100)
      : 0

    // Get recent evaluations with participant counts and average scores
    const recentEvaluations = await Promise.all(
      (evaluations || []).slice(0, 10).map(async (evaluation) => {
        const { count: participants } = await supabase!
          .from('results')
          .select('*', { count: 'exact', head: true })
          .eq('evaluation_id', evaluation.id)

        const { data: evalResults } = await supabase!
          .from('results')
          .select('score')
          .eq('evaluation_id', evaluation.id)

        const avgScore = evalResults && evalResults.length > 0
          ? Math.round(evalResults.reduce((sum, r) => sum + r.score, 0) / evalResults.length)
          : 0

        return {
          id: evaluation.id,
          title: evaluation.title,
          participants: participants || 0,
          averageScore: avgScore,
          created_at: evaluation.created_at
        }
      })
    )

    // Get recent activity
    const recentActivity: DashboardStats['recentActivity'] = []
    
    // Add recent results
    const recentResults = (results || [])
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 5)

    for (const result of recentResults) {
      const { data: profile } = await supabase!
        .from('profiles')
        .select('full_name')
        .eq('id', result.user_id)
        .single()

      const { data: evaluation } = await supabase!
        .from('evaluations')
        .select('title')
        .eq('id', result.evaluation_id)
        .single()

      recentActivity.push({
        type: 'result',
        text: `${profile?.full_name || 'Participante'} finalizó "${evaluation?.title || 'Evaluación'}"`,
        meta: `Puntaje: ${result.score}%`,
        timestamp: result.completed_at
      })
    }

    // Add recent evaluations
    for (const evaluation of (evaluations || []).slice(0, 3)) {
      recentActivity.push({
        type: 'evaluation',
        text: `Evaluación "${evaluation.title}" creada`,
        meta: 'Nueva evaluación',
        timestamp: evaluation.created_at
      })
    }

    // Sort activity by timestamp
    recentActivity.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return {
      totalEvaluations: evaluations?.length || 0,
      totalParticipants: totalParticipants || 0,
      totalResults: results?.length || 0,
      averageScore,
      completionRate,
      totalQuestions: totalQuestions || 0,
      recentEvaluations,
      recentActivity: recentActivity.slice(0, 8)
    }
  }
}
