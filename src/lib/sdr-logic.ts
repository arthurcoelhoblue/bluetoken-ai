/**
 * sdr-logic.ts — Pure business logic extracted from SDR edge functions.
 * This file mirrors the logic in:
 *   - supabase/functions/sdr-intent-classifier/index.ts
 *   - supabase/functions/sdr-message-parser/index.ts
 *   - supabase/functions/sdr-action-executor/index.ts
 *
 * Purpose: enable Vitest testing of SDR business rules without Deno/Supabase deps.
 */

// ========================================
// TYPES
// ========================================
export type EmpresaTipo = 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
export type TemperaturaTipo = 'FRIO' | 'MORNO' | 'QUENTE';
export type LeadIntentTipo =
  | 'INTERESSE_COMPRA' | 'INTERESSE_IR' | 'DUVIDA_PRODUTO' | 'DUVIDA_PRECO'
  | 'DUVIDA_TECNICA' | 'SOLICITACAO_CONTATO' | 'AGENDAMENTO_REUNIAO' | 'RECLAMACAO'
  | 'OPT_OUT' | 'OBJECAO_PRECO' | 'OBJECAO_RISCO' | 'SEM_INTERESSE' | 'NAO_ENTENDI'
  | 'CUMPRIMENTO' | 'AGRADECIMENTO' | 'FORA_CONTEXTO' | 'MANUAL_MODE' | 'OUTRO';
export type PerfilDISC = 'D' | 'I' | 'S' | 'C';
export type PerfilInvestidor = 'CONSERVADOR' | 'ARROJADO' | null;
export type ProximaPerguntaTipo =
  | 'SPIN_S' | 'SPIN_P' | 'SPIN_I' | 'SPIN_N'
  | 'GPCT_G' | 'GPCT_P' | 'GPCT_C' | 'GPCT_T'
  | 'BANT_B' | 'BANT_A' | 'BANT_N' | 'BANT_T'
  | 'CTA_REUNIAO' | 'ESCALAR_IMEDIATO' | 'NENHUMA';
export type EstadoFunil = 'SAUDACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO' | 'OBJECOES' | 'FECHAMENTO' | 'POS_VENDA';

// ========================================
// CLASSIFICATION UPGRADE
// ========================================
const HIGH_CONFIDENCE_INTENTS: LeadIntentTipo[] = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'];
const MEDIUM_CONFIDENCE_INTENTS: LeadIntentTipo[] = ['DUVIDA_PRECO', 'DUVIDA_PRODUTO'];

export function computeClassificationUpgrade(input: {
  novaTemperatura: TemperaturaTipo;
  intent: LeadIntentTipo;
  confianca: number;
  icpAtual: string;
  prioridadeAtual: number;
  empresa: EmpresaTipo;
  origem?: string;
}): { prioridade?: number; icp?: string; score_interno?: number } {
  const { novaTemperatura, intent, confianca, icpAtual, prioridadeAtual, empresa, origem } = input;
  const result: { prioridade?: number; icp?: string; score_interno?: number } = {};
  if (origem === 'MANUAL') return result;

  const isHighIntent = HIGH_CONFIDENCE_INTENTS.includes(intent) && confianca >= 0.8;
  const isMediumIntent = MEDIUM_CONFIDENCE_INTENTS.includes(intent) && confianca >= 0.7;

  if (novaTemperatura === 'QUENTE' && isHighIntent) result.prioridade = 1;
  else if (novaTemperatura === 'MORNO' && (isHighIntent || isMediumIntent) && prioridadeAtual > 2) result.prioridade = 2;

  if (icpAtual?.endsWith('_NAO_CLASSIFICADO') && isHighIntent && novaTemperatura !== 'FRIO') {
    result.icp = empresa === 'BLUE' ? 'BLUE_ALTO_TICKET_IR' : 'TOKENIZA_EMERGENTE';
  }

  if (result.prioridade || result.icp) {
    const baseTemp = novaTemperatura === 'QUENTE' ? 30 : novaTemperatura === 'MORNO' ? 15 : 5;
    result.score_interno = baseTemp + (isHighIntent ? 30 : isMediumIntent ? 15 : 0) + (result.icp ? 10 : 0);
  }
  return result;
}

