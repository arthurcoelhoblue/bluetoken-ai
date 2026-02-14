// ========================================
// Enums compartilhados — Single Source of Truth
// ========================================

import type { Database } from '@/integrations/supabase/types';

export type EmpresaTipo = Database['public']['Enums']['empresa_tipo'];
export type CanalTipo = Database['public']['Enums']['canal_tipo'];

export const EMPRESA_LABELS: Record<EmpresaTipo, string> = {
  TOKENIZA: 'Tokeniza',
  BLUE: 'Blue',
};

export const CANAL_LABELS: Record<CanalTipo, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  SMS: 'SMS',
};
