import { useAuth } from '@/contexts/AuthContext';

/**
 * Simple admin check based on legacy ADMIN role.
 * Access-profile-based admin is handled inside useScreenPermissions.
 * No circular dependency — this hook only reads roles from AuthContext.
 */
export function useIsAdmin(): boolean {
  const { roles } = useAuth();
  return roles.includes('ADMIN');
}
