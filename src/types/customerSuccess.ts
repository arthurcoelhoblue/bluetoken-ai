// CS Module Types - Phase 1

export type CSHealthStatus = 'SAUDAVEL' | 'ATENCAO' | 'EM_RISCO' | 'CRITICO';
export type CSSurveyTipo = 'NPS' | 'CSAT' | 'CES';
export type CSIncidentTipo = 'RECLAMACAO' | 'ATRASO' | 'ERRO_OPERACIONAL' | 'FALHA_COMUNICACAO' | 'INSATISFACAO' | 'SOLICITACAO' | 'OUTRO';
export type CSGravidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type CSIncidentStatus = 'ABERTA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'FECHADA';
export type CSNpsCategoria = 'PROMOTOR' | 'NEUTRO' | 'DETRATOR';

export interface CSCustomer {
  id: string;
  contact_id: string;
  empresa: string;
  csm_id: string | null;
  health_score: number;
  health_status: CSHealthStatus;
  ultimo_nps: number | null;
  nps_categoria: CSNpsCategoria | null;
  ultimo_csat: number | null;
  media_csat: number | null;
  ultimo_contato_em: string | null;
  data_primeiro_ganho: string | null;
  proxima_renovacao: string | null;
  valor_mrr: number;
  risco_churn_pct: number;
  sentiment_score: number | null;
  tags: string[] | null;
  notas_csm: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    foto_url: string | null;
    organization_id: string | null;
  };
  csm?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
}

export interface CSSurvey {
  id: string;
  customer_id: string;
  empresa: string;
  tipo: CSSurveyTipo;
  canal_envio: string;
  pergunta: string | null;
  nota: number | null;
  texto_resposta: string | null;
  sentiment_ia: string | null;
  sentiment_score: number | null;
  keywords_ia: Record<string, unknown> | null;
  contexto_atividade_id: string | null;
  enviado_em: string;
  respondido_em: string | null;
  created_at: string;
  // Joined
  customer?: { id: string; contact?: { nome: string } };
}

export interface CSIncident {
  id: string;
  customer_id: string;
  empresa: string;
  tipo: CSIncidentTipo;
  gravidade: CSGravidade;
  titulo: string;
  descricao: string | null;
  origem: string;
  status: CSIncidentStatus;
  responsavel_id: string | null;
  resolucao: string | null;
  impacto_health: number;
  detectado_por_ia: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  responsavel?: { id: string; nome: string; avatar_url: string | null };
  customer?: { id: string; contact?: { nome: string } };
}

export interface CSHealthLog {
  id: string;
  customer_id: string;
  score: number;
  status: CSHealthStatus;
  dimensoes: {
    nps?: number;
    csat?: number;
    engajamento?: number;
    financeiro?: number;
    tempo?: number;
    sentimento?: number;
  };
  motivo_mudanca: string | null;
  created_at: string;
}

export interface CSPlaybook {
  id: string;
  empresa: string;
  nome: string;
  descricao: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Contract types
export type CSContractStatus = 'ATIVO' | 'RENOVADO' | 'CANCELADO' | 'PENDENTE' | 'VENCIDO';

export interface CSContract {
  id: string;
  customer_id: string;
  empresa: string;
  ano_fiscal: number;
  plano: string;
  valor: number;
  data_contratacao: string | null;
  data_vencimento: string | null;
  status: CSContractStatus;
  renovado_em: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export const contractStatusConfig: Record<CSContractStatus, { label: string; bgClass: string }> = {
  ATIVO: { label: 'Ativo', bgClass: 'bg-green-100 text-green-800' },
  RENOVADO: { label: 'Renovado', bgClass: 'bg-blue-100 text-blue-800' },
  CANCELADO: { label: 'Cancelado', bgClass: 'bg-red-100 text-red-800' },
  PENDENTE: { label: 'Pendente', bgClass: 'bg-yellow-100 text-yellow-800' },
  VENCIDO: { label: 'Vencido', bgClass: 'bg-orange-100 text-orange-800' },
};

// Filter types
export interface CSCustomerFilters {
  empresa?: string;
  health_status?: CSHealthStatus;
  nps_categoria?: CSNpsCategoria;
  csm_id?: string;
  is_active?: boolean;
  search?: string;
  ano_fiscal?: number;
  contrato_status?: CSContractStatus;
  renovacao_de?: string;
  renovacao_ate?: string;
}

// Metrics
export interface CSMetrics {
  total_clientes: number;
  health_medio: number;
  nps_medio: number;
  clientes_em_risco: number;
  renovacoes_30_dias: number;
  churn_rate: number;
}

// Health score color helpers
export const healthStatusConfig: Record<CSHealthStatus, { label: string; color: string; bgClass: string }> = {
  SAUDAVEL: { label: 'Saudável', color: 'hsl(var(--chart-2))', bgClass: 'bg-green-100 text-green-800' },
  ATENCAO: { label: 'Atenção', color: 'hsl(var(--chart-4))', bgClass: 'bg-yellow-100 text-yellow-800' },
  EM_RISCO: { label: 'Em Risco', color: 'hsl(var(--chart-5))', bgClass: 'bg-orange-100 text-orange-800' },
  CRITICO: { label: 'Crítico', color: 'hsl(var(--destructive))', bgClass: 'bg-red-100 text-red-800' },
};

export const gravidadeConfig: Record<CSGravidade, { label: string; bgClass: string }> = {
  BAIXA: { label: 'Baixa', bgClass: 'bg-blue-100 text-blue-800' },
  MEDIA: { label: 'Média', bgClass: 'bg-yellow-100 text-yellow-800' },
  ALTA: { label: 'Alta', bgClass: 'bg-orange-100 text-orange-800' },
  CRITICA: { label: 'Crítica', bgClass: 'bg-red-100 text-red-800' },
};

export const incidentStatusConfig: Record<CSIncidentStatus, { label: string; bgClass: string }> = {
  ABERTA: { label: 'Aberta', bgClass: 'bg-red-100 text-red-800' },
  EM_ANDAMENTO: { label: 'Em Andamento', bgClass: 'bg-blue-100 text-blue-800' },
  RESOLVIDA: { label: 'Resolvida', bgClass: 'bg-green-100 text-green-800' },
  FECHADA: { label: 'Fechada', bgClass: 'bg-muted text-muted-foreground' },
};

export const npsConfig: Record<CSNpsCategoria, { label: string; bgClass: string }> = {
  PROMOTOR: { label: 'Promotor', bgClass: 'bg-green-100 text-green-800' },
  NEUTRO: { label: 'Neutro', bgClass: 'bg-yellow-100 text-yellow-800' },
  DETRATOR: { label: 'Detrator', bgClass: 'bg-red-100 text-red-800' },
};
