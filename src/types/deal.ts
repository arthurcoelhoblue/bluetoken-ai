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
