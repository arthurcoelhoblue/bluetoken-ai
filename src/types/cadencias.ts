export type CadenceTriggerType = 'MANUAL' | 'STAGE_ENTER' | 'STAGE_EXIT' | 'SLA_BREACH';
export type DealCadenceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface CadenciaCRM {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  empresa: string;
  ativo: boolean;
  canal_principal: string;
  total_steps: number;
  deals_ativos: number;
  deals_completados: number;
  deals_total: number;
  triggers: Array<{
    id: string;
    stage_id: string;
    trigger_type: string;
    is_active: boolean;
  }> | null;
}

export interface DealCadenciaStatus {
  deal_cadence_run_id: string;
  deal_id: string;
  bridge_status: DealCadenceStatus;
  trigger_type: CadenceTriggerType;
  trigger_stage_id: string | null;
  started_at: string;
  cadence_run_id: string;
  cadence_id: string;
  run_status: string;
  last_step_ordem: number;
  next_step_ordem: number | null;
  next_run_at: string | null;
  cadence_nome: string;
  cadence_codigo: string;
  total_steps: number;
  trigger_stage_nome: string | null;
}

export interface CadenceStageTrigger {
  id: string;
  pipeline_id: string;
  stage_id: string;
  cadence_id: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
}

export interface StartDealCadencePayload {
  dealId: string;
  cadenceId: string;
  leadId: string;
  empresa: string;
}
