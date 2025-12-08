// ========================================
// PATCH 3 - Tipos de Classificação Comercial
// ========================================

// Re-exportar tipos comuns do SGT
export type { EmpresaTipo } from './sgt';

// Temperatura do lead
export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';

// Prioridade de atendimento
export type Prioridade = 1 | 2 | 3;

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

// Registro de classificação no banco
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
  classificado_em: string;
  updated_at: string;
}

// Constantes
export const TEMPERATURAS: Temperatura[] = ['FRIO', 'MORNO', 'QUENTE'];

export const PRIORIDADES: Prioridade[] = [1, 2, 3];

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