// ========================================
// TEMPERATURE MATRIX
// ========================================
export function computeNewTemperature(intent: LeadIntentTipo, tempAtual: TemperaturaTipo): TemperaturaTipo | null {
  const upgradeIntents: LeadIntentTipo[] = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO', 'DUVIDA_PRECO'];
  const downgradeIntents: LeadIntentTipo[] = ['SEM_INTERESSE', 'OPT_OUT'];
  if (upgradeIntents.includes(intent)) {
    if (tempAtual === 'FRIO') return 'MORNO';
    if (tempAtual === 'MORNO') return 'QUENTE';
  }
  if (downgradeIntents.includes(intent)) {
    if (tempAtual === 'QUENTE') return 'MORNO';
    if (tempAtual === 'MORNO') return 'FRIO';
  }
  return null;
}

// ========================================
// URGENCY DETECTION
// ========================================
const URGENCIA_PATTERNS: Record<string, string[]> = {
  PEDIDO_HUMANO: ['falar com humano', 'falar com alguém', 'atendente', 'atendimento humano', 'pessoa real', 'especialista', 'vocês são robô', 'você é robô', 'quero falar com gente'],
  DECISAO_TOMADA: ['quero contratar', 'quero fechar', 'como pago', 'manda o pix', 'manda o contrato', 'aceito', 'bora', 'to dentro', 'próximo passo', 'onde pago', 'o que preciso enviar', 'quais documentos', 'como começo'],
  URGENCIA_TEMPORAL: ['urgente', 'prazo', 'até amanhã', 'essa semana', 'malha fina', 'multa', 'declaração', 'estou atrasado', 'preciso resolver rápido'],
  FRUSTRADO_ALTERNATIVA: ['já tentei', 'não funcionou', 'não deu certo', 'gastei dinheiro', 'cansei', 'péssima experiência'],
  PEDIDO_REUNIAO_DIRETO: ['quero uma reunião', 'marcar reunião', 'agendar reunião', 'me liga', 'pode me ligar'],
};

export function detectarLeadQuenteImediato(mensagem: string): { detectado: boolean; tipo: string; frase_gatilho: string | null; confianca: string } {
  const msgLower = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const tipo of ['PEDIDO_HUMANO', 'DECISAO_TOMADA', 'URGENCIA_TEMPORAL', 'FRUSTRADO_ALTERNATIVA', 'PEDIDO_REUNIAO_DIRETO']) {
    for (const pattern of URGENCIA_PATTERNS[tipo]) {
      if (msgLower.includes(pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        let confianca = 'MEDIA';
        if (['quero contratar', 'como pago', 'manda o pix', 'falar com humano', 'malha fina'].some(p => msgLower.includes(p))) confianca = 'ALTA';
        return { detectado: true, tipo, frase_gatilho: pattern, confianca };
      }
    }
  }
  return { detectado: false, tipo: 'NENHUM', frase_gatilho: null, confianca: 'BAIXA' };
}

