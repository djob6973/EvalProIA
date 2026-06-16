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

async function apiFetch(path: string): Promise<any> {
  const r = await fetch(path);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error || r.statusText);
  }
  return r.json();
}

export const statsService = {
  async getRecentActivity(limit = 50): Promise<DashboardStats['recentActivity']> {
    return apiFetch(`/api/data/stats/activity?limit=${limit}`);
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return apiFetch('/api/data/stats/dashboard');
  },
}
