export interface Pipeline {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  nome: string;
  descricao: string | null;
  is_default: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  nome: string;
  posicao: number;
  cor: string;
  is_won: boolean;
  is_lost: boolean;
  is_priority: boolean;
  sla_minutos: number | null;
  tempo_minimo_dias: number | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineWithStages extends Pipeline {
  pipeline_stages: PipelineStage[];
}

export interface Contact {
  id: string;
  pessoa_id: string | null;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  nome: string;
  email: string | null;
  telefone: string | null;
  owner_id: string | null;
  tags: string[];
  tipo: string;
  canal_origem: string | null;
  legacy_lead_id: string | null;
  notas: string | null;
  organization_id: string | null;
  primeiro_nome: string | null;
  sobrenome: string | null;
  cpf: string | null;
  rg: string | null;
  telegram: string | null;
  endereco: string | null;
  foto_url: string | null;
  is_cliente: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deal {
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
  fechado_em: string | null;
  motivo_perda: string | null;
  motivo_perda_closer: string | null;
  motivo_perda_ia: string | null;
  categoria_perda_closer: string | null;
  categoria_perda_ia: string | null;
  motivo_perda_final: string | null;
  categoria_perda_final: string | null;
  perda_resolvida: boolean;
  perda_resolvida_por: string | null;
  perda_resolvida_em: string | null;
  organization_id: string | null;
  etiqueta: string | null;
  data_ganho: string | null;
  data_perda: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  score_engajamento: number;
  score_intencao: number;
  score_valor: number;
  score_urgencia: number;
  score_probabilidade: number;
  scoring_dimensoes: Record<string, number> | null;
  proxima_acao_sugerida: string | null;
  scoring_updated_at: string | null;
  origem: string | null;
  contexto_sdr: Record<string, unknown> | null;
  stage_origem_id: string | null;
  stage_fechamento_id: string | null;
  status: 'ABERTO' | 'GANHO' | 'PERDIDO';
  created_at: string;
  updated_at: string;
}

export interface DealLossCategory {
  id: string;
  codigo: string;
  label: string;
  descricao: string | null;
  posicao: number;
}

export interface DealWithRelations extends Deal {
  contacts: { id: string; nome: string; email: string | null; telefone: string | null } | null;
  pipeline_stages: { id: string; nome: string; cor: string; is_won: boolean; is_lost: boolean } | null;
  owner: { id: string; nome: string | null; email: string; avatar_url: string | null } | null;
}

export interface DealStageHistory {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_by: string | null;
  tempo_no_stage_anterior_ms: number | null;
  created_at: string;
}

export interface DealFormData {
  titulo: string;
  contact_id: string;
  pipeline_id: string;
  stage_id: string;
  valor?: number;
  owner_id?: string;
  temperatura?: 'FRIO' | 'MORNO' | 'QUENTE';
  canal_origem?: string;
  notas?: string;
  data_previsao_fechamento?: string;
}

export interface DealMoveData {
  dealId: string;
  toStageId: string;
  posicao_kanban: number;
}

export interface KanbanColumn {
  stage: PipelineStage;
  deals: DealWithRelations[];
  totalValor: number;
}

// ========================================
// Deal Activity Types (formerly dealDetail.ts)
// ========================================

export type DealActivityType =
  | 'NOTA' | 'LIGACAO' | 'EMAIL' | 'REUNIAO' | 'TAREFA'
  | 'STAGE_CHANGE' | 'VALOR_CHANGE' | 'GANHO' | 'PERDA' | 'REABERTO'
  | 'CRIACAO' | 'ARQUIVO' | 'WHATSAPP' | 'CADENCIA' | 'OUTRO';

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
  score_probabilidade: number;
  stage_origem_id: string | null;
  stage_fechamento_id: string | null;
  canal_origem: string | null;
  data_previsao_fechamento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
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
  CADENCIA: 'Cadência',
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
  CADENCIA: '⚡',
  OUTRO: '📌',
};
