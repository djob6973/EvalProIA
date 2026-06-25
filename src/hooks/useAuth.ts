import { useEffect, useState } from 'react'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'supervisor' | 'leader' | 'participant' | 'both'
  created_at: string
  updated_at: string
  area_id: string | null
}

// Thin wrapper so components see a stable object shape regardless of auth backend.
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

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ data: any; error: { message: string } | null }> => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (r.ok) setProfile(data.profile)
    return { data, error: r.ok ? null : { message: data.error || 'Error al iniciar sesión' } }
  }

  const signOut = async (): Promise<{ error: null }> => {
    await fetch('/api/auth/signout')
    setProfile(null)
    return { error: null }
  }

  // signUp and resetPassword are no longer needed (admin creates users via /api/create-user;
  // on Dokku, Google SSO handles identity). Kept as stubs for interface compatibility.
  const signUp = async (): Promise<{ data: null; error: { message: string } | null }> => ({
    data: null,
    error: { message: 'Use el panel de administración para crear usuarios' },
  })

  const resetPassword = async (): Promise<{ error: null }> => ({ error: null })

  // Expose a synthetic "user" and "session" so existing code that reads user.id
  // or session.user.id continues to work without changes.
  const user = profile ? { id: profile.id, email: profile.email } : null
  const session = profile ? { user } : null

  return {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAdmin: profile ? profile.role !== 'participant' : false,
  }
}
