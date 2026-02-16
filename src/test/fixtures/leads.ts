/**
 * Fixtures de dados de teste para Lead Contacts
 * Alinhado com o schema real da tabela `lead_contacts`
 */

import type { Database } from '@/integrations/supabase/types';

type LeadContact = Database['public']['Tables']['lead_contacts']['Row'];
type LeadContactInsert = Database['public']['Tables']['lead_contacts']['Insert'];

export const mockLeadBase: LeadContactInsert = {
  empresa: 'TOKENIZA',
  lead_id: 'lead-001',
  nome: 'João Silva',
  email: 'joao.silva@example.com',
  telefone: '+5511999887766',
};

export const mockLeadQuente: LeadContactInsert = {
  ...mockLeadBase,
  lead_id: 'lead-002',
  nome: 'Maria Santos',
  email: 'maria.santos@example.com',
  telefone: '+5511988776655',
  score_marketing: 85,
};

export const mockLeadFrio: LeadContactInsert = {
  ...mockLeadBase,
  lead_id: 'lead-003',
  nome: 'Pedro Costa',
  email: 'pedro.costa@example.com',
  telefone: '+5511977665544',
  score_marketing: 35,
};

export const mockLeadBlue: LeadContactInsert = {
  ...mockLeadBase,
  empresa: 'BLUE',
  lead_id: 'lead-004',
  nome: 'Ana Oliveira',
  email: 'ana.oliveira@example.com',
  telefone: '+5511966554433',
};

export const mockLeadWithDetails: LeadContact = {
  id: 'lc-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...mockLeadQuente,
  empresa: 'TOKENIZA',
  lead_id: 'lead-002',
  nome: 'Maria Santos',
  email: 'maria.santos@example.com',
  telefone: '+5511988776655',
  blue_client_id: null,
  chatwoot_agente_atual: null,
  chatwoot_conversas_total: null,
  chatwoot_inbox: null,
  chatwoot_status_atendimento: null,
  chatwoot_tempo_resposta_medio: null,
  contato_internacional: false,
  ddi: '55',
  email_placeholder: false,
  linkedin_cargo: null,
  linkedin_conexoes: null,
  linkedin_empresa: null,
  linkedin_senioridade: null,
  linkedin_setor: null,
  linkedin_url: null,
  mautic_cidade: null,
  mautic_estado: null,
  mautic_first_visit: null,
  numero_nacional: '11999887766',
  opt_out: false,
  opt_out_em: null,
  opt_out_motivo: null,
  origem_telefone: null,
  owner_id: null,
  pessoa_id: null,
  pipedrive_deal_id: null,
  pipedrive_person_id: null,
  primeiro_nome: 'Maria',
  prioridade_marketing: null,
  score_marketing: 85,
  telefone_e164: '+5511988776655',
  telefone_validado_em: null,
  telefone_valido: true,
  tokeniza_investor_id: null,
};

/**
 * Factory para criar lead contacts customizados
 */
export function createMockLead(overrides: Partial<LeadContactInsert> = {}): LeadContactInsert {
  return {
    ...mockLeadBase,
    ...overrides,
  };
}

/**
 * Factory para criar múltiplos lead contacts
 */
export function createMockLeads(count: number, overrides: Partial<LeadContactInsert> = {}): LeadContactInsert[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockLeadBase,
    lead_id: `lead-${i + 1}`,
    nome: `Lead ${i + 1}`,
    email: `lead${i + 1}@example.com`,
    telefone: `+551199${String(i).padStart(7, '0')}`,
    ...overrides,
  }));
}
