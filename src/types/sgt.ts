// ========================================
// PATCH 2 - Tipos SGT (Sistema de Gestão de Tráfego)
// ========================================

// Tipos de eventos que o SGT pode enviar
export type SGTEventoTipo =
  | 'LEAD_NOVO'
  | 'ATUALIZACAO'
  | 'CARRINHO_ABANDONADO'
  | 'MQL'
  | 'SCORE_ATUALIZADO'
  | 'CLIQUE_OFERTA'
  | 'FUNIL_ATUALIZADO';

// Empresas suportadas
export type EmpresaTipo = 'TOKENIZA' | 'BLUE';

// Status de processamento de eventos
export type SGTEventStatus = 'RECEBIDO' | 'PROCESSADO' | 'ERRO';

// Stage do lead no funil
export type LeadStage =
  | 'Contato Iniciado'
  | 'Negociação'
  | 'Perdido'
  | 'Cliente';

// Dados base do lead
export interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  score?: number;
  stage?: LeadStage;
}

// Dados específicos da Tokeniza
export interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string;
}

// Dados específicos da Blue
export interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string;
}

// Metadados do evento
export interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
}

// Payload completo do SGT
export interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  dados_lead: DadosLead;
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
  event_metadata?: EventMetadata;
}

// Evento SGT armazenado no banco
export interface SGTEvent {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  payload: SGTPayload;
  idempotency_key: string;
  recebido_em: string;
  processado_em?: string;
  created_at: string;
}

// Log de evento
export interface SGTEventLog {
  id: string;
  event_id: string;
  status: SGTEventStatus;
  mensagem?: string;
  erro_stack?: string;
  created_at: string;
}

// Dados normalizados para processamento interno
export interface LeadNormalizado {
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  timestamp: Date;
  
  // Dados do lead
  nome: string;
  email: string;
  telefone: string | null;
  
  // UTM
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  
  // Score e stage
  score: number;
  stage: LeadStage | null;
  
  // Dados específicos por empresa
  dados_empresa: DadosTokeniza | DadosBlue | null;
  
  // Metadados
  metadata: EventMetadata | null;
}

// Constantes
export const SGT_EVENTOS: SGTEventoTipo[] = [
  'LEAD_NOVO',
  'ATUALIZACAO',
  'CARRINHO_ABANDONADO',
  'MQL',
  'SCORE_ATUALIZADO',
  'CLIQUE_OFERTA',
  'FUNIL_ATUALIZADO',
];

export const EMPRESAS: EmpresaTipo[] = ['TOKENIZA', 'BLUE'];

export const LEAD_STAGES: LeadStage[] = [
  'Contato Iniciado',
  'Negociação',
  'Perdido',
  'Cliente',
];
