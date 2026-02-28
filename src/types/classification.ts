// ========================================
// PATCH 4 - Tipos de Classificação Comercial (4 Empresas)
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

// ICPs MPuppe
export type IcpMpuppe =
  | 'MPUPPE_FINTECH_REG'
  | 'MPUPPE_DATA_HEAVY'
  | 'MPUPPE_AI_PIONEER'
  | 'MPUPPE_LEGAL_DEPT'
  | 'MPUPPE_NAO_CLASSIFICADO';

// ICPs Axia
export type IcpAxia =
  | 'AXIA_FINTECH_LAUNCH'
  | 'AXIA_EXCHANGE_BUILDER'
  | 'AXIA_ASSET_TOKENIZER'
  | 'AXIA_MARKETPLACE_PAY'
  | 'AXIA_NAO_CLASSIFICADO';

// ICP unificado
export type ICP = IcpTokeniza | IcpBlue | IcpMpuppe | IcpAxia;

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

// Personas MPuppe
export type PersonaMpuppe =
  | 'FUNDADOR_FINTECH'
  | 'CTO_REGULACAO'
  | 'JURIDICO_CORPORATIVO';

// Personas Axia
export type PersonaAxia =
  | 'EMPREENDEDOR_FINTECH'
  | 'CTO_INFRAESTRUTURA'
  | 'PRODUCT_MANAGER_CRYPTO';

// Persona unificada
export type Persona = PersonaTokeniza | PersonaBlue | PersonaMpuppe | PersonaAxia;

// Resultado da classificação
export interface LeadClassificationResult {
  leadId: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  icp: ICP;
  persona: Persona | null;
  temperatura: Temperatura;
  prioridade: Prioridade;
  scoreInterno: number; // 0-100
}

// Registro de classificação no banco (atualizado PATCH 4.0)
export interface LeadClassification {
  id: string;
  lead_id: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
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
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  nome: string | null;
  primeiro_nome: string | null;
  email: string | null;
  telefone: string | null;
  contact_updated_at: string;

  // Classificação (pode ser null se não classificado)
  classification: LeadClassification | null;
}

// ========================================
// Labels amigáveis para UI (PATCH 4.0 — 4 Empresas)
// ========================================

export const ICP_LABELS: Record<ICP, string> = {
  // Tokeniza
  TOKENIZA_SERIAL: 'Investidor Recorrente',
  TOKENIZA_MEDIO_PRAZO: 'Investidor Estratégico',
  TOKENIZA_EMERGENTE: 'Novo Entusiasta RWA',
  TOKENIZA_ALTO_VOLUME_DIGITAL: 'Investidor Grande Porte',
  TOKENIZA_NAO_CLASSIFICADO: 'Não Classificado',
  // Blue
  BLUE_ALTO_TICKET_IR: 'Investidor Sofisticado',
  BLUE_RECURRENTE: 'Cliente Recorrente',
  BLUE_PERDIDO_RECUPERAVEL: 'Ex-Cliente em Risco',
  BLUE_NAO_CLASSIFICADO: 'Não Classificado',
  // MPuppe
  MPUPPE_FINTECH_REG: 'Fintech em Regulação',
  MPUPPE_DATA_HEAVY: 'Empresa de Dados',
  MPUPPE_AI_PIONEER: 'Pioneiro em IA',
  MPUPPE_LEGAL_DEPT: 'Departamento Jurídico',
  MPUPPE_NAO_CLASSIFICADO: 'Não Classificado',
  // Axia
  AXIA_FINTECH_LAUNCH: 'Fintech em Lançamento',
  AXIA_EXCHANGE_BUILDER: 'Construtor de Exchange',
  AXIA_ASSET_TOKENIZER: 'Tokenizador de Ativos',
  AXIA_MARKETPLACE_PAY: 'Marketplace com Pagamentos',
  AXIA_NAO_CLASSIFICADO: 'Não Classificado',
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
  // MPuppe
  FUNDADOR_FINTECH: 'Fundador de Fintech',
  CTO_REGULACAO: 'CTO em Regulação',
  JURIDICO_CORPORATIVO: 'Jurídico Corporativo',
  // Axia
  EMPREENDEDOR_FINTECH: 'Empreendedor Fintech',
  CTO_INFRAESTRUTURA: 'CTO de Infraestrutura',
  PRODUCT_MANAGER_CRYPTO: 'Product Manager Crypto',
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

export const ICPS_MPUPPE: IcpMpuppe[] = [
  'MPUPPE_FINTECH_REG',
  'MPUPPE_DATA_HEAVY',
  'MPUPPE_AI_PIONEER',
  'MPUPPE_LEGAL_DEPT',
  'MPUPPE_NAO_CLASSIFICADO',
];

export const ICPS_AXIA: IcpAxia[] = [
  'AXIA_FINTECH_LAUNCH',
  'AXIA_EXCHANGE_BUILDER',
  'AXIA_ASSET_TOKENIZER',
  'AXIA_MARKETPLACE_PAY',
  'AXIA_NAO_CLASSIFICADO',
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

export const PERSONAS_MPUPPE: PersonaMpuppe[] = [
  'FUNDADOR_FINTECH',
  'CTO_REGULACAO',
  'JURIDICO_CORPORATIVO',
];

export const PERSONAS_AXIA: PersonaAxia[] = [
  'EMPREENDEDOR_FINTECH',
  'CTO_INFRAESTRUTURA',
  'PRODUCT_MANAGER_CRYPTO',
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
