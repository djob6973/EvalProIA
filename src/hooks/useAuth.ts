import { useEffect, useState } from 'react'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'supervisor' | 'leader' | 'participant' | 'both' | 'Pendiente'
  created_at: string
  updated_at: string
  area_id: string | null
}

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(async (r) => {
        if (r.ok) setProfile(await r.json())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Expose a synthetic "user" so existing code that reads user.id or user.email continues to work.
  const user = profile ? { id: profile.id, email: profile.email } : null

  return {
    user,
    profile,
    loading,
    isAdmin: profile ? profile.role !== 'participant' && profile.role !== 'Pendiente' : false,
  }
}
