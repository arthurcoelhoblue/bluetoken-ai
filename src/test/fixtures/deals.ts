/**
 * Fixtures de dados de teste para Deals
 */

import type { Database } from '@/integrations/supabase/types';

type Deal = Database['public']['Tables']['deals']['Row'];
type DealInsert = Database['public']['Tables']['deals']['Insert'];

export const mockDealBase: DealInsert = {
  empresa: 'TOKENIZA',
  titulo: 'Deal Teste',
  valor: 50000,
  pipeline_id: 'pipeline-123',
  stage_id: 'stage-123',
  contact_id: 'contact-123',
  temperatura: 'MORNO',
  probabilidade: 50,
};

export const mockDealQuente: DealInsert = {
  ...mockDealBase,
  titulo: 'Deal Quente - Fechamento Iminente',
  valor: 100000,
  temperatura: 'QUENTE',
  probabilidade: 85,
};

export const mockDealFrio: DealInsert = {
  ...mockDealBase,
  titulo: 'Deal Frio - Prospecção Inicial',
  valor: 25000,
  temperatura: 'FRIO',
  probabilidade: 20,
};

export const mockDealGanho: Deal = {
  id: 'deal-won-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...mockDealQuente,
  status: 'GANHO',
  data_fechamento: new Date().toISOString(),
  probabilidade: 100,
};

export const mockDealPerdido: Deal = {
  id: 'deal-lost-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...mockDealFrio,
  status: 'PERDIDO',
  data_fechamento: new Date().toISOString(),
  probabilidade: 0,
  motivo_perda: 'Preço alto',
};

/**
 * Factory para criar deals customizados
 */
export function createMockDeal(overrides: Partial<DealInsert> = {}): DealInsert {
  return {
    ...mockDealBase,
    ...overrides,
  };
}

/**
 * Factory para criar múltiplos deals
 */
export function createMockDeals(count: number, overrides: Partial<DealInsert> = {}): DealInsert[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockDealBase,
    titulo: `Deal ${i + 1}`,
    valor: 50000 + (i * 10000),
    ...overrides,
  }));
}
