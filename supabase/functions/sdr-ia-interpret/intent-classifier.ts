// ========================================
// INTENT CLASSIFIER MODULE — Extracted from sdr-intent-classifier Edge Function
// Full monolith logic: pricing, product knowledge, SPIN/GPCT/BANT, DISC, A/B testing
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('sdr-intent-classifier');

// ========================================
// TYPES
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type TemperaturaTipo = 'FRIO' | 'MORNO' | 'QUENTE';
type LeadIntentTipo = 'INTERESSE_COMPRA' | 'INTERESSE_IR' | 'DUVIDA_PRODUTO' | 'DUVIDA_PRECO' | 'DUVIDA_TECNICA' | 'SOLICITACAO_CONTATO' | 'AGENDAMENTO_REUNIAO' | 'RECLAMACAO' | 'OPT_OUT' | 'OBJECAO_PRECO' | 'OBJECAO_RISCO' | 'SEM_INTERESSE' | 'NAO_ENTENDI' | 'CUMPRIMENTO' | 'AGRADECIMENTO' | 'FORA_CONTEXTO' | 'MANUAL_MODE' | 'OUTRO';
type SdrAcaoTipo = 'PAUSAR_CADENCIA' | 'CANCELAR_CADENCIA' | 'RETOMAR_CADENCIA' | 'AJUSTAR_TEMPERATURA' | 'CRIAR_TAREFA_CLOSER' | 'MARCAR_OPT_OUT' | 'NENHUMA' | 'ESCALAR_HUMANO' | 'ENVIAR_RESPOSTA_AUTOMATICA' | 'DESQUALIFICAR_LEAD';
type EstadoFunil = 'SAUDACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO' | 'OBJECOES' | 'FECHAMENTO' | 'POS_VENDA';
type FrameworkTipo = 'GPCT' | 'BANT' | 'SPIN' | 'NONE';
type PerfilDISC = 'D' | 'I' | 'S' | 'C';
type CanalConversa = 'WHATSAPP' | 'EMAIL';
type PerfilInvestidor = 'CONSERVADOR' | 'ARROJADO' | null;
type ProximaPerguntaTipo = 'SPIN_S' | 'SPIN_P' | 'SPIN_I' | 'SPIN_N' | 'GPCT_G' | 'GPCT_P' | 'GPCT_C' | 'GPCT_T' | 'BANT_B' | 'BANT_A' | 'BANT_N' | 'BANT_T' | 'CTA_REUNIAO' | 'ESCALAR_IMEDIATO' | 'NENHUMA';

interface FrameworkData {
  gpct?: { g?: string | null; p?: string | null; c?: string | null; t?: string | null };
  bant?: { b?: string | null; a?: string | null; n?: string | null; t?: string | null };
  spin?: { s?: string | null; p?: string | null; i?: string | null; n?: string | null };
}

interface FrameworkSubKeys { [key: string]: string | null; }

interface UrgenciaResult { detectado: boolean; tipo: string; frase_gatilho: string | null; confianca: string; }

interface ProximaPerguntaResult { tipo: ProximaPerguntaTipo; instrucao: string; urgencia?: UrgenciaResult; }

interface TokenizaOffer { nome: string; empresa: string; rentabilidade: string; duracaoDias: number; diasRestantes: number; contribuicaoMinima: number; status?: string; }

interface HistoricoMsg { direcao: string; conteudo: string; }

export interface ClassifierResult {
  intent: string;
  confidence: number;
  summary?: string;
  resumo?: string;
  acao?: string;
  acao_recomendada?: string;
  acao_detalhes?: Record<string, unknown>;
  deve_responder?: boolean;
  resposta_sugerida?: string;
  sentimento?: string;
  novo_estado_funil?: string;
  frameworks_atualizados?: Record<string, unknown>;
  disc_estimado?: string | null;
  ultima_pergunta_id?: string | null;
  departamento_destino?: string | null;
  provider?: string;
  model?: string;
  classification_upgrade?: Record<string, unknown>;
  proxima_pergunta?: ProximaPerguntaResult;
  urgencia_detectada?: UrgenciaResult;
  perfil_investidor_inferido?: PerfilInvestidor;
  cross_company?: { detected: boolean; targetCompany: EmpresaTipo | null; reason: string };
}

// ========================================
// BLUE PRICING TABLE
// ========================================
const BLUE_PRICING = {
  planos: [
    { nome: 'IR Cripto - Plano Gold', preco: 'R$ 4.497/ano-fiscal', descricao: 'Apuração ILIMITADA de carteiras/exchanges, até 25k transações POR ANO FISCAL' },
    { nome: 'IR Cripto - Plano Diamond', preco: 'R$ 2.997/ano-fiscal', descricao: 'Até 4 carteiras/exchanges, até 25k transações POR ANO FISCAL' },
    { nome: 'IR Cripto - Customizado', preco: 'R$ 998/ano-fiscal', descricao: 'Até 4 carteiras/exchanges, até 2k transações/ano (uso interno, não divulgar)' },
  ],
  adicionais: [
    { nome: 'Pacote +5.000 operações', preco: 'R$ 500' },
    { nome: 'Apuração de dependente', preco: 'R$ 500/dependente' },
    { nome: 'Upgrade Diamond → Gold', preco: 'R$ 1.500' },
    { nome: 'IR Simples (sem cripto)', preco: 'R$ 300' },
  ],
  pagamento: { formas: 'PIX à vista, criptomoedas, ou cartão até 12x sem juros', descontoPix: '15%', descontoCartao: '10%' },
};

