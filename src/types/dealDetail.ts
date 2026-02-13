export type DealActivityType =
  | 'NOTA' | 'LIGACAO' | 'EMAIL' | 'REUNIAO' | 'TAREFA'
  | 'STAGE_CHANGE' | 'VALOR_CHANGE' | 'GANHO' | 'PERDA' | 'REABERTO'
  | 'CRIACAO' | 'ARQUIVO' | 'WHATSAPP' | 'OUTRO';

export interface DealActivity {
  id: string;
  deal_id: string;
  tipo: DealActivityType;
  descricao: string | null;
  metadata: Record<string, unknown>;
  tarefa_concluida: boolean;
  tarefa_prazo: string | null;
  user_id: string | null;
  created_at: string;
  user_nome?: string | null;
  user_avatar?: string | null;
}

export interface DealFullDetail {
  id: string;
  contact_id: string;
  pipeline_id: string;
  stage_id: string;
  titulo: string;
  valor: number;
  moeda: string;
  owner_id: string | null;
  temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
  posicao_kanban: number;
  status: 'ABERTO' | 'GANHO' | 'PERDIDO';
  fechado_em: string | null;
  motivo_perda: string | null;
  motivo_perda_closer: string | null;
  categoria_perda_closer: string | null;
  motivo_perda_ia: string | null;
  categoria_perda_ia: string | null;
  motivo_perda_final: string | null;
  categoria_perda_final: string | null;
  perda_resolvida: boolean;
  organization_id: string | null;
  etiqueta: string | null;
  data_ganho: string | null;
  data_perda: string | null;
  score_engajamento: number;
  score_intencao: number;
  score_valor: number;
  score_urgencia: number;
  stage_origem_id: string | null;
  stage_fechamento_id: string | null;
  canal_origem: string | null;
  data_previsao_fechamento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact_nome: string | null;
  contact_email: string | null;
  contact_telefone: string | null;
  contact_foto_url: string | null;
  org_nome: string | null;
  stage_nome: string | null;
  stage_cor: string | null;
  stage_posicao: number | null;
  stage_is_won: boolean;
  stage_is_lost: boolean;
  sla_minutos: number | null;
  tempo_minimo_dias: number | null;
  pipeline_nome: string | null;
  pipeline_empresa: string | null;
  owner_nome: string | null;
  owner_email: string | null;
  owner_avatar_url: string | null;
  minutos_no_stage: number | null;
}

export interface WinLoseData {
  dealId: string;
  status: 'GANHO' | 'PERDIDO';
  stageId: string;
  motivo_perda?: string;
  categoria_perda_closer?: string;
}

export const ACTIVITY_LABELS: Record<DealActivityType, string> = {
  NOTA: 'Nota',
  LIGACAO: 'Ligação',
  EMAIL: 'E-mail',
  REUNIAO: 'Reunião',
  TAREFA: 'Tarefa',
  STAGE_CHANGE: 'Mudança de estágio',
  VALOR_CHANGE: 'Alteração de valor',
  GANHO: 'Ganho',
  PERDA: 'Perda',
  REABERTO: 'Reaberto',
  CRIACAO: 'Criação',
  ARQUIVO: 'Arquivo',
  WHATSAPP: 'WhatsApp',
  OUTRO: 'Outro',
};

export const ACTIVITY_ICONS: Record<DealActivityType, string> = {
  NOTA: '📝',
  LIGACAO: '📞',
  EMAIL: '📧',
  REUNIAO: '🤝',
  TAREFA: '☑️',
  STAGE_CHANGE: '➡️',
  VALOR_CHANGE: '💰',
  GANHO: '🏆',
  PERDA: '❌',
  REABERTO: '🔄',
  CRIACAO: '✨',
  ARQUIVO: '📎',
  WHATSAPP: '💬',
  OUTRO: '📌',
};
