// ========================================
// Projection & Mass Action Types
// (formerly patch12.ts)
// ========================================

export interface StageConversionRate {
  stage_id: string;
  stage_nome: string;
  pipeline_id: string;
  pipeline_nome: string;
  empresa: string;
  total_deals: number;
  deals_ganhos: number;
  taxa_conversao: number;
}

export interface StageProjection {
  stage_id: string;
  stage_nome: string;
  pipeline_id: string;
  pipeline_nome: string;
  empresa: string;
  owner_id: string;
  deals_count: number;
  valor_total: number;
  taxa_conversao: number;
  valor_projetado: number;
}

export type MassActionJobType = 'CADENCIA_MODELO' | 'CAMPANHA_ADHOC';
export type MassActionJobStatus = 'PENDING' | 'GENERATING' | 'PREVIEW' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

export interface MassActionMessagePreview {
  deal_id: string;
  contact_name: string;
  message: string;
  approved: boolean;
}

export interface MassActionJob {
  id: string;
  empresa: string;
  tipo: MassActionJobType;
  status: MassActionJobStatus;
  deal_ids: string[];
  cadence_id: string | null;
  instrucao: string | null;
  canal: string;
  messages_preview: MassActionMessagePreview[];
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  started_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}
