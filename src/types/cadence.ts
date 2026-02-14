// ========================================
// Cadence Types (Lead SDR + CRM Deal)
// ========================================

import type { Database } from '@/integrations/supabase/types';
import type { EmpresaTipo, CanalTipo } from '@/types/enums';
import { EMPRESA_LABELS as _EL, CANAL_LABELS as _CL } from '@/types/enums';

// Re-export enums for consumers
export type { EmpresaTipo, CanalTipo };
export const EMPRESA_LABELS = _EL;
export const CANAL_LABELS = _CL;

// Tipos base dos enums do banco
export type CadenceRunStatus = 'ATIVA' | 'CONCLUIDA' | 'CANCELADA' | 'PAUSADA';
export type CadenceEventTipo = 'AGENDADO' | 'DISPARADO' | 'ERRO' | 'RESPOSTA_DETECTADA';

// Labels para exibição
export const CADENCE_RUN_STATUS_LABELS: Record<CadenceRunStatus, string> = {
  ATIVA: 'Ativa',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  PAUSADA: 'Pausada',
};

export const CADENCE_EVENT_TIPO_LABELS: Record<CadenceEventTipo, string> = {
  AGENDADO: 'Agendado',
  DISPARADO: 'Disparado',
  ERRO: 'Erro',
  RESPOSTA_DETECTADA: 'Resposta Detectada',
};

// Códigos de cadências disponíveis
export type CadenceCodigo =
  | 'TOKENIZA_INBOUND_LEAD_NOVO'
  | 'TOKENIZA_MQL_QUENTE'
  | 'BLUE_INBOUND_LEAD_NOVO'
  | 'BLUE_IR_URGENTE';

// Cadência (molde)
export interface Cadence {
  id: string;
  empresa: EmpresaTipo;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  canal_principal: CanalTipo;
  created_at: string;
  updated_at: string;
}

// Cadência com estatísticas
export interface CadenceWithStats extends Cadence {
  total_runs: number;
  runs_ativas: number;
  runs_concluidas: number;
}

// Passo de uma cadência
export interface CadenceStep {
  id: string;
  cadence_id: string;
  ordem: number;
  offset_minutos: number;
  canal: CanalTipo;
  template_codigo: string;
  parar_se_responder: boolean;
  created_at: string;
  updated_at: string;
}

// Step com informações do template
export interface CadenceStepWithTemplate extends CadenceStep {
  template_nome?: string;
  template_conteudo?: string;
}

// Instância de cadência para um lead (run)
export interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  cadence_id: string;
  status: CadenceRunStatus;
  started_at: string;
  last_step_ordem: number;
  next_step_ordem: number | null;
  next_run_at: string | null;
  classification_snapshot: Record<string, unknown> | null;
  fonte_evento_id: string | null;
  created_at: string;
  updated_at: string;
}

// Run com detalhes do lead e cadência
export interface CadenceRunWithDetails extends LeadCadenceRun {
  lead_nome?: string;
  lead_email?: string;
  lead_telefone?: string;
  cadence_nome?: string;
  cadence_codigo?: string;
  cadence_canal?: CanalTipo;
  total_steps?: number;
}

// Evento de log de cadência
export interface LeadCadenceEvent {
  id: string;
  lead_cadence_run_id: string;
  step_ordem: number;
  template_codigo: string;
  tipo_evento: CadenceEventTipo;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

// Evento com informações do step
export interface CadenceEventWithStep extends LeadCadenceEvent {
  step_canal?: CanalTipo;
  step_offset_minutos?: number;
}

// Próxima ação agendada
export interface CadenceNextAction {
  run_id: string;
  lead_id: string;
  lead_nome: string | null;
  lead_email: string | null;
  empresa: EmpresaTipo;
  cadence_id: string;
  cadence_nome: string;
  cadence_codigo: string;
  next_step_ordem: number;
  next_run_at: string;
  canal: CanalTipo;
  template_codigo: string;
  status: CadenceRunStatus;
}

// Resultado da decisão de cadência
export interface CadenceDecisionResult {
  cadenceCodigo: CadenceCodigo | null;
  motivo: string;
}

// Resultado da criação de run
export interface CadenceRunResult {
  success: boolean;
  run?: LeadCadenceRun;
  skipped?: boolean;
  reason?: string;
}

// Filtros para listagem de cadências
export interface CadencesFilters {
  empresa?: EmpresaTipo;
  ativo?: boolean;
  searchTerm?: string;
}

// Filtros para listagem de runs
export interface CadenceRunsFilters {
  empresa?: EmpresaTipo;
  cadence_id?: string;
  status?: CadenceRunStatus;
  dateFrom?: string;
  dateTo?: string;
}

// Filtros para próximas ações
export interface CadenceNextActionsFilters {
  empresa?: EmpresaTipo;
  canal?: CanalTipo;
  cadence_id?: string;
  periodo?: 'hoje' | '24h' | '3dias' | 'semana';
}

// Helper para formatar offset
export function formatOffset(minutos: number): string {
  if (minutos === 0) return 'Imediato';
  if (minutos < 60) return `+${minutos}min`;
  if (minutos < 1440) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `+${horas}h ${mins}min` : `+${horas}h`;
  }
  const dias = Math.floor(minutos / 1440);
  const horasRestantes = Math.floor((minutos % 1440) / 60);
  return horasRestantes > 0 ? `+${dias}d ${horasRestantes}h` : `+${dias}d`;
}

// Helper para cor do status
export function getStatusColor(status: CadenceRunStatus): string {
  switch (status) {
    case 'ATIVA':
      return 'bg-success text-success-foreground';
    case 'CONCLUIDA':
      return 'bg-primary text-primary-foreground';
    case 'PAUSADA':
      return 'bg-warning text-warning-foreground';
    case 'CANCELADA':
      return 'bg-destructive text-destructive-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Helper para ícone do tipo de evento
export function getEventIcon(tipo: CadenceEventTipo): string {
  switch (tipo) {
    case 'AGENDADO':
      return '📅';
    case 'DISPARADO':
      return '✅';
    case 'ERRO':
      return '❌';
    case 'RESPOSTA_DETECTADA':
      return '💬';
    default:
      return '📌';
  }
}

// Helper para ícone do canal
export function getCanalIcon(canal: CanalTipo): string {
  switch (canal) {
    case 'WHATSAPP':
      return '💬';
    case 'EMAIL':
      return '📧';
    case 'SMS':
      return '📱';
    default:
      return '📤';
  }
}

// ========================================
// CRM Deal Cadence Types (formerly cadencias.ts)
// ========================================

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
