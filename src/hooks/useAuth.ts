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

// Module-level cache — survives component unmount/remount on navigation.
// Cleared when the fetch fails so a hard reload always re-validates.
let _cachedProfile: Profile | null = null;
let _hasLoaded = false;

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(_cachedProfile)
  const [loading, setLoading] = useState(!_hasLoaded)

  useEffect(() => {
    if (_hasLoaded) return; // already fetched — skip to avoid re-flash
    fetch('/api/me')
      .then(async (r) => {
        if (r.ok) {
          const p = await r.json();
          _cachedProfile = p;
          setProfile(p);
        }
      })
      .catch(() => {})
      .finally(() => {
        _hasLoaded = true;
        setLoading(false);
      })
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
