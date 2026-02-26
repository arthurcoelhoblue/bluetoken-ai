// ========================================
// Enums compartilhados — Single Source of Truth
// ========================================

import type { Database } from '@/integrations/supabase/types';

export type EmpresaTipo = Database['public']['Enums']['empresa_tipo'];
export type CanalTipo = Database['public']['Enums']['canal_tipo'];

/** Cast string[] from CompanyContext to the DB enum type for Supabase queries */
export function asEmpresaFilter(companies: string[]): EmpresaTipo[] {
  return companies as unknown as EmpresaTipo[];
}

export const EMPRESA_LABELS: Record<string, string> = {
  TOKENIZA: 'Tokeniza',
  BLUE: 'Blue',
  MPUPPE: 'MPuppe',
  AXIA: 'Axia',
};

export const CANAL_LABELS: Record<CanalTipo, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  SMS: 'SMS',
};
