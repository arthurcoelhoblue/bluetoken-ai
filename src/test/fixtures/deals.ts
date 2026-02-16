/**
 * Fixtures de dados de teste para Deals
 * Alinhado com o schema real da tabela `deals` (sem campo `empresa`, sem `probabilidade`)
 */

import type { Database } from '@/integrations/supabase/types';

type Deal = Database['public']['Tables']['deals']['Row'];
type DealInsert = Database['public']['Tables']['deals']['Insert'];

export const mockDealBase: DealInsert = {
  titulo: 'Deal Teste',
  valor: 50000,
  pipeline_id: 'pipeline-123',
  stage_id: 'stage-123',
  contact_id: 'contact-123',
  temperatura: 'MORNO',
  score_probabilidade: 50,
};

export const mockDealQuente: DealInsert = {
  ...mockDealBase,
  titulo: 'Deal Quente - Fechamento Iminente',
  valor: 100000,
  temperatura: 'QUENTE',
  score_probabilidade: 85,
};

export const mockDealFrio: DealInsert = {
  ...mockDealBase,
  titulo: 'Deal Frio - Prospecção Inicial',
  valor: 25000,
  temperatura: 'FRIO',
  score_probabilidade: 20,
};

export const mockDealGanho: Deal = {
  id: 'deal-won-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...mockDealQuente,
  titulo: mockDealQuente.titulo!,
  contact_id: mockDealQuente.contact_id,
  pipeline_id: mockDealQuente.pipeline_id,
  stage_id: mockDealQuente.stage_id,
  status: 'GANHO',
  fechado_em: new Date().toISOString(),
  score_probabilidade: 100,
  posicao_kanban: 0,
  moeda: 'BRL',
  canal_origem: null,
  categoria_perda_closer: null,
  categoria_perda_final: null,
  categoria_perda_ia: null,
  contexto_sdr: null,
  data_ganho: new Date().toISOString(),
  data_perda: null,
  data_previsao_fechamento: null,
  etiqueta: null,
  fbclid: null,
  gclid: null,
  metadata: null,
  motivo_perda: null,
  motivo_perda_closer: null,
  motivo_perda_final: null,
  motivo_perda_ia: null,
  notas: null,
  organization_id: null,
  origem: null,
  owner_id: null,
  perda_resolvida: false,
  perda_resolvida_em: null,
  perda_resolvida_por: null,
  proxima_acao_sugerida: null,
  score_engajamento: 0,
  score_intencao: 0,
  score_urgencia: 0,
  score_valor: 0,
  scoring_dimensoes: null,
  scoring_updated_at: null,
  stage_fechamento_id: null,
  stage_origem_id: null,
  tags: null,
  temperatura: 'QUENTE',
  utm_campaign: null,
  utm_content: null,
  utm_medium: null,
  utm_source: null,
  utm_term: null,
  valor: 100000,
};

export const mockDealPerdido: Deal = {
  ...mockDealGanho,
  id: 'deal-lost-123',
  ...mockDealFrio,
  titulo: mockDealFrio.titulo!,
  contact_id: mockDealFrio.contact_id,
  pipeline_id: mockDealFrio.pipeline_id,
  stage_id: mockDealFrio.stage_id,
  status: 'PERDIDO',
  fechado_em: new Date().toISOString(),
  score_probabilidade: 0,
  motivo_perda: 'Preço alto',
  data_ganho: null,
  data_perda: new Date().toISOString(),
  temperatura: 'FRIO',
  valor: 25000,
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
