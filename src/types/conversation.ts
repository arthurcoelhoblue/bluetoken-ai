// ========================================
// PATCH 6 - SDR Conversacional Inteligente
// Tipos de Estado de Conversa & Frameworks de Vendas
// ========================================

// Estados do funil de vendas
export type EstadoFunil =
  | 'SAUDACAO'      // Primeiro contato, apresentação
  | 'DIAGNOSTICO'   // Entendendo necessidades
  | 'QUALIFICACAO'  // Aplicando frameworks
  | 'OBJECOES'      // Tratando objeções
  | 'FECHAMENTO'    // Proposta/conversão
  | 'POS_VENDA';    // Follow-up pós-conversão

// Frameworks de vendas por empresa
export type FrameworkAtivo = 'GPCT' | 'BANT' | 'SPIN' | 'NONE';

// GPCT Framework (Tokeniza - Goals, Plans, Challenges, Timeline)
export interface GPCTState {
  g?: string | null; // Goals - Objetivos do lead
  p?: string | null; // Plans - Planos atuais
  c?: string | null; // Challenges - Desafios/objeções
  t?: string | null; // Timeline - Prazo/urgência
}

// BANT Framework (Tokeniza - Budget, Authority, Need, Timeline)
export interface BANTState {
  b?: string | null; // Budget - Orçamento disponível
  a?: string | null; // Authority - Tomador de decisão
  n?: string | null; // Need - Necessidade real
  t?: string | null; // Timeline - Prazo de decisão
}

// SPIN Framework (Blue - Situation, Problem, Implication, Need-payoff)
export interface SPINState {
  s?: string | null; // Situation - Situação atual
  p?: string | null; // Problem - Problemas identificados
  i?: string | null; // Implication - Implicações dos problemas
  n?: string | null; // Need-payoff - Benefícios da solução
}

// Dados combinados dos frameworks
export interface FrameworkData {
  gpct?: GPCTState;
  bant?: BANTState;
  spin?: SPINState;
}

// Perfil DISC para adaptar comunicação
export type PerfilDISC = 'D' | 'I' | 'S' | 'C';

// Estado completo da conversa
export interface ConversationState {
  id: string;
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  canal: 'WHATSAPP' | 'EMAIL';
  estado_funil: EstadoFunil;
  framework_ativo: FrameworkAtivo;
  framework_data: FrameworkData;
  perfil_disc?: PerfilDISC | null;
  idioma_preferido: 'PT' | 'EN' | 'ES';
  ultima_pergunta_id?: string | null;
  ultimo_contato_em: string;
  created_at: string;
  updated_at: string;
}

// Labels para exibição na UI
export const ESTADO_FUNIL_LABELS: Record<EstadoFunil, string> = {
  SAUDACAO: 'Saudação',
  DIAGNOSTICO: 'Diagnóstico',
  QUALIFICACAO: 'Qualificação',
  OBJECOES: 'Objeções',
  FECHAMENTO: 'Fechamento',
  POS_VENDA: 'Pós-Venda',
};

export const FRAMEWORK_LABELS: Record<FrameworkAtivo, string> = {
  GPCT: 'GPCT (Goals, Plans, Challenges, Timeline)',
  BANT: 'BANT (Budget, Authority, Need, Timeline)',
  SPIN: 'SPIN (Situation, Problem, Implication, Need-payoff)',
  NONE: 'Nenhum',
};

export const DISC_LABELS: Record<PerfilDISC, { nome: string; descricao: string }> = {
  D: { nome: 'Dominante', descricao: 'Direto, objetivo, focado em resultados' },
  I: { nome: 'Influente', descricao: 'Comunicativo, entusiasta, relacional' },
  S: { nome: 'Estável', descricao: 'Paciente, confiável, colaborativo' },
  C: { nome: 'Cauteloso', descricao: 'Analítico, preciso, detalhista' },
};

// Cores para badges de estado
export const ESTADO_FUNIL_COLORS: Record<EstadoFunil, string> = {
  SAUDACAO: 'bg-blue-100 text-blue-800',
  DIAGNOSTICO: 'bg-purple-100 text-purple-800',
  QUALIFICACAO: 'bg-amber-100 text-amber-800',
  OBJECOES: 'bg-orange-100 text-orange-800',
  FECHAMENTO: 'bg-green-100 text-green-800',
  POS_VENDA: 'bg-teal-100 text-teal-800',
};

// Função helper para obter framework padrão por empresa
export function getDefaultFramework(empresa: 'TOKENIZA' | 'BLUE'): FrameworkAtivo {
  return empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
}

// Função helper para calcular completude do framework
export function getFrameworkCompleteness(
  framework: FrameworkAtivo,
  data: FrameworkData
): { filled: number; total: number; percentage: number } {
  let filled = 0;
  let total = 4;

  switch (framework) {
    case 'GPCT':
      if (data.gpct?.g) filled++;
      if (data.gpct?.p) filled++;
      if (data.gpct?.c) filled++;
      if (data.gpct?.t) filled++;
      break;
    case 'BANT':
      if (data.bant?.b) filled++;
      if (data.bant?.a) filled++;
      if (data.bant?.n) filled++;
      if (data.bant?.t) filled++;
      break;
    case 'SPIN':
      if (data.spin?.s) filled++;
      if (data.spin?.p) filled++;
      if (data.spin?.i) filled++;
      if (data.spin?.n) filled++;
      break;
    default:
      total = 0;
  }

  return {
    filled,
    total,
    percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
  };
}
