import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SCREEN_REGISTRY } from '@/config/screenRegistry';
import { ROLE_PERMISSIONS } from '@/types/auth';
import type { PermissionsMap, ScreenPermission } from '@/types/accessControl';

/**
 * Loads the current user's screen permissions.
 * Priority: access_profiles assignment > legacy role fallback > deny all.
 * ADMIN role always gets full access (hardcoded).
 */
export function useScreenPermissions() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes('ADMIN');

  return useQuery({
    queryKey: ['screen-permissions', user?.id, isAdmin],
    enabled: !!user,
    queryFn: async (): Promise<PermissionsMap> => {
      // ADMIN bypass
      if (isAdmin) {
        return SCREEN_REGISTRY.reduce((acc, s) => {
          acc[s.key] = { view: true, edit: true };
          return acc;
        }, {} as PermissionsMap);
      }

      // Try access_profiles assignment
      const { data: assignment } = await supabase
        .from('user_access_assignments')
        .select('access_profile_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (assignment?.access_profile_id) {
        const { data: profile } = await supabase
          .from('access_profiles')
          .select('permissions')
          .eq('id', assignment.access_profile_id)
          .single();

        if (profile?.permissions) {
          const perms = profile.permissions as unknown as PermissionsMap;
          // Ensure all screens exist
          return SCREEN_REGISTRY.reduce((acc, s) => {
            acc[s.key] = perms[s.key] ?? { view: false, edit: false };
            return acc;
          }, {} as PermissionsMap);
        }
      }

      // Fallback to legacy roles
      return buildPermissionsFromRoles(roles);
    },
    staleTime: 5 * 60 * 1000,
  });
}

function buildPermissionsFromRoles(userRoles: string[]): PermissionsMap {
  const allPerms = userRoles.flatMap(r => ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS] ?? []);
  const hasWildcard = allPerms.includes('*');
  const hasReadAll = allPerms.includes('*:read');

  return SCREEN_REGISTRY.reduce((acc, s) => {
    const canView = hasWildcard || hasReadAll || allPerms.some(p => {
      const [resource] = p.split(':');
      return p === `${s.key}:read` || p === `${s.key}:*` || resource === s.key;
    });
    const canEdit = hasWildcard || allPerms.some(p => {
      const [resource, action] = p.split(':');
      return (resource === s.key && (action === '*' || action === 'write' || action === 'update'));
    });
    // Fallback: if role system doesn't map cleanly, give view access to all for non-restrictive roles
    acc[s.key] = { view: canView || hasReadAll, edit: canEdit };
    return acc;
  }, {} as PermissionsMap);
}

export function useCanView(screenKey: string): boolean {
  const { data: permissions } = useScreenPermissions();
  const { roles } = useAuth();
  if (roles.includes('ADMIN')) return true;
  return permissions?.[screenKey]?.view ?? false;
}

export function useCanEdit(screenKey: string): boolean {
  const { data: permissions } = useScreenPermissions();
  const { roles } = useAuth();
  if (roles.includes('ADMIN')) return true;
  return permissions?.[screenKey]?.edit ?? false;
}
