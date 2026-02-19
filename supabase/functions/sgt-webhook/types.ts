// ========================================
// sgt-webhook/types.ts — Tipos e constantes locais
// Extraído do index.ts (Fase D)
// ========================================

import type { EmpresaTipo as EmpresaTipoShared, Temperatura, TipoLead } from "../_shared/types.ts";
import type { PhoneNormalized } from "../_shared/phone-utils.ts";

// Re-export para uso interno
export type { Temperatura, TipoLead };

// ========================================
// TIPOS - Alinhados com documentação SGT
// ========================================
export type SGTEventoTipo = 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
export type EmpresaTipo = EmpresaTipoShared;
export type PrioridadeMarketing = 'URGENTE' | 'QUENTE' | 'MORNO' | 'FRIO';
export type LeadStage = 'Lead' | 'Contato Iniciado' | 'Negociação' | 'Perdido' | 'Cliente';
export type OrigemTipo = 'INBOUND' | 'OUTBOUND' | 'REFERRAL' | 'PARTNER';
export type Prioridade = 1 | 2 | 3;

export type IcpTokeniza = 'TOKENIZA_SERIAL' | 'TOKENIZA_MEDIO_PRAZO' | 'TOKENIZA_EMERGENTE' | 'TOKENIZA_ALTO_VOLUME_DIGITAL' | 'TOKENIZA_NAO_CLASSIFICADO';
export type IcpBlue = 'BLUE_ALTO_TICKET_IR' | 'BLUE_RECURRENTE' | 'BLUE_PERDIDO_RECUPERAVEL' | 'BLUE_NAO_CLASSIFICADO';
export type ICP = IcpTokeniza | IcpBlue;

export type PersonaTokeniza = 'CONSTRUTOR_PATRIMONIO' | 'COLECIONADOR_DIGITAL' | 'INICIANTE_CAUTELOSO';
export type PersonaBlue = 'CRIPTO_CONTRIBUINTE_URGENTE' | 'CLIENTE_FIEL_RENOVADOR' | 'LEAD_PERDIDO_RECUPERAVEL';
export type Persona = PersonaTokeniza | PersonaBlue | null;

export type CadenceCodigo = 'TOKENIZA_INBOUND_LEAD_NOVO' | 'TOKENIZA_MQL_QUENTE' | 'BLUE_INBOUND_LEAD_NOVO' | 'BLUE_IR_URGENTE';

// ========================================
// INTERFACES
// ========================================
export interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  score?: number;
  stage?: LeadStage | string;
  pipedrive_deal_id?: string;
  url_pipedrive?: string;
  organizacao?: string;
  origem_tipo?: OrigemTipo;
  lead_pago?: boolean;
  data_criacao?: string;
  data_mql?: string;
  data_levantou_mao?: string;
  data_reuniao?: string;
  data_venda?: string;
  valor_venda?: number;
  tipo_lead?: 'INVESTIDOR' | 'CAPTADOR';
}

export interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string | null;
  projetos?: string[];
  carrinho_abandonado?: boolean;
  valor_carrinho?: number;
}

export interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string | null;
  cliente_status?: string;
}

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

export interface DadosLinkedin {
  url?: string;
  cargo?: string;
  empresa?: string;
  setor?: string;
  senioridade?: string;
  conexoes?: number;
}

export interface DadosNotion {
  page_id?: string;
  cliente_status?: string;
  conta_ativa?: boolean;
  ultimo_servico?: string;
  notas?: string;
}

export interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
  tipo_compra?: string;
  referrer?: string;
  device?: string;
  ip_address?: string;
}

export interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  score_temperatura?: number;
  prioridade?: PrioridadeMarketing;
  dados_lead: DadosLead;
  dados_linkedin?: DadosLinkedin;
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
  dados_mautic?: DadosMautic;
  dados_chatwoot?: DadosChatwoot;
  dados_notion?: DadosNotion;
  event_metadata?: EventMetadata;
}

export interface LeadNormalizado {
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  timestamp: Date;
  nome: string;
  nome_original: string;
  campanhas_origem: string[];
  email: string;
  telefone: string | null;
  organizacao: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  score: number;
  stage: LeadStage | null;
  origem_tipo: OrigemTipo | null;
  lead_pago: boolean;
  data_mql: Date | null;
  data_venda: Date | null;
  valor_venda: number | null;
  dados_empresa: DadosTokeniza | DadosBlue | null;
  dados_mautic: DadosMautic | null;
  dados_chatwoot: DadosChatwoot | null;
  dados_notion: DadosNotion | null;
  metadata: EventMetadata | null;
  pipedrive_deal_id: string | null;
  url_pipedrive: string | null;
}

export interface LeadClassificationResult {
  leadId: string;
  empresa: EmpresaTipo;
  icp: ICP;
  persona: Persona;
  temperatura: Temperatura;
  prioridade: Prioridade;
  scoreInterno: number;
}

// ========================================
// TIPOS DE SANITIZAÇÃO
// ========================================
export type LeadContactIssueTipo = 
  | 'SEM_CANAL_CONTATO'
  | 'EMAIL_PLACEHOLDER'
  | 'EMAIL_INVALIDO'
  | 'TELEFONE_LIXO'
  | 'TELEFONE_SEM_WHATSAPP'
  | 'DADO_SUSPEITO';

export interface ContactIssue {
  tipo: LeadContactIssueTipo;
  severidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  mensagem: string;
}

export interface SanitizationResult {
  descartarLead: boolean;
  issues: ContactIssue[];
  phoneInfo: PhoneNormalized | null;
  emailPlaceholder: boolean;
}

export interface ScoreBreakdown {
  base_temperatura: number;
  bonus_icp: number;
  bonus_evento: number;
  bonus_score_externo: number;
  bonus_mautic: number;
  bonus_chatwoot: number;
  bonus_carrinho: number;
  bonus_lead_pago: number;
  ajuste_prioridade: number;
  total: number;
}

// ========================================
// CONSTANTES
// ========================================
export const EVENTOS_VALIDOS: SGTEventoTipo[] = [
  'LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 
  'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'
];

export const EMPRESAS_VALIDAS: EmpresaTipo[] = ['TOKENIZA', 'BLUE'];

export const LEAD_STAGES_VALIDOS: string[] = ['Lead', 'Contato Iniciado', 'Negociação', 'Perdido', 'Cliente'];

export const EVENTOS_QUENTES: SGTEventoTipo[] = ['MQL', 'CARRINHO_ABANDONADO', 'CLIQUE_OFERTA'];
