export interface Pipeline {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA';
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
  sla_minutos: number | null;
  tempo_minimo_minutos: number | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineWithStages extends Pipeline {
  pipeline_stages: PipelineStage[];
}

export interface Contact {
  id: string;
  pessoa_id: string | null;
  empresa: 'BLUE' | 'TOKENIZA';
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
  stage_origem_id: string | null;
  stage_fechamento_id: string | null;
  status: 'ABERTO' | 'GANHO' | 'PERDIDO';
  created_at: string;
  updated_at: string;
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