const TOKENIZA_KNOWLEDGE = {
  oQueE: { definicao: 'Plataforma brasileira de investimentos tokenizados regulada pela CVM 88', modelo: 'Conecta investidores a captadores com garantias reais' },
  produtoInvestidor: { tipo: 'Investimentos tokenizados lastreados em garantia real', lastros: ['Imóveis', 'Recebíveis', 'Contratos firmados', 'Alienação fiduciária'] },
  garantias: { tipos: ['Alienação fiduciária de imóvel', 'Cessão fiduciária de recebíveis', 'Caução', 'Penhor'] },
  diferenciais: ['Operações com garantia real', 'Plataforma regulada pela CVM 88', 'Transparência e lastro claro', 'Due diligence completa'],
};

const CHANNEL_RULES: Record<string, string> = {
  WHATSAPP: `REGRAS WHATSAPP: Mensagens CURTAS (2-4 linhas). Tom conversacional. UMA pergunta por mensagem. PROIBIDO: blocos longos, listas extensas, múltiplas perguntas.`,
  EMAIL: `REGRAS EMAIL: Mensagens ESTRUTURADAS. Tom consultivo e profissional. Máx 3-4 parágrafos. Estrutura: retomada breve → conteúdo principal → próximo passo claro.`
};

function getDiscToneInstruction(disc: PerfilDISC | null | undefined): string | null {
  if (!disc) return null;
  const instrucoes: Record<PerfilDISC, string> = {
    'D': `DISC D: Seja DIRETO e objetivo. Foque em RESULTADOS. Mensagens CURTAS.`,
    'I': `DISC I: Seja AMIGÁVEL. Use HISTÓRIAS e exemplos. Conecte emocionalmente.`,
    'S': `DISC S: Seja CALMO. Enfatize SEGURANÇA. Não apresse decisão.`,
    'C': `DISC C: Seja PRECISO. Forneça NÚMEROS, prazos, comparativos.`,
  };
  return instrucoes[disc] || null;
}

