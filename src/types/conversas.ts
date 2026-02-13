import type { Atendimento } from '@/hooks/useAtendimentos';

export type AtendimentoModo = 'SDR_IA' | 'MANUAL' | 'HIBRIDO';
export type SenderType = 'AMELIA' | 'VENDEDOR' | 'SISTEMA';
export type TakeoverAcao = 'ASSUMIR' | 'DEVOLVER';
export type CopilotContextType = 'LEAD' | 'DEAL' | 'PIPELINE' | 'GERAL';

export interface ConversationModeState {
  modo: AtendimentoModo;
  assumido_por: string | null;
  assumido_em: string | null;
  devolvido_em: string | null;
}

export interface TakeoverLogEntry {
  id: string;
  lead_id: string;
  empresa: string;
  canal: string;
  acao: TakeoverAcao;
  user_id: string;
  motivo: string | null;
  created_at: string;
}

export interface CopilotMessage {
  id: string;
  user_id: string;
  context_type: CopilotContextType;
  context_id: string | null;
  empresa: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface AtendimentoEnhanced extends Atendimento {
  modo: AtendimentoModo;
  assumido_por: string | null;
  assumido_por_nome: string | null;
  tempo_sem_resposta_min: number | null;
  sla_estourado: boolean;
}

export interface SendManualMessagePayload {
  leadId: string;
  empresa: string;
  telefone: string;
  conteudo: string;
  canal?: string;
}
