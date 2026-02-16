/**
 * Fixtures de dados de teste para Leads
 */

import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];

export const mockLeadBase: LeadInsert = {
  empresa: 'TOKENIZA',
  nome: 'João Silva',
  email: 'joao.silva@example.com',
  telefone: '+5511999887766',
  origem: 'INBOUND',
  stage: 'NOVO',
  temperatura: 'MORNO',
  prioridade: 2,
  score_interno: 65,
};

export const mockLeadQuente: LeadInsert = {
  ...mockLeadBase,
  nome: 'Maria Santos',
  email: 'maria.santos@example.com',
  telefone: '+5511988776655',
  temperatura: 'QUENTE',
  prioridade: 1,
  score_interno: 85,
  stage: 'QUALIFICADO',
};

export const mockLeadFrio: LeadInsert = {
  ...mockLeadBase,
  nome: 'Pedro Costa',
  email: 'pedro.costa@example.com',
  telefone: '+5511977665544',
  temperatura: 'FRIO',
  prioridade: 3,
  score_interno: 35,
  stage: 'NOVO',
};

export const mockLeadBlue: LeadInsert = {
  ...mockLeadBase,
  empresa: 'BLUE',
  nome: 'Ana Oliveira',
  email: 'ana.oliveira@example.com',
  telefone: '+5511966554433',
  origem: 'OUTBOUND',
};

export const mockLeadWithClassification: Lead = {
  id: 'lead-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...mockLeadQuente,
  icp: 'SERIAL',
  persona: 'CEO_TECH',
};

/**
 * Factory para criar leads customizados
 */
export function createMockLead(overrides: Partial<LeadInsert> = {}): LeadInsert {
  return {
    ...mockLeadBase,
    ...overrides,
  };
}

/**
 * Factory para criar múltiplos leads
 */
export function createMockLeads(count: number, overrides: Partial<LeadInsert> = {}): LeadInsert[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockLeadBase,
    nome: `Lead ${i + 1}`,
    email: `lead${i + 1}@example.com`,
    telefone: `+551199${String(i).padStart(7, '0')}`,
    ...overrides,
  }));
}
