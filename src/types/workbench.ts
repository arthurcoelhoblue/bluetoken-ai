export interface WorkbenchTarefa {
  id: string;
  deal_id: string;
  descricao: string | null;
  tarefa_prazo: string | null;
  tarefa_concluida: boolean | null;
  created_at: string;
  deal_titulo: string;
  deal_valor: number | null;
  deal_status: string;
  owner_id: string | null;
  stage_nome: string;
  stage_cor: string;
  contact_nome: string;
  pipeline_nome: string;
  pipeline_empresa: string;
}

export interface WorkbenchSLAAlert {
  deal_id: string;
  deal_titulo: string;
  deal_valor: number | null;
  owner_id: string | null;
  stage_id: string;
  stage_nome: string;
  stage_cor: string;
  sla_minutos: number;
  contact_nome: string;
  pipeline_nome: string;
  pipeline_empresa: string;
  minutos_no_stage: number;
  sla_estourado: boolean;
  sla_percentual: number;
}

export interface WorkbenchPipelineSummary {
  pipeline_id: string;
  pipeline_nome: string;
  pipeline_empresa: string;
  owner_id: string | null;
  deals_abertos: number;
  deals_ganhos: number;
  deals_perdidos: number;
  valor_aberto: number;
  valor_ganho: number;
  valor_perdido: number;
}

export interface RecentDeal {
  id: string;
  titulo: string;
  valor: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  temperatura: string | null;
  contact_nome: string;
  stage_nome: string;
  stage_cor: string;
  pipeline_nome: string;
}
