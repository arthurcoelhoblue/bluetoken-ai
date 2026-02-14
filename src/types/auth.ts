// SDR IA - Tipos de Autenticação e RBAC

export type UserRole = 'ADMIN' | 'CLOSER' | 'MARKETING' | 'AUDITOR' | 'READONLY' | 'SDR_IA';

export interface UserProfile {
  id: string;
  google_id: string | null;
  email: string;
  nome: string | null;
  avatar_url: string | null;
  empresa_id: string | null;
  is_active: boolean;
  is_vendedor: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface AuthUser {
  profile: UserProfile;
  roles: UserRole[];
}

// Permissões por papel
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'], // Acesso total
  CLOSER: ['leads:read', 'leads:update', 'conversations:*', 'calendar:*', 'pipedrive:*'],
  MARKETING: ['leads:read', 'campaigns:*', 'analytics:*', 'reports:read'],
  AUDITOR: ['*:read'], // Somente leitura em tudo
  READONLY: ['dashboard:read'],
  SDR_IA: ['leads:*', 'conversations:*', 'cadences:*', 'sgt:*', 'whatsapp:*'],
};

// Labels amigáveis para os papéis
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  CLOSER: 'Closer',
  MARKETING: 'Marketing',
  AUDITOR: 'Auditor',
  READONLY: 'Somente Leitura',
  SDR_IA: 'SDR IA',
};

// Cores dos badges por papel
export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'badge-admin',
  CLOSER: 'badge-closer',
  MARKETING: 'badge-marketing',
  AUDITOR: 'badge-auditor',
  READONLY: 'badge-readonly',
  SDR_IA: 'bg-gradient-primary text-primary-foreground',
};