function inferirPerfilInvestidor(disc: PerfilDISC | null | undefined, mensagem?: string): PerfilInvestidor {
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

function normalizeKey(rawKey: string): string {
  return rawKey
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const FRAMEWORK_ALIASES: Record<'spin' | 'gpct' | 'bant', Record<string, string>> = {
  spin: {
    s: 's', situacao: 's', contexto: 's',
    p: 'p', problema: 'p', dor: 'p', dificuldade: 'p',
    i: 'i', implicacao: 'i', impacto: 'i', risco: 'i',
    n: 'n', necessidade: 'n', necessidade_solucao: 'n', need_payoff: 'n', solucao: 'n',
  },
  gpct: {
    g: 'g', goals: 'g', goal: 'g', objetivo: 'g', objetivos: 'g',
    p: 'p', plans: 'p', plan: 'p', plano: 'p',
    c: 'c', challenge: 'c', challenges: 'c', desafio: 'c', desafios: 'c',
    t: 't', timeline: 't', prazo: 't', tempo: 't',
  },
  bant: {
    b: 'b', budget: 'b', orcamento: 'b',
    a: 'a', authority: 'a', decisor: 'a',
    n: 'n', need: 'n', necessidade: 'n',
    t: 't', timing: 't', prazo: 't', tempo: 't',
  },
};

function normalizeSubKeys(obj: unknown, framework: 'spin' | 'gpct' | 'bant'): FrameworkSubKeys {
  if (!obj || typeof obj !== 'object') return {};
  const aliases = FRAMEWORK_ALIASES[framework];
  const result: FrameworkSubKeys = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const normalized = normalizeKey(key);
    const canonical = aliases[normalized] || normalized;
    result[canonical] = value as string | null;
  }

  return result;
}

function normalizeFrameworkKeys(data: unknown): FrameworkData {
  if (!data || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  return {
    spin: normalizeSubKeys(d?.spin || d?.SPIN || d?.Spin, 'spin'),
    gpct: normalizeSubKeys(d?.gpct || d?.GPCT || d?.Gpct, 'gpct'),
    bant: normalizeSubKeys(d?.bant || d?.BANT || d?.Bant, 'bant'),
  };
}

const HIGH_CONFIDENCE_INTENTS: LeadIntentTipo[] = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'];
const MEDIUM_CONFIDENCE_INTENTS: LeadIntentTipo[] = ['DUVIDA_PRECO', 'DUVIDA_PRODUTO'];

function computeClassificationUpgrade(input: { novaTemperatura: TemperaturaTipo; intent: LeadIntentTipo; confianca: number; icpAtual: string; prioridadeAtual: number; empresa: EmpresaTipo; origem?: string }) {
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

function computeNewTemperature(intent: LeadIntentTipo, tempAtual: TemperaturaTipo): TemperaturaTipo | null {
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

const URGENCIA_PATTERNS: Record<string, string[]> = {
  PEDIDO_HUMANO: ['falar com humano', 'falar com alguém', 'atendente', 'atendimento humano', 'pessoa real', 'especialista', 'vocês são robô', 'você é robô', 'quero falar com gente'],
  DECISAO_TOMADA: ['quero contratar', 'quero fechar', 'como pago', 'manda o pix', 'manda o contrato', 'aceito', 'bora', 'to dentro', 'próximo passo', 'onde pago', 'o que preciso enviar', 'quais documentos', 'como começo'],
  URGENCIA_TEMPORAL: ['urgente', 'prazo', 'até amanhã', 'essa semana', 'malha fina', 'multa', 'declaração', 'estou atrasado', 'preciso resolver rápido'],
  FRUSTRADO_ALTERNATIVA: ['já tentei', 'não funcionou', 'não deu certo', 'gastei dinheiro', 'cansei', 'péssima experiência'],
  PEDIDO_REUNIAO_DIRETO: ['quero uma reunião', 'marcar reunião', 'agendar reunião', 'me liga', 'pode me ligar'],
};

function detectarLeadQuenteImediato(mensagem: string): UrgenciaResult {
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

function decidirProximaPergunta(empresa: EmpresaTipo, estadoFunil: EstadoFunil, spin: FrameworkSubKeys | undefined, gpct: FrameworkSubKeys | undefined, bant: FrameworkSubKeys | undefined, temperatura: TemperaturaTipo, intentAtual?: LeadIntentTipo, mensagem?: string): ProximaPerguntaResult {
  const urgencia = mensagem ? detectarLeadQuenteImediato(mensagem) : { detectado: false, tipo: 'NENHUM', frase_gatilho: null, confianca: 'BAIXA' };
  if (urgencia.detectado && (urgencia.confianca === 'ALTA' || urgencia.confianca === 'MEDIA')) {
    return { tipo: 'ESCALAR_IMEDIATO', instrucao: `ESCALAÇÃO IMEDIATA: ${urgencia.tipo} — "${urgencia.frase_gatilho}"`, urgencia };
  }

  const PERGUNTA_INSTRUCOES: Record<ProximaPerguntaTipo, string> = {
    'SPIN_S': 'Pergunta SITUAÇÃO: como declara IR, se já declarou cripto, se usa contador.',
    'SPIN_P': 'Pergunta PROBLEMA: dificuldades atuais - cálculos, volume, medo de errar.',
    'SPIN_I': 'Pergunta IMPLICAÇÃO: riscos - multas, malha fina, insegurança.',
    'SPIN_N': 'Pergunta NEED-PAYOFF: valor da solução - como seria com tudo regularizado.',
    'GPCT_G': 'Pergunta GOALS: objetivo com investimentos.',
    'GPCT_P': 'Pergunta PLANS: como investe hoje.',
    'GPCT_C': 'Pergunta CHALLENGES: desafios enfrentados.',
    'GPCT_T': 'Pergunta TIMELINE: horizonte de tempo.',
    'BANT_B': 'Pergunta BUDGET: faixa de investimento.',
    'BANT_A': 'Pergunta AUTHORITY: decide sozinho ou consulta alguém.',
    'BANT_N': 'Pergunta NEED: quão forte é a necessidade.',
    'BANT_T': 'Pergunta TIMING: quando quer resolver.',
    'CTA_REUNIAO': 'Lead qualificado. Sugira reunião com especialista.',
    'ESCALAR_IMEDIATO': 'Escalação imediata.',
    'NENHUMA': 'Continue a conversa naturalmente.',
  };

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

  return { tipo, instrucao: PERGUNTA_INSTRUCOES[tipo], urgencia };
}

function detectCrossCompanyInterest(mensagem: string, empresaAtual: EmpresaTipo): { detected: boolean; targetCompany: EmpresaTipo | null; reason: string } {
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

async function fetchActiveTokenizaOffers(): Promise<TokenizaOffer[]> {
  try {
    const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/tokeniza-offers`, { headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' } });
    if (!resp.ok) return [];
    const data = await resp.json() as { ofertas?: TokenizaOffer[] };
    return (data.ofertas || []).filter((o: TokenizaOffer) => o.status?.toLowerCase() === 'active' || o.status?.toLowerCase() === 'open');
  } catch { return []; }
}

async function fetchProductKnowledge(supabase: SupabaseClient, empresa: EmpresaTipo): Promise<string> {
  try {
    const { data: products } = await supabase.from('product_knowledge').select('id, produto_nome, descricao_curta').eq('empresa', empresa).eq('ativo', true).limit(5);
    if (!products || products.length === 0) return '';
    const productIds = products.map((p: { id: string }) => p.id);
    const { data: sections } = await supabase.from('knowledge_sections').select('product_knowledge_id, tipo, titulo, conteudo').in('product_knowledge_id', productIds).order('ordem');
    let text = '\n## CONHECIMENTO DOS PRODUTOS\n';
    for (const p of products) {
      const prod = p as { id: string; produto_nome: string; descricao_curta: string | null };
      text += `### ${prod.produto_nome}\n${prod.descricao_curta || ''}\n`;
      const ps = (sections || []).filter((s: { product_knowledge_id: string }) => s.product_knowledge_id === prod.id);
      for (const s of ps) {
        const sec = s as { titulo: string; conteudo: string };
        text += `**${sec.titulo}**: ${sec.conteudo}\n`;
      }
    }
    return text;
  } catch { return ''; }
}

function formatBluePricingForPrompt(): string {
  let text = '\n## TABELA DE PREÇOS BLUE (IR CRIPTO)\n';
  for (const p of BLUE_PRICING.planos) {
    if (p.nome.includes('Customizado')) continue;
    text += `- **${p.nome}**: ${p.preco} (${p.descricao})\n`;
  }
  text += `\nAdicionais:\n`;
  for (const a of BLUE_PRICING.adicionais) text += `- ${a.nome}: ${a.preco}\n`;
  text += `\nPagamento: ${BLUE_PRICING.pagamento.formas} | PIX: ${BLUE_PRICING.pagamento.descontoPix} off | Cartão: ${BLUE_PRICING.pagamento.descontoCartao} off\n`;
  text += `\n⚠️ CADA PLANO = 1 ANO FISCAL. Múltiplos anos = múltiplas contratações. Prescrição: 5 anos.\n`;
  return text;
}

function formatTokenizaOffersForPrompt(ofertas: TokenizaOffer[]): string {
  if (ofertas.length === 0) return '\n## OFERTAS TOKENIZA\nNenhuma oferta ativa.\n';
  let text = '\n## OFERTAS ATIVAS TOKENIZA\n';
  text += `⚠️ Período de captação ≠ prazo de rentabilidade (sempre 12 meses APÓS captação)\n\n`;
  for (const o of ofertas) {
    text += `### ${o.nome} (${o.empresa})\n- Rentabilidade: ${o.rentabilidade}%/ano | Captação: ${o.duracaoDias}d | Restam: ${o.diasRestantes}d | Mínimo: R$ ${o.contribuicaoMinima}\n`;
  }
  return text;
}

const PASSIVE_CHAT_PROMPT = `# AMÉLIA - ATENDENTE COMERCIAL CONSULTIVA
Amélia, 32 anos, economista, especialista em finanças digitais do Grupo Blue (3 anos).

## PAPEL: ATENDENTE PASSIVA — RESPONDE perguntas, qualifica ORGANICAMENTE.
## ESCALAÇÃO: Cliente quer fechar/urgência/pede humano → ESCALAR_HUMANO
## COMUNICAÇÃO: Curta/natural. UMA pergunta por mensagem. NUNCA "Ótima pergunta!".
## DESQUALIFICAÇÃO: Lead sem perfil → DESQUALIFICAR_LEAD

## FORMATO JSON: {"intent":"...","confidence":0.85,"summary":"...","acao":"...","sentimento":"POSITIVO|NEUTRO|NEGATIVO","deve_responder":true,"resposta_sugerida":"...","novo_estado_funil":"...","frameworks_atualizados":{"spin":{}},"disc_estimado":null,"departamento_destino":null}`;

const SYSTEM_PROMPT = `# AMÉLIA - SDR IA QUALIFICADORA CONSULTIVA
Amélia, 32 anos, economista, Grupo Blue (3 anos). Conhece IR cripto e investimentos tokenizados.

## ESCALAÇÃO RÁPIDA: Objetivo: entender contexto → identificar se lead pronto → ESCALAR. NÃO FAÇA OVERQUALIFICATION.
## COMUNICAÇÃO: Mensagens curtas/naturais. NUNCA "Perfeito!", "Entendi!". NUNCA nome no início. 0-2 emojis.
## COMPLIANCE: PROIBIDO prometer retorno, recomendar ativo, negociar preço, pressionar.

## FRAMEWORK: Extraia SPIN/GPCT/BANT de TODA mensagem. Quando S+P preenchidos, INFIRA I (riscos) e N (ação necessária) com prefixo "[Inferido]".

## FORMATO JSON OBRIGATÓRIO:
{"intent":"...","confidence":0.85,"summary":"...","acao":"...","sentimento":"POSITIVO|NEUTRO|NEGATIVO","deve_responder":true,"resposta_sugerida":"...","novo_estado_funil":"...","frameworks_atualizados":{"spin":{"s":"dado"}},"disc_estimado":null,"departamento_destino":null}

## INTENÇÕES: INTERESSE_COMPRA, INTERESSE_IR, DUVIDA_PRODUTO, DUVIDA_PRECO, DUVIDA_TECNICA, SOLICITACAO_CONTATO, AGENDAMENTO_REUNIAO, RECLAMACAO, OPT_OUT, OBJECAO_PRECO, OBJECAO_RISCO, SEM_INTERESSE, NAO_ENTENDI, CUMPRIMENTO, AGRADECIMENTO, FORA_CONTEXTO, OUTRO
## AÇÕES: ENVIAR_RESPOSTA_AUTOMATICA, ESCALAR_HUMANO, AJUSTAR_TEMPERATURA, PAUSAR_CADENCIA, CANCELAR_CADENCIA, CRIAR_TAREFA_CLOSER, MARCAR_OPT_OUT, DESQUALIFICAR_LEAD, NENHUMA`;

// ========================================
// PUBLIC API
// ========================================

export interface ClassifyParams {
  mensagem_normalizada: string;
  empresa: string;
  historico?: HistoricoMsg[];
  classificacao?: Record<string, unknown> | null;
  conversation_state?: Record<string, unknown> | null;
  contato?: Record<string, unknown> | null;
  mode?: string;
  triageSummary?: { clienteNome: string | null; email: string | null; resumoTriagem: string | null; historico: string | null };
  leadNome?: string | null;
  cadenciaNome?: string | null;
  pessoaContext?: Record<string, unknown> | null;
  reprocessContext?: string;
}

export async function classifyIntent(supabase: SupabaseClient, params: ClassifyParams): Promise<ClassifierResult> {
  const { mensagem_normalizada, empresa, historico, classificacao, conversation_state, contato, mode, triageSummary, leadNome, cadenciaNome, pessoaContext, reprocessContext } = params;
  const isPassiveChat = mode === 'PASSIVE_CHAT';

  // A/B testing prompt
  let dynamicPrompt = '';
  let selectedPromptVersionId: string | null = null;
  try {
    const { data: pvList } = await supabase.from('prompt_versions').select('id, content, ab_weight').eq('function_name', 'sdr-ia-interpret').eq('prompt_key', 'system').eq('is_active', true).gt('ab_weight', 0);
    if (pvList && pvList.length > 0) {
      const totalWeight = pvList.reduce((s: number, p: { ab_weight: number | null }) => s + (p.ab_weight || 100), 0);
      let rand = Math.random() * totalWeight;
      let selected = pvList[0];
      for (const pv of pvList) { rand -= (pv.ab_weight || 100); if (rand <= 0) { selected = pv; break; } }
      dynamicPrompt = selected.content;
      selectedPromptVersionId = selected.id;
    }
  } catch { /* ignore */ }

  const activeSystemPrompt = isPassiveChat ? PASSIVE_CHAT_PROMPT : (dynamicPrompt || SYSTEM_PROMPT);

  // Rule-based shortcuts

  // REGRA 4: Escalar automaticamente pedidos de profundidade técnica avançada
  {
    const estadoAtual = (conversation_state?.estado_funil as string) || 'SAUDACAO';
    if (['QUALIFICACAO', 'OBJECOES', 'FECHAMENTO', 'POS_VENDA'].includes(estadoAtual)) {
      const msgLower = mensagem_normalizada.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const technicalPatterns = [
        /track\s*record/, /rentabilidade\s+passada/, /historico\s+de\s+rentabilidade/,
        /demonstra[çc][aã]o\s+t[eé]cnica/, /cases?\s+de\s+sucesso/, /milestones?/,
        /relat[oó]rio\s+(?:de\s+)?performance/, /backtest/, /due\s+diligence/,
        /auditoria/, /dados\s+(?:hist[oó]ricos|reais)/, /resultado[s]?\s+(?:anteriores|passados)/,
        /como\s+(?:funciona|opera)\s+(?:o|a)\s+(?:estrutura|opera[çc][aã]o)/,
        /garantias?\s+reais?\s+(?:espec[ií]ficas|detalhad[ao]s)/,
        /contrato\s+(?:modelo|padr[aã]o)/, /cota[çc][aã]o\s+personalizada/,
      ];
      if (technicalPatterns.some(p => p.test(msgLower))) {
        log.info('Regra rule-based: pedido técnico avançado detectado', { estado: estadoAtual, mensagem: mensagem_normalizada.substring(0, 80) });
        return {
          intent: 'DUVIDA_TECNICA',
          confidence: 0.95,
          summary: 'Lead pediu profundidade técnica avançada',
          acao: 'ESCALAR_HUMANO',
          deve_responder: true,
          resposta_sugerida: 'Boa pergunta! Vou chamar alguém da equipe que pode te mostrar esses detalhes com mais profundidade. Um momento! 🙂',
          novo_estado_funil: 'FECHAMENTO',
          departamento_destino: 'Comercial',
          model: 'rule-based-technical-depth',
          provider: 'rules',
        };
      }
    }
  }

  // REGRA: Pedido explícito de falar com pessoa/humano
  {
    const msgLower = mensagem_normalizada.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const humanRequestPatterns = [
      /(?:preciso|quero|gostaria de|posso|pode)\s+falar\s+com\s+/,
      /(?:me\s+)?pass[ae]\s+(?:pr[oa]|para)\s+/,
      /cham[ae]\s+(?:o|a|os|as)\s+/,
      /transfer[ei]\s+(?:pr[oa]|para)\s+/,
      /falar\s+com\s+(?:um\s+)?(?:humano|atendente|vendedor|pessoa|alguem|gente)/,
      /(?:voce|vc)\s+(?:e|eh)\s+(?:robo|bot|maquina|ia)/,
      /quero\s+(?:um\s+)?(?:atendente|humano|pessoa)/,
    ];
    if (humanRequestPatterns.some(p => p.test(msgLower))) {
      // Extrair nome mencionado (se houver)
      const nameMatch = msgLower.match(/(?:falar com|passa pro|chama o|transfere pro)\s+(?:o\s+|a\s+)?(\w+)/);
      const mentionedName = nameMatch ? nameMatch[1] : null;
      const responseMsg = mentionedName
        ? `Vou chamar ${mentionedName.charAt(0).toUpperCase() + mentionedName.slice(1)} pra você agora. Um momento! 🙂`
        : 'Vou te conectar com alguém da equipe agora. Um momento! 🙂';
      log.info('Regra rule-based: pedido explícito de falar com humano', { mentionedName, mensagem: mensagem_normalizada.substring(0, 80) });
      return {
        intent: 'SOLICITACAO_CONTATO',
        confidence: 0.98,
        summary: `Lead pediu para falar com ${mentionedName || 'humano'}`,
        acao: 'ESCALAR_HUMANO',
        deve_responder: true,
        resposta_sugerida: responseMsg,
        novo_estado_funil: 'FECHAMENTO',
        departamento_destino: 'Comercial',
        model: 'rule-based-human-request',
        provider: 'rules',
      };
    }
  }

  if (leadNome) {
    const nl = (leadNome as string).toLowerCase();
    if (nl.includes('renovação') || nl.includes('renovacao') || nl.includes('renov')) {
      return { intent: 'SOLICITACAO_CONTATO', confidence: 0.95, summary: 'Cliente de renovação', acao: 'ESCALAR_HUMANO', deve_responder: true, resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe que cuida da sua conta. Já já alguém te chama! 👍', novo_estado_funil: 'FECHAMENTO', model: 'rule-based-renovation', provider: 'rules' };
    }
  }

  if (pessoaContext?.relacionamentos) {
    const isClienteIR = (pessoaContext.relacionamentos as Array<{ tipo_relacao: string; empresa: string }>).some((r) => r.tipo_relacao === 'CLIENTE_IR' && r.empresa === empresa);
    if (isClienteIR && (conversation_state?.estado_funil === 'SAUDACAO' || !conversation_state)) {
      return { intent: 'SOLICITACAO_CONTATO', confidence: 0.90, summary: 'Cliente existente', acao: 'ESCALAR_HUMANO', deve_responder: true, resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe. 👍', novo_estado_funil: 'FECHAMENTO', model: 'rule-based-existing-client', provider: 'rules' };
    }
  }

  // Build context prompt
  const fd = normalizeFrameworkKeys(conversation_state?.framework_data || {});
  const canalAtivo: CanalConversa = (conversation_state?.canal as CanalConversa) || 'WHATSAPP';
  const perfilInvestidor = (conversation_state?.perfil_investidor as PerfilInvestidor) || inferirPerfilInvestidor(conversation_state?.perfil_disc as PerfilDISC, mensagem_normalizada);
  const proximaPergunta = decidirProximaPergunta(empresa as EmpresaTipo, (conversation_state?.estado_funil as EstadoFunil) || 'SAUDACAO', fd.spin, fd.gpct, fd.bant, (classificacao?.temperatura as TemperaturaTipo) || 'FRIO', undefined, mensagem_normalizada);

  let userPrompt = `EMPRESA_CONTEXTO: ${empresa}\nMODO: ${isPassiveChat ? 'ATENDENTE PASSIVA' : 'QUALIFICAÇÃO ATIVA'}\n`;
  if (reprocessContext) userPrompt += reprocessContext;
  if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
  if (cadenciaNome && !isPassiveChat) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;

  if (triageSummary && isPassiveChat) {
    userPrompt += `\n## CONTEXTO DA TRIAGEM\n`;
    if (triageSummary.clienteNome) userPrompt += `NOME: ${triageSummary.clienteNome}\n`;
    if (triageSummary.resumoTriagem) userPrompt += `RESUMO: ${triageSummary.resumoTriagem}\n`;
    if (triageSummary.historico) userPrompt += `HISTÓRICO: ${triageSummary.historico}\n`;
    const ameliaOutbound = ((historico || []) as HistoricoMsg[]).filter((h) => h.direcao === 'OUTBOUND');
    const jaCumprimentou = !!(conversation_state?.framework_data as Record<string, unknown> | null)?.ja_cumprimentou;
    if (jaCumprimentou) {
      userPrompt += `⚠️ VOCÊ JÁ SE APRESENTOU para este lead. NÃO se reapresente. Continue a conversa naturalmente.\n`;
    } else if (ameliaOutbound.length === 0) {
      userPrompt += `⚠️ PRIMEIRA interação após handoff. Apresente-se como Amélia.\n`;
    }
  }

  if (proximaPergunta.tipo === 'ESCALAR_IMEDIATO' && proximaPergunta.urgencia && !reprocessContext) {
    userPrompt += `\n🚨 ESCALAÇÃO: ${proximaPergunta.urgencia.tipo} — "${proximaPergunta.urgencia.frase_gatilho}" → ESCALAR_HUMANO\n`;
  } else if (proximaPergunta.tipo === 'ESCALAR_IMEDIATO' && reprocessContext) {
    userPrompt += `\n⚡ PRÓXIMA PERGUNTA: NENHUMA — Continue a conversa naturalmente (retomada pós-handoff).\n`;
  } else {
    userPrompt += `\n⚡ PRÓXIMA PERGUNTA: ${proximaPergunta.tipo} — ${proximaPergunta.instrucao}\n`;
  }

  if (pessoaContext) {
    const pessoa = pessoaContext.pessoa as Record<string, unknown> | undefined;
    userPrompt += `\n## PESSOA\nNome: ${pessoa?.nome}\n`;
    if (pessoa?.perfil_disc) userPrompt += `DISC: ${pessoa.perfil_disc}\n`;
  }

  if (conversation_state) {
    userPrompt += `\n## ESTADO\nFunil: ${conversation_state.estado_funil} | Framework: ${conversation_state.framework_ativo}\n`;
    if (conversation_state.perfil_disc) {
      const discInstr = getDiscToneInstruction(conversation_state.perfil_disc as PerfilDISC);
      if (discInstr) userPrompt += `${discInstr}\n`;
    }
    if (fd.spin?.s) userPrompt += `✅ SPIN_S: ${fd.spin.s}\n`;
    if (fd.spin?.p) userPrompt += `✅ SPIN_P: ${fd.spin.p}\n`;
    if (fd.spin?.i) userPrompt += `✅ SPIN_I: ${fd.spin.i}\n`;
    if (fd.spin?.n) userPrompt += `✅ SPIN_N: ${fd.spin.n}\n`;
    if (fd.gpct?.g) userPrompt += `✅ GPCT_G: ${fd.gpct.g}\n`;
    if (fd.gpct?.p) userPrompt += `✅ GPCT_P: ${fd.gpct.p}\n`;
    if (fd.gpct?.c) userPrompt += `✅ GPCT_C: ${fd.gpct.c}\n`;
    if (fd.gpct?.t) userPrompt += `✅ GPCT_T: ${fd.gpct.t}\n`;
    if (fd.bant?.b) userPrompt += `✅ BANT_B: ${fd.bant.b}\n`;
    if (conversation_state.estado_funil !== 'SAUDACAO') userPrompt += `⚠️ NÃO reinicie. Continue de onde parou.\n`;
  }

  // MELHORIA 1: Produto escolhido — proibir re-oferta
  const produtoEscolhido = (conversation_state?.framework_data as Record<string, unknown>)?.produto_escolhido as string | undefined;
  if (produtoEscolhido) {
    userPrompt += `\n🔒 PRODUTO ESCOLHIDO: "${produtoEscolhido}". O lead JÁ ESCOLHEU este produto. Foque EXCLUSIVAMENTE nele. NUNCA re-ofereça alternativas que o lead já ignorou ou rejeitou.\n`;
  }

  // MELHORIA 2: Limitar perguntas de qualificação repetitivas
  {
    const outboundMsgs = ((historico || []) as HistoricoMsg[]).filter(h => h.direcao === 'OUTBOUND');
    let consecutiveQuestions = 0;
    for (const msg of outboundMsgs) {
      if (msg.conteudo.trim().endsWith('?')) consecutiveQuestions++;
      else break;
    }
    if (consecutiveQuestions >= 3) {
      userPrompt += `\n⚠️ LIMITE ATINGIDO: Você já fez ${consecutiveQuestions} perguntas consecutivas sem avanço. NÃO FAÇA MAIS PERGUNTAS. Avance para um próximo passo concreto: enviar material, propor call, apresentar proposta, ou escalar para humano.\n`;
    }
  }

  userPrompt += `\n📱 CANAL: ${canalAtivo}\n${CHANNEL_RULES[canalAtivo]}\n`;
  if (perfilInvestidor) userPrompt += `\n🎯 PERFIL: ${perfilInvestidor}\n`;

  const cross = detectCrossCompanyInterest(mensagem_normalizada, empresa as EmpresaTipo);
  if (cross.detected) userPrompt += `\n🔀 CROSS-SELL: ${cross.reason}\n`;

  if (empresa === 'BLUE') userPrompt += formatBluePricingForPrompt();
  if (empresa === 'TOKENIZA') {
    const offers = await fetchActiveTokenizaOffers();
    userPrompt += formatTokenizaOffersForPrompt(offers);
  }

  const productKnowledge = await fetchProductKnowledge(supabase, empresa as EmpresaTipo);
  if (productKnowledge) userPrompt += productKnowledge;

  try {
    const { data: learnings } = await supabase.from('amelia_learnings').select('titulo, descricao, tipo').eq('empresa', empresa).eq('status', 'VALIDADO').eq('aplicado', true).limit(5);
    if (learnings && learnings.length > 0) {
      userPrompt += `\n## APRENDIZADOS VALIDADOS\n`;
      for (const l of learnings) {
        const learning = l as { tipo: string; titulo: string; descricao: string };
        userPrompt += `- [${learning.tipo}] ${learning.titulo}: ${learning.descricao}\n`;
      }
    }
  } catch { /* ignore */ }

  const contactInfo = contato ? `Nome: ${contato.nome || contato.primeiro_nome || 'Desconhecido'}` : '';
  const classInfo = classificacao ? `ICP: ${classificacao.icp}, Temp: ${classificacao.temperatura}, Score: ${classificacao.score_interno || 'N/A'}` : '';
  userPrompt += `\n${contactInfo}\n${classInfo}\n`;

  const historicoText = ((historico || []) as HistoricoMsg[]).slice(0, 15).map((m) => `[${m.direcao}] ${m.conteudo}`).join('\n');
  userPrompt += `\nHISTÓRICO:\n${historicoText}\n\nMENSAGEM ATUAL:\n${mensagem_normalizada}\n`;

  const aiResult = await callAI({
    system: activeSystemPrompt,
    prompt: userPrompt,
    functionName: 'sdr-intent-classifier',
    empresa,
    temperature: 0.3,
    maxTokens: 1500,
    promptVersionId: selectedPromptVersionId || undefined,
    supabase,
    model: 'claude-haiku',  // Haiku 4.5 — menor custo, suficiente para classificação
  });

  let result: ClassifierResult | null = null;
  let fallbackReason: string | null = null;
  if (aiResult.content) {
    // Phase 1: Robust JSON extraction with balanced brace matching
    try {
      const cleaned = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Balanced brace extraction (non-greedy)
      let braceDepth = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
          if (braceDepth === 0) jsonStart = i;
          braceDepth++;
        } else if (cleaned[i] === '}') {
          braceDepth--;
          if (braceDepth === 0 && jsonStart >= 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleaned.substring(jsonStart, jsonEnd);
        result = JSON.parse(jsonStr);
      } else {
        fallbackReason = 'no_json_found';
      }
    } catch (parseErr) {
      fallbackReason = 'parse_fail';
      log.warn('JSON parse failed (attempt 1)', { error: parseErr instanceof Error ? parseErr.message : String(parseErr), contentPreview: aiResult.content.substring(0, 200) });

      // Repair pass: try to extract key fields via regex
      try {
        const intentMatch = aiResult.content.match(/"intent"\s*:\s*"([A-Z_]+)"/);
        const confMatch = aiResult.content.match(/"confidence"\s*:\s*([\d.]+)/);
        const respostaMatch = aiResult.content.match(/"resposta_sugerida"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const acaoMatch = aiResult.content.match(/"acao"\s*:\s*"([A-Z_]+)"/);
        if (intentMatch && confMatch) {
          result = {
            intent: intentMatch[1],
            confidence: parseFloat(confMatch[1]),
            acao: acaoMatch?.[1] || 'ENVIAR_RESPOSTA_AUTOMATICA',
            deve_responder: true,
            resposta_sugerida: respostaMatch?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, '\n') || undefined,
            summary: 'Recuperado via repair pass',
          };
          fallbackReason = null;
          log.info('JSON repair pass succeeded', { intent: result.intent, confidence: result.confidence });
        }
      } catch { /* repair failed too */ }
    }
  } else {
    fallbackReason = 'empty_content';
  }

  if (!result) {
    log.warn('Falling back to deterministic classification', { reason: fallbackReason, model: aiResult.model, contentLength: aiResult.content?.length || 0 });
    result = { intent: 'OUTRO', confidence: 0.3, sentimento: 'NEUTRO', resumo: `Classificação determinística (${fallbackReason})`, acao: 'NENHUMA', _fallbackReason: fallbackReason } as ClassifierResult & { _fallbackReason?: string };
  }

  // ========================================
  // CONTEXTUAL SHORT REPLY OVERRIDE
  // Detecta respostas curtas válidas (numeral/quantificador) a perguntas outbound recentes
  // Evita classificação falsa como OUTRO 0.3 quando lead responde "Usei 3", "duas", etc.
  // ========================================
  const isLowConfidenceResult = (result.intent === 'OUTRO' || result.intent === 'NAO_ENTENDI') && result.confidence < 0.7;
  if (isLowConfidenceResult && historico && historico.length > 0) {
    const msgLower = mensagem_normalizada.toLowerCase().trim();
    const isShort = msgLower.length <= 60;
    const hasNumeral = /\d+|uma?|duas?|três|tres|quatro|cinco|seis|sete|oito|nove|dez|poucas?|poucos?|muitas?|muitos?|algumas?|alguns?|v[aá]rias?|v[aá]rios?/.test(msgLower);

    if (isShort && hasNumeral) {
      // Encontrar última mensagem outbound da Amélia (historico já vem DESC = mais recente primeiro)
      const lastOutbound = historico.find(h => h.direcao === 'OUTBOUND');
      if (lastOutbound) {
        const outLower = lastOutbound.conteudo.toLowerCase();
        const isQuestion = /\?|quantas?|quantos?|qual|como|onde|quando|quanto|volume|opera[çc][oõ]es?|exchange|carteira|declara|investe|valor|anos?/.test(outLower);

        if (isQuestion) {
          log.info('Contextual short reply detected — overriding low-confidence classification', {
            originalIntent: result.intent,
            originalConfidence: result.confidence,
            mensagem: msgLower,
            lastOutbound: outLower.substring(0, 80),
          });

          // Determine better intent based on funnel stage
          const estadoAtual = (conversation_state?.estado_funil as string) || 'SAUDACAO';
          const betterIntent = ['FECHAMENTO', 'NEGOCIACAO', 'PROPOSTA'].includes(estadoAtual)
            ? 'DUVIDA_PRECO'
            : ['QUALIFICACAO', 'DIAGNOSTICO'].includes(estadoAtual)
              ? 'INTERESSE_IR'
              : 'DUVIDA_PRODUTO';

          // Keep AI response if it's substantial, otherwise generate continuation
          const hasGoodResponse = result.resposta_sugerida && result.resposta_sugerida.length > 20
            && !result.resposta_sugerida.toLowerCase().includes('reformul')
            && !result.resposta_sugerida.toLowerCase().includes('não entendi')
            && !result.resposta_sugerida.toLowerCase().includes('pode me explicar');

          result.intent = betterIntent;
          result.confidence = 0.75;
          result.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
          result.deve_responder = true;
          (result as ClassifierResult & { _isContextualShortReply?: boolean })._isContextualShortReply = true;

          if (!hasGoodResponse) {
            // Generate a contextual continuation response
            result.resposta_sugerida = empresa === 'BLUE'
              ? 'Entendi! Com base nisso, posso te explicar melhor como funciona nosso serviço de IR cripto. Quer saber mais sobre os planos?'
              : 'Legal! Com essas informações, consigo te direcionar melhor. Quer que eu te explique as opções disponíveis?';
          }
        }
      }
    }
  }

  const validIntents = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'DUVIDA_PRODUTO', 'DUVIDA_PRECO', 'DUVIDA_TECNICA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO', 'RECLAMACAO', 'OPT_OUT', 'OBJECAO_PRECO', 'OBJECAO_RISCO', 'SEM_INTERESSE', 'NAO_ENTENDI', 'CUMPRIMENTO', 'AGRADECIMENTO', 'FORA_CONTEXTO', 'OUTRO'];
  if (!validIntents.includes(result.intent)) result.intent = 'OUTRO';
  result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

  if (classificacao && !result.acao_detalhes?.nova_temperatura) {
    const novaTemp = computeNewTemperature(result.intent as LeadIntentTipo, classificacao.temperatura as TemperaturaTipo);
    if (novaTemp) {
      result.acao = result.acao || 'AJUSTAR_TEMPERATURA';
      result.acao_detalhes = { ...(result.acao_detalhes || {}), nova_temperatura: novaTemp, intent: result.intent };
    }
  }

  if (classificacao) {
    const upgrade = computeClassificationUpgrade({
      novaTemperatura: (result.acao_detalhes?.nova_temperatura as TemperaturaTipo) || (classificacao.temperatura as TemperaturaTipo),
      intent: result.intent as LeadIntentTipo,
      confianca: result.confidence,
      icpAtual: (classificacao.icp as string) || `${empresa}_NAO_CLASSIFICADO`,
      prioridadeAtual: (classificacao.prioridade as number) || 3,
      empresa: empresa as EmpresaTipo,
      origem: classificacao.origem as string,
    });
    if (Object.keys(upgrade).length > 0) result.classification_upgrade = upgrade;
  }

  if (result.frameworks_atualizados) {
    result.frameworks_atualizados = normalizeFrameworkKeys(result.frameworks_atualizados);
  }

  return {
    ...result,
    model: aiResult.model,
    provider: aiResult.provider,
    proxima_pergunta: proximaPergunta,
    urgencia_detectada: proximaPergunta.urgencia,
    perfil_investidor_inferido: perfilInvestidor,
    cross_company: cross.detected ? cross : undefined,
  };
}
