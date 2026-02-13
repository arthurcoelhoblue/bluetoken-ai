export interface AnalyticsFunnel {
  stage_id: string;
  stage_nome: string;
  posicao: number;
  pipeline_id: string;
  pipeline_nome: string;
  empresa: string;
  deals_ativos: number;
  deals_count: number;
  deals_valor: number;
  tempo_medio_min: number;
}

export interface AnalyticsConversion {
  pipeline_id: string;
  pipeline_nome: string;
  empresa: string;
  total_deals: number;
  deals_ganhos: number;
  deals_perdidos: number;
  deals_abertos: number;
  valor_ganho: number;
  valor_pipeline_aberto: number;
  win_rate: number;
  ticket_medio_ganho: number;
  ciclo_medio_dias: number;
}

export interface AnalyticsVendedor {
  user_id: string;
  vendedor_nome: string;
  empresa: string;
  total_deals: number;
  deals_ganhos: number;
  deals_perdidos: number;
  deals_abertos: number;
  valor_ganho: number;
  win_rate: number;
  atividades_7d: number;
}

export interface AnalyticsPeriodo {
  mes: string;
  empresa: string;
  pipeline_id: string;
  total_deals: number;
  deals_ganhos: number;
  deals_perdidos: number;
  valor_ganho: number;
  valor_perdido: number;
}

export interface AnalyticsMotivosPerda {
  motivo: string;
  categoria: string;
  empresa: string;
  pipeline_id: string;
  quantidade: number;
  valor_perdido: number;
}

export interface AnalyticsCanalOrigem {
  canal: string;
  empresa: string;
  pipeline_id: string;
  total_deals: number;
  deals_ganhos: number;
  deals_perdidos: number;
  valor_ganho: number;
  win_rate: number;
}
