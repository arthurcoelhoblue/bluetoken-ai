import { useAuth } from '@/contexts/AuthContext';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';
import { SCREEN_REGISTRY } from '@/config/screenRegistry';

/**
 * Unified admin check that returns true if the user has:
 * 1. Legacy ADMIN role in user_roles table, OR
 * 2. An access profile with edit:true on ALL screens (e.g. "Administrador" / "Super Admin")
 *
 * Reuses cached data from useScreenPermissions (no extra queries).
 */
export function useIsAdmin(): boolean {
  const { roles } = useAuth();
  const { data: permissions } = useScreenPermissions();

  // Legacy role check
  if (roles.includes('ADMIN')) return true;

  // Access profile check: if all screens have edit permission, user is effectively admin
  if (permissions && SCREEN_REGISTRY.length > 0) {
    const allEdit = SCREEN_REGISTRY.every((s) => permissions[s.key]?.edit === true);
    if (allEdit) return true;
  }

  return false;
}
