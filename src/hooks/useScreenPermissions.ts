import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SCREEN_REGISTRY } from '@/config/screenRegistry';
import { ROLE_PERMISSIONS } from '@/types/auth';
import type { PermissionsMap } from '@/types/accessControl';

const SUPER_ADMIN_PROFILE_ID = 'd82ee44c-2c33-4a05-99be-2cf5451018d4';

/**
 * Loads the current user's screen permissions.
 * Priority: access_profiles assignment > legacy role fallback > deny all.
 * ADMIN role always gets full access (short-circuited here, no extra query).
 */
export function useScreenPermissions() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes('ADMIN');

  return useQuery({
    queryKey: ['screen-permissions', user?.id, roles.join(',')],
    enabled: !!user && roles.length > 0,
    queryFn: async (): Promise<PermissionsMap> => {
      // ADMIN role → full access immediately, no DB call needed
      if (isAdmin) {
        return buildFullAccess();
      }

      // Try access_profiles assignment (with override)
      const { data: assignment } = await supabase
        .from('user_access_assignments')
        .select('access_profile_id, permissions_override')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();

      // Super Admin profile → full access
      if (assignment?.access_profile_id === SUPER_ADMIN_PROFILE_ID) {
        return buildFullAccess();
      }

      const overrideMap = (assignment?.permissions_override as unknown as PermissionsMap) ?? null;

      if (assignment?.access_profile_id) {
        const { data: profile } = await supabase
          .from('access_profiles')
          .select('permissions')
          .eq('id', assignment.access_profile_id)
          .single();

        if (profile?.permissions) {
          const perms = profile.permissions as unknown as PermissionsMap;
          return SCREEN_REGISTRY.reduce((acc, s) => {
            const profilePerm = perms[s.key] ?? { view: false, edit: false };
            const overridePerm = overrideMap?.[s.key];
            acc[s.key] = overridePerm
              ? { view: overridePerm.view, edit: overridePerm.edit }
              : profilePerm;
            return acc;
          }, {} as PermissionsMap);
        }
      }

      // If no profile but has override, use override over fallback
      if (overrideMap) {
        const fallback = buildPermissionsFromRoles(roles);
        return SCREEN_REGISTRY.reduce((acc, s) => {
          const overridePerm = overrideMap[s.key];
          acc[s.key] = overridePerm
            ? { view: overridePerm.view, edit: overridePerm.edit }
            : (fallback[s.key] ?? { view: false, edit: false });
          return acc;
        }, {} as PermissionsMap);
      }

      // Fallback to legacy roles
      return buildPermissionsFromRoles(roles);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function buildFullAccess(): PermissionsMap {
  return SCREEN_REGISTRY.reduce((acc, s) => {
    acc[s.key] = { view: true, edit: true };
    return acc;
  }, {} as PermissionsMap);
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
    acc[s.key] = { view: canView || hasReadAll, edit: canEdit };
    return acc;
  }, {} as PermissionsMap);
}

export function useCanView(screenKey: string): boolean {
  const { roles } = useAuth();
  const { data: permissions } = useScreenPermissions();
  if (roles.includes('ADMIN')) return true;
  return permissions?.[screenKey]?.view ?? false;
}

export function useCanEdit(screenKey: string): boolean {
  const { roles } = useAuth();
  const { data: permissions } = useScreenPermissions();
  if (roles.includes('ADMIN')) return true;
  return permissions?.[screenKey]?.edit ?? false;
}
