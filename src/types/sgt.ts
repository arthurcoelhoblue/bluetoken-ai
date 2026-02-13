// ========================================
// PATCH 2 - Tipos SGT (Sistema de Gestão de Tráfego)
// Atualizado conforme documentação oficial v1.0
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
  | 'Lead'
  | 'Contato Iniciado'
  | 'Negociação'
  | 'Perdido'
  | 'Cliente';

// Origem do lead
export type OrigemTipo = 'INBOUND' | 'OUTBOUND' | 'REFERRAL' | 'PARTNER';

// ========================================
// Dados do Lead (dados_lead)
// ========================================
export interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  
  // UTM parameters
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  
  // Score e stage
  score?: number;
  stage?: LeadStage;
  
  // Pipedrive
  pipedrive_deal_id?: string;
  url_pipedrive?: string;
  
  // Organização e origem
  organizacao?: string;
  origem_tipo?: OrigemTipo;
  lead_pago?: boolean;
  
  // Datas importantes
  data_criacao?: string;
  data_mql?: string;
  data_levantou_mao?: string;
  data_reuniao?: string;
  data_venda?: string;
  
  // Valor
  valor_venda?: number;
}

// ========================================
// Dados Tokeniza (dados_tokeniza)
// ========================================
export interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string;
  
  // Projetos específicos
  projetos?: string[];
  
  // Carrinho abandonado
  carrinho_abandonado?: boolean;
  valor_carrinho?: number;
}

// ========================================
// Dados Blue (dados_blue)
// ========================================
export interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string;
  
  // Status do cliente
  cliente_status?: string;
}

// ========================================
// Dados LinkedIn (dados_linkedin)
// ========================================
export interface DadosLinkedin {
  url?: string;
  cargo?: string;
  empresa?: string;
  setor?: string;
  senioridade?: string;
  conexoes?: number;
}

// ========================================
// Prioridade Marketing do SGT
// ========================================
export type PrioridadeMarketing = 'URGENTE' | 'QUENTE' | 'MORNO' | 'FRIO';

// ========================================
// Dados Mautic (dados_mautic)
// ========================================
export interface DadosMautic {
  contact_id?: number | string;
  score?: number;
  page_hits?: number;
  email_opens?: number;
  email_clicks?: number;
  last_active?: string;
  first_visit?: string;
  tags?: unknown;
  segments?: unknown;
  cidade?: string;
  estado?: string;
}

// ========================================
// Dados Chatwoot (dados_chatwoot)
// ========================================
export interface DadosChatwoot {
  contact_id?: number;
  mensagens_total?: number;
  conversas_total?: number;
  ultima_mensagem_em?: string;
  ultima_conversa?: string;
  status_conversa?: string;
  status_atendimento?: string;
  tempo_resposta_medio?: number;
  agente_atual?: string;
  inbox?: string;
  canal?: string;
}

// ========================================
// Dados Notion (dados_notion)
// ========================================
export interface DadosNotion {
  page_id?: string;
  cliente_status?: string;
  conta_ativa?: boolean;
  ultimo_servico?: string;
  notas?: string;
}

// ========================================
// Metadados do Evento (event_metadata)
// ========================================
export interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
  tipo_compra?: string;
  
  // Dados adicionais de contexto
  referrer?: string;
  device?: string;
  ip_address?: string;
}

// ========================================
// Payload Completo do SGT
// ========================================
export interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  
  // Score de marketing (SGT)
  score_temperatura?: number;
  prioridade?: PrioridadeMarketing;
  
  // Dados obrigatórios
  dados_lead: DadosLead;
  
  // Dados LinkedIn
  dados_linkedin?: DadosLinkedin;
  
  // Dados específicos por empresa
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
  
  // Dados de sistemas externos
  dados_mautic?: DadosMautic;
  dados_chatwoot?: DadosChatwoot;
  dados_notion?: DadosNotion;
  
  // Metadados do evento
  event_metadata?: EventMetadata;
}

// ========================================
// Evento SGT armazenado no banco
// ========================================
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

// ========================================
// Log de evento
// ========================================
export interface SGTEventLog {
  id: string;
  event_id: string;
  status: SGTEventStatus;
  mensagem?: string;
  erro_stack?: string;
  created_at: string;
}

// ========================================
// Dados normalizados para processamento
// ========================================
export interface LeadNormalizado {
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  timestamp: Date;
  
  // Dados do lead
  nome: string;
  email: string;
  telefone: string | null;
  organizacao: string | null;
  
  // UTM
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  
  // Score e stage
  score: number;
  stage: LeadStage | null;
  
  // Origem
  origem_tipo: OrigemTipo | null;
  lead_pago: boolean;
  
  // Datas
  data_mql: Date | null;
  data_venda: Date | null;
  valor_venda: number | null;
  
  // Dados específicos por empresa
  dados_empresa: DadosTokeniza | DadosBlue | null;
  
  // Dados de sistemas externos
  dados_mautic: DadosMautic | null;
  dados_chatwoot: DadosChatwoot | null;
  dados_notion: DadosNotion | null;
  
  // Metadados
  metadata: EventMetadata | null;
  
  // Pipedrive
  pipedrive_deal_id: string | null;
  url_pipedrive: string | null;
}

// ========================================
// Constantes
// ========================================
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
  'Lead',
  'Contato Iniciado',
  'Negociação',
  'Perdido',
  'Cliente',
];

export const ORIGEM_TIPOS: OrigemTipo[] = [
  'INBOUND',
  'OUTBOUND',
  'REFERRAL',
  'PARTNER',
];