// ========================================
// NEXT QUESTION DECISION
// ========================================
export function decidirProximaPergunta(
  empresa: EmpresaTipo,
  spin: Record<string, string | null | undefined> | null | undefined,
  gpct: Record<string, string | null | undefined> | null | undefined,
  bant: Record<string, string | null | undefined> | null | undefined,
  temperatura: TemperaturaTipo,
  intentAtual?: LeadIntentTipo,
  mensagem?: string,
): { tipo: ProximaPerguntaTipo; urgencia?: ReturnType<typeof detectarLeadQuenteImediato> } {
  const urgencia = mensagem ? detectarLeadQuenteImediato(mensagem) : { detectado: false, tipo: 'NENHUM', frase_gatilho: null, confianca: 'BAIXA' };
  if (urgencia.detectado && (urgencia.confianca === 'ALTA' || urgencia.confianca === 'MEDIA')) {
    return { tipo: 'ESCALAR_IMEDIATO', urgencia };
  }

  let tipo: ProximaPerguntaTipo = 'NENHUMA';

  if (empresa === 'BLUE') {
    if (!spin?.s) tipo = 'SPIN_S';
    else if (!spin?.p) tipo = 'SPIN_P';
    else if (spin?.s && spin?.p && temperatura !== 'FRIO' && ['INTERESSE_IR', 'INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO', 'DUVIDA_PRECO'].includes(intentAtual || '')) tipo = 'CTA_REUNIAO';
    else if (!spin?.i) tipo = 'SPIN_I';
    else if (!spin?.n) tipo = 'SPIN_N';
    else if (['INTERESSE_IR', 'INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO'].includes(intentAtual || '') && temperatura !== 'FRIO') tipo = 'CTA_REUNIAO';
  } else {
    if (!gpct?.g) tipo = 'GPCT_G';
    else if (!gpct?.p) tipo = 'GPCT_P';
    else if (!gpct?.c) tipo = 'GPCT_C';
    else if (!gpct?.t) tipo = 'GPCT_T';
    else if (!bant?.b) tipo = 'BANT_B';
    else if (temperatura !== 'FRIO' && ['INTERESSE_COMPRA', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'].includes(intentAtual || '')) tipo = 'CTA_REUNIAO';
  }

  return { tipo, urgencia };
}

// ========================================
// INVESTOR PROFILE INFERENCE
// ========================================
export function inferirPerfilInvestidor(disc: PerfilDISC | string | null | undefined, mensagem?: string): PerfilInvestidor {
  const conservadorKw = ['segurança', 'seguro', 'garantia', 'risco', 'proteção', 'medo', 'preocupado'];
  const arrojadoKw = ['rentabilidade', 'retorno', 'lucro', 'crescimento', 'oportunidade', 'quanto rende'];
  if (mensagem) {
    const ml = mensagem.toLowerCase();
    const c = conservadorKw.some(k => ml.includes(k));
    const a = arrojadoKw.some(k => ml.includes(k));
    if (c && !a) return 'CONSERVADOR';
    if (a && !c) return 'ARROJADO';
  }
  if (disc === 'D') return 'ARROJADO';
  if (disc === 'C') return 'CONSERVADOR';
  return null;
}

// ========================================
// CROSS-COMPANY INTEREST DETECTION
// ========================================
export function detectCrossCompanyInterest(mensagem: string, empresaAtual: EmpresaTipo): { detected: boolean; targetCompany: EmpresaTipo | null; reason: string } {
  const ml = mensagem.toLowerCase();
  if (empresaAtual === 'BLUE') {
    for (const kw of ['investimento', 'investir', 'tokenizado', 'rentabilidade', 'rendimento', 'aplicar dinheiro', 'renda passiva']) {
      if (ml.includes(kw)) return { detected: true, targetCompany: 'TOKENIZA', reason: `Lead mencionou "${kw}"` };
    }
  }
  if (empresaAtual === 'TOKENIZA') {
    for (const kw of ['imposto de renda', 'declarar cripto', 'receita federal', 'exchange', 'bitcoin', 'declarar']) {
      if (ml.includes(kw)) return { detected: true, targetCompany: 'BLUE', reason: `Lead mencionou "${kw}"` };
    }
  }
  return { detected: false, targetCompany: null, reason: '' };
}

// ========================================
// AI PROVIDER LOGIC (cost + rate limit constants)
// ========================================
export const COST_TABLE: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5':       { input: 0.80   / 1_000_000, output: 4.0   / 1_000_000 },
  'claude-sonnet-4-6':      { input: 3.0    / 1_000_000, output: 15.0  / 1_000_000 },
  'gemini-3-pro-preview':   { input: 1.25   / 1_000_000, output: 10.0  / 1_000_000 },
  'gpt-4o':                 { input: 2.5    / 1_000_000, output: 10.0  / 1_000_000 },
};

export const RATE_LIMITS: Record<string, number> = {
  'copilot-chat': 60,
  'sdr-intent-classifier': 200,
  'sdr-response-generator': 200,
  'deal-scoring': 100,
};
export const DEFAULT_RATE_LIMIT = 100;

export function getRateLimit(functionName: string): number {
  return RATE_LIMITS[functionName] ?? DEFAULT_RATE_LIMIT;
}

export function computeAICost(model: string, tokensInput: number, tokensOutput: number): number {
  const costs = COST_TABLE[model] || { input: 0, output: 0 };
  return (tokensInput * costs.input) + (tokensOutput * costs.output);
}
