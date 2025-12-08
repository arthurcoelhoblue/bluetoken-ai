// ========================================
// PATCH 4 - Tipos de Cadências
// ========================================

import type { Database } from '@/integrations/supabase/types';

// Tipos base dos enums do banco
export type CadenceRunStatus = 'ATIVA' | 'CONCLUIDA' | 'CANCELADA' | 'PAUSADA';
export type CadenceEventTipo = 'AGENDADO' | 'DISPARADO' | 'ERRO' | 'RESPOSTA_DETECTADA';
export type CanalTipo = 'WHATSAPP' | 'EMAIL' | 'SMS';
export type EmpresaTipo = 'TOKENIZA' | 'BLUE';

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
