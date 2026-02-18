// ========================================
// _shared/types.ts — Tipos compartilhados entre Edge Functions
// ========================================

export type EmpresaTipo = 'TOKENIZA' | 'BLUE' | 'MPUPPE' | 'AXIA';
export type CanalTipo = 'WHATSAPP' | 'EMAIL' | 'SMS';
export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';
export type TipoLead = 'INVESTIDOR' | 'CAPTADOR';
export type CadenceRunStatus = 'ATIVA' | 'CONCLUIDA' | 'CANCELADA' | 'PAUSADA';

export interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  primeiro_nome?: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
}

export interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  cadence_id: string;
  status: CadenceRunStatus | string;
  last_step_ordem: number;
  next_step_ordem: number | null;
  next_run_at: string | null;
  started_at: string;
}
