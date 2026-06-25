import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

type PermissionLevel = 'none' | 'ver' | 'editar' | 'full';
type PermissionsMatrix = Record<string, Record<string, string>>;

// Module-level cache — one fetch per page load across all component instances
let _cache: PermissionsMatrix | null = null;
let _promise: Promise<void> | null = null;

export function useRolePermissions() {
  const { profile, loading: authLoading } = useAuth();
  const [matrix, setMatrix] = useState<PermissionsMatrix>(_cache ?? {});
  const [permLoading, setPermLoading] = useState(!_cache);

  // loading is true until BOTH auth AND permissions are resolved.
  // If permLoading is false (cache hit) but profile is still null,
  // canAccess would incorrectly return false — combining prevents that.
  const loading = permLoading || authLoading;

  useEffect(() => {
    if (_cache) {
      setMatrix(_cache);
      setPermLoading(false);
      return;
    }
    if (!_promise) {
      _promise = fetch('/api/data/role-permissions')
        .then((r) => (r.ok ? r.json() : { matrix: {} }))
        .then((data) => { _cache = data.matrix ?? {}; })
        .catch(() => { _cache = {}; });
    }
    _promise.then(() => {
      setMatrix(_cache!);
      setPermLoading(false);
    });
  }, []);

  const canAccess = useCallback(
    (module: string): boolean => {
      if (!profile) return false;
      // 'both' users inherit admin permissions
      const role = profile.role === 'both' ? 'admin' : profile.role;
      if (role === 'super_admin') return true;
      return (matrix[role]?.[module] ?? 'none') !== 'none';
    },
    [profile?.role, matrix],
  );

  const getLevel = useCallback(
    (module: string): PermissionLevel => {
      if (!profile) return 'none';
      const role = profile.role === 'both' ? 'admin' : profile.role;
      if (role === 'super_admin') return 'full';
      return (matrix[role]?.[module] ?? 'none') as PermissionLevel;
    },
    [profile?.role, matrix],
  );

  return { canAccess, getLevel, loading, permLoading };
}
