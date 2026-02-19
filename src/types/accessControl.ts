export interface ScreenPermission {
  view: boolean;
  edit: boolean;
}

export type PermissionsMap = Record<string, ScreenPermission>;

export interface AccessProfile {
  id: string;
  nome: string;
  descricao: string | null;
  permissions: PermissionsMap;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UserAccessAssignment {
  id: string;
  user_id: string;
  access_profile_id: string;
  empresa: 'BLUE' | 'TOKENIZA' | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithAccess {
  id: string;
  email: string;
  nome: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_vendedor: boolean;
  /** Membro do time de Sucesso do Cliente */
  is_csm: boolean;
  /** All empresa assignments for this user */
  assignments: UserAccessAssignment[];
  /** Primary profile name (from first assignment) */
  profile_name: string | null;
}

export const DEFAULT_SCREEN_PERMISSION: ScreenPermission = { view: false, edit: false };

export function createEmptyPermissions(screenKeys: string[]): PermissionsMap {
  return screenKeys.reduce((acc, key) => {
    acc[key] = { ...DEFAULT_SCREEN_PERMISSION };
    return acc;
  }, {} as PermissionsMap);
}