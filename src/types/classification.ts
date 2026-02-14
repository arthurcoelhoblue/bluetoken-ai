// ========================================
// PATCH 3 - Tipos de Classificação Comercial
// ========================================

// Re-exportar tipos comuns do SGT
export type { EmpresaTipo } from './enums';

// Temperatura do lead
export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';

// Prioridade de atendimento
export type Prioridade = 1 | 2 | 3;

// Origem da classificação (PATCH 3.0)
export type ClassificacaoOrigem = 'AUTOMATICA' | 'MANUAL';

// ICPs Tokeniza
export type IcpTokeniza =
  | 'TOKENIZA_SERIAL'
  | 'TOKENIZA_MEDIO_PRAZO'
  | 'TOKENIZA_EMERGENTE'
  | 'TOKENIZA_ALTO_VOLUME_DIGITAL'
  | 'TOKENIZA_NAO_CLASSIFICADO';

// ICPs Blue
export type IcpBlue =
  | 'BLUE_ALTO_TICKET_IR'
  | 'BLUE_RECURRENTE'
  | 'BLUE_PERDIDO_RECUPERAVEL'
  | 'BLUE_NAO_CLASSIFICADO';

// ICP unificado
export type ICP = IcpTokeniza | IcpBlue;

// Personas Tokeniza
export type PersonaTokeniza =
  | 'CONSTRUTOR_PATRIMONIO'
  | 'COLECIONADOR_DIGITAL'
  | 'INICIANTE_CAUTELOSO';

// Personas Blue
export type PersonaBlue =
  | 'CRIPTO_CONTRIBUINTE_URGENTE'
  | 'CLIENTE_FIEL_RENOVADOR'
  | 'LEAD_PERDIDO_RECUPERAVEL';

// Persona unificada
export type Persona = PersonaTokeniza | PersonaBlue;

// Resultado da classificação
export interface LeadClassificationResult {
  leadId: string;
  empresa: 'TOKENIZA' | 'BLUE';
  icp: ICP;
  persona: Persona | null;
  temperatura: Temperatura;
  prioridade: Prioridade;
  scoreInterno: number; // 0-100
}

// Registro de classificação no banco (atualizado PATCH 3.0)
export interface LeadClassification {
  id: string;
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  icp: ICP;
  persona: Persona | null;
  temperatura: Temperatura;
  prioridade: Prioridade;
  score_interno: number | null;
  fonte_evento_id: string | null;
  fonte_evento_tipo: string | null;
  origem: ClassificacaoOrigem;
  override_por_user_id: string | null;
  override_motivo: string | null;
  classificado_em: string;
  updated_at: string;
  justificativa: ClassificationJustificativa | null;
}

// ========================================
// Justificativa da Classificação (PATCH Explicabilidade)
// ========================================

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

export interface DadosUtilizados {
  evento: string;
  stage: string | null;
  score_externo: number;
  mautic_page_hits: number;
  mautic_email_clicks: number;
  chatwoot_mensagens: number;
  carrinho_abandonado: boolean;
  valor_carrinho: number;
  valor_investido: number;
  qtd_investimentos: number;
  qtd_compras_ir: number;
  ticket_medio: number;
  lead_pago: boolean;
}

export interface ClassificationJustificativa {
  icp_razao: string;
  temperatura_razao: string;
  prioridade_razao: string;
  score_breakdown: ScoreBreakdown;
  dados_utilizados: DadosUtilizados;
}

// Lead com dados de contato e classificação (PATCH 3.0)
export interface LeadWithClassification {
  // Dados de contato
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  nome: string | null;
  primeiro_nome: string | null;
  email: string | null;
  telefone: string | null;
  contact_updated_at: string;

  // Classificação (pode ser null se não classificado)
  classification: LeadClassification | null;
}

// ========================================
// Labels amigáveis para UI (PATCH 3.0)
// ========================================

export const ICP_LABELS: Record<ICP, string> = {
  // Tokeniza
  TOKENIZA_SERIAL: 'Investidor Serial',
  TOKENIZA_MEDIO_PRAZO: 'Investidor Médio Prazo',
  TOKENIZA_EMERGENTE: 'Investidor Emergente',
  TOKENIZA_ALTO_VOLUME_DIGITAL: 'Alto Volume Digital',
  TOKENIZA_NAO_CLASSIFICADO: 'Não Classificado',
  // Blue
  BLUE_ALTO_TICKET_IR: 'Alto Ticket IR',
  BLUE_RECURRENTE: 'Cliente Recorrente',
  BLUE_PERDIDO_RECUPERAVEL: 'Perdido Recuperável',
  BLUE_NAO_CLASSIFICADO: 'Não Classificado',
};

export const PERSONA_LABELS: Record<Persona, string> = {
  // Tokeniza
  CONSTRUTOR_PATRIMONIO: 'Construtor de Patrimônio',
  COLECIONADOR_DIGITAL: 'Colecionador Digital',
  INICIANTE_CAUTELOSO: 'Iniciante Cauteloso',
  // Blue
  CRIPTO_CONTRIBUINTE_URGENTE: 'Cripto Contribuinte Urgente',
  CLIENTE_FIEL_RENOVADOR: 'Cliente Fiel Renovador',
  LEAD_PERDIDO_RECUPERAVEL: 'Lead Perdido Recuperável',
};

export const TEMPERATURA_LABELS: Record<Temperatura, string> = {
  FRIO: 'Frio',
  MORNO: 'Morno',
  QUENTE: 'Quente',
};

export const ORIGEM_LABELS: Record<ClassificacaoOrigem, string> = {
  AUTOMATICA: 'Automática',
  MANUAL: 'Manual',
};

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  1: 'Alta',
  2: 'Média',
  3: 'Baixa',
};

// ========================================
// Constantes
// ========================================

export const TEMPERATURAS: Temperatura[] = ['FRIO', 'MORNO', 'QUENTE'];

export const PRIORIDADES: Prioridade[] = [1, 2, 3];

export const ORIGENS: ClassificacaoOrigem[] = ['AUTOMATICA', 'MANUAL'];

export const ICPS_TOKENIZA: IcpTokeniza[] = [
  'TOKENIZA_SERIAL',
  'TOKENIZA_MEDIO_PRAZO',
  'TOKENIZA_EMERGENTE',
  'TOKENIZA_ALTO_VOLUME_DIGITAL',
  'TOKENIZA_NAO_CLASSIFICADO',
];

export const ICPS_BLUE: IcpBlue[] = [
  'BLUE_ALTO_TICKET_IR',
  'BLUE_RECURRENTE',
  'BLUE_PERDIDO_RECUPERAVEL',
  'BLUE_NAO_CLASSIFICADO',
];

export const PERSONAS_TOKENIZA: PersonaTokeniza[] = [
  'CONSTRUTOR_PATRIMONIO',
  'COLECIONADOR_DIGITAL',
  'INICIANTE_CAUTELOSO',
];

export const PERSONAS_BLUE: PersonaBlue[] = [
  'CRIPTO_CONTRIBUINTE_URGENTE',
  'CLIENTE_FIEL_RENOVADOR',
  'LEAD_PERDIDO_RECUPERAVEL',
];

// Eventos que indicam lead quente
export const EVENTOS_QUENTES = [
  'MQL',
  'CARRINHO_ABANDONADO',
  'CLIQUE_OFERTA',
] as const;

// Stages que indicam lead quente
export const STAGES_QUENTES = [
  'Negociação',
] as const;
