import { useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'participant'
  created_at: string
  updated_at: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        // No setear profile a null inmediatamente, mantener el valor anterior si existe
        // Esto evita que el profile se vuelva null durante recargas de la página
        return
      }
      setProfile(data as Profile)
    } catch (error) {
      console.error('Error fetching profile:', error)
      // No setear profile a null inmediatamente
    }
  }

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ data: any; error: AuthError | null }> => {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase client not available' } as AuthError }
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role: 'admin' | 'participant' = 'participant'
  ): Promise<{ data: any; error: AuthError | null }> => {
    if (!supabase) {
      return { data: null, error: { message: 'Supabase client not available' } as AuthError }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    })
    return { data, error }
  }

  const signOut = async (): Promise<{ error: AuthError | null }> => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } as AuthError }
    }
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (
    email: string
  ): Promise<{ error: AuthError | null }> => {
    if (!supabase) {
      return { error: { message: 'Supabase client not available' } as AuthError }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  return {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAdmin: profile?.role === 'admin',
  }
}
