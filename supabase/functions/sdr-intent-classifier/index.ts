import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

// ========================================
// SDR Intent Classifier — Enriched with full monolith logic
// Pricing, product knowledge, SPIN/GPCT/BANT, DISC, A/B testing
// ========================================

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
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

interface FrameworkSubKeys {
  [key: string]: string | null;
}

interface UrgenciaResult {
  detectado: boolean;
  tipo: string;
  frase_gatilho: string | null;
  confianca: string;
}

interface ProximaPerguntaResult {
  tipo: ProximaPerguntaTipo;
  instrucao: string;
  urgencia?: UrgenciaResult;
}

interface TokenizaOffer {
  nome: string;
  empresa: string;
  rentabilidade: string;
  duracaoDias: number;
  diasRestantes: number;
  contribuicaoMinima: number;
  status?: string;
}

interface HistoricoMsg {
  direcao: string;
  conteudo: string;
}

interface ClassifierResponse {
  intent: string;
  confidence: number;
  summary?: string;
  resumo?: string;
  acao?: SdrAcaoTipo;
  acao_recomendada?: SdrAcaoTipo;
  acao_detalhes?: Record<string, unknown>;
  deve_responder?: boolean;
  resposta_sugerida?: string;
  sentimento?: string;
  novo_estado_funil?: string;
  frameworks_atualizados?: Record<string, unknown>;
  disc_estimado?: string | null;
  departamento_destino?: string | null;
  model?: string;
  provider?: string;
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

// ========================================
// TOKENIZA KNOWLEDGE
// ========================================
const TOKENIZA_KNOWLEDGE = {
  oQueE: { definicao: 'Plataforma brasileira de investimentos tokenizados regulada pela CVM 88', modelo: 'Conecta investidores a captadores com garantias reais' },
  produtoInvestidor: { tipo: 'Investimentos tokenizados lastreados em garantia real', lastros: ['Imóveis', 'Recebíveis', 'Contratos firmados', 'Alienação fiduciária'] },
  garantias: { tipos: ['Alienação fiduciária de imóvel', 'Cessão fiduciária de recebíveis', 'Caução', 'Penhor'] },
  diferenciais: ['Operações com garantia real', 'Plataforma regulada pela CVM 88', 'Transparência e lastro claro', 'Due diligence completa'],
};

// ========================================
// CHANNEL RULES
// ========================================
const CHANNEL_RULES: Record<string, string> = {
  WHATSAPP: `REGRAS WHATSAPP: Mensagens CURTAS (2-4 linhas). Tom conversacional. UMA pergunta por mensagem. PROIBIDO: blocos longos, listas extensas, múltiplas perguntas.`,
  EMAIL: `REGRAS EMAIL: Mensagens ESTRUTURADAS. Tom consultivo e profissional. Máx 3-4 parágrafos. Estrutura: retomada breve → conteúdo principal → próximo passo claro.`
};

// ========================================
// DISC INSTRUCTIONS
// ========================================
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

// ========================================
// INVESTOR PROFILE
// ========================================
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

// ========================================
// FRAMEWORK NORMALIZATION
// ========================================
function normalizeSubKeys(obj: unknown): FrameworkSubKeys {
  if (!obj || typeof obj !== 'object') return {};
  const result: FrameworkSubKeys = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) result[key.toLowerCase()] = value as string | null;
  return result;
}

function normalizeFrameworkKeys(data: unknown): FrameworkData {
  if (!data || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  return {
    spin: normalizeSubKeys(d?.spin || d?.SPIN || d?.Spin),
    gpct: normalizeSubKeys(d?.gpct || d?.GPCT || d?.Gpct),
    bant: normalizeSubKeys(d?.bant || d?.BANT || d?.Bant),
  };
}

// ========================================
// CLASSIFICATION UPGRADE
// ========================================
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

// ========================================
// TEMPERATURE MATRIX
// ========================================
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

// ========================================
// NEXT QUESTION DECISION
// ========================================
function decidirProximaPergunta(empresa: EmpresaTipo, estadoFunil: EstadoFunil, spin: FrameworkSubKeys | undefined, gpct: FrameworkSubKeys | undefined, bant: FrameworkSubKeys | undefined, temperatura: TemperaturaTipo, intentAtual?: LeadIntentTipo, mensagem?: string, _historico?: unknown[], _frameworkData?: FrameworkData): ProximaPerguntaResult {
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

// ========================================
// CROSS-COMPANY DETECTION
// ========================================
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

// ========================================
// FETCH ACTIVE TOKENIZA OFFERS
// ========================================
async function fetchActiveTokenizaOffers(): Promise<TokenizaOffer[]> {
  try {
    const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/tokeniza-offers`, { headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' } });
    if (!resp.ok) return [];
    const data = await resp.json() as { ofertas?: TokenizaOffer[] };
    return (data.ofertas || []).filter((o: TokenizaOffer) => o.status?.toLowerCase() === 'active' || o.status?.toLowerCase() === 'open');
  } catch { return []; }
}

// ========================================
// FETCH PRODUCT KNOWLEDGE
// ========================================
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

// ========================================
// FORMAT PRICING
// ========================================
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

// ========================================
// PASSIVE CHAT PROMPT
// ========================================
const PASSIVE_CHAT_PROMPT = `# AMÉLIA - ATENDENTE COMERCIAL CONSULTIVA
Amélia, 32 anos, economista, especialista em finanças digitais do Grupo Blue (3 anos).

## PAPEL: ATENDENTE PASSIVA — RESPONDE perguntas, qualifica ORGANICAMENTE.
## ESCALAÇÃO: Cliente quer fechar/urgência/pede humano → ESCALAR_HUMANO
## COMUNICAÇÃO: Curta/natural. UMA pergunta por mensagem. NUNCA "Ótima pergunta!".
## DESQUALIFICAÇÃO: Lead sem perfil → DESQUALIFICAR_LEAD

## FORMATO JSON: {"intent":"...","confidence":0.85,"summary":"...","acao":"...","sentimento":"POSITIVO|NEUTRO|NEGATIVO","deve_responder":true,"resposta_sugerida":"...","novo_estado_funil":"...","frameworks_atualizados":{"spin":{}},"disc_estimado":null,"departamento_destino":null}`;

// ========================================
// MAIN SYSTEM PROMPT
// ========================================
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
// MAIN HANDLER
// ========================================
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const context = await req.json();
    const {
      mensagem_normalizada, empresa, historico, classificacao, conversation_state, contato,
      mode, triageSummary, leadNome, cadenciaNome, pessoaContext,
    } = context;

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
    if (leadNome) {
      const nl = (leadNome as string).toLowerCase();
      if (nl.includes('renovação') || nl.includes('renovacao') || nl.includes('renov')) {
        return jsonResponse({ intent: 'SOLICITACAO_CONTATO', confidence: 0.95, summary: 'Cliente de renovação', acao: 'ESCALAR_HUMANO', deve_responder: true, resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe que cuida da sua conta. Já já alguém te chama! 👍', novo_estado_funil: 'FECHAMENTO', model: 'rule-based-renovation', provider: 'rules' });
      }
    }

    if (pessoaContext?.relacionamentos) {
      const isClienteIR = (pessoaContext.relacionamentos as Array<{ tipo_relacao: string; empresa: string }>).some((r) => r.tipo_relacao === 'CLIENTE_IR' && r.empresa === empresa);
      if (isClienteIR && (conversation_state?.estado_funil === 'SAUDACAO' || !conversation_state)) {
        return jsonResponse({ intent: 'SOLICITACAO_CONTATO', confidence: 0.90, summary: 'Cliente existente', acao: 'ESCALAR_HUMANO', deve_responder: true, resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe. 👍', novo_estado_funil: 'FECHAMENTO', model: 'rule-based-existing-client', provider: 'rules' });
      }
    }

    // Build context prompt
    const fd = normalizeFrameworkKeys(conversation_state?.framework_data || {});
    const canalAtivo: CanalConversa = conversation_state?.canal || 'WHATSAPP';
    const perfilInvestidor = conversation_state?.perfil_investidor || inferirPerfilInvestidor(conversation_state?.perfil_disc, mensagem_normalizada);
    const proximaPergunta = decidirProximaPergunta(empresa, conversation_state?.estado_funil || 'SAUDACAO', fd.spin, fd.gpct, fd.bant, classificacao?.temperatura || 'FRIO', undefined, mensagem_normalizada, historico, conversation_state?.framework_data);

    let userPrompt = `EMPRESA_CONTEXTO: ${empresa}\nMODO: ${isPassiveChat ? 'ATENDENTE PASSIVA' : 'QUALIFICAÇÃO ATIVA'}\n`;
    if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
    if (cadenciaNome && !isPassiveChat) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;

    // Triage context
    if (triageSummary && isPassiveChat) {
      userPrompt += `\n## CONTEXTO DA TRIAGEM\n`;
      if (triageSummary.clienteNome) userPrompt += `NOME: ${triageSummary.clienteNome}\n`;
      if (triageSummary.resumoTriagem) userPrompt += `RESUMO: ${triageSummary.resumoTriagem}\n`;
      if (triageSummary.historico) userPrompt += `HISTÓRICO: ${triageSummary.historico}\n`;
      const ameliaOutbound = ((historico || []) as HistoricoMsg[]).filter((h) => h.direcao === 'OUTBOUND');
      if (ameliaOutbound.length === 0) {
        userPrompt += `⚠️ PRIMEIRA interação após handoff. Apresente-se como Amélia.\n`;
      }
    }

    // Urgency/escalation
    if (proximaPergunta.tipo === 'ESCALAR_IMEDIATO' && proximaPergunta.urgencia) {
      userPrompt += `\n🚨 ESCALAÇÃO: ${proximaPergunta.urgencia.tipo} — "${proximaPergunta.urgencia.frase_gatilho}" → ESCALAR_HUMANO\n`;
    } else {
      userPrompt += `\n⚡ PRÓXIMA PERGUNTA: ${proximaPergunta.tipo} — ${proximaPergunta.instrucao}\n`;
    }

    // Pessoa context
    if (pessoaContext) {
      userPrompt += `\n## PESSOA\nNome: ${pessoaContext.pessoa?.nome}\n`;
      if (pessoaContext.pessoa?.perfil_disc) userPrompt += `DISC: ${pessoaContext.pessoa.perfil_disc}\n`;
    }

    // Conversation state
    if (conversation_state) {
      userPrompt += `\n## ESTADO\nFunil: ${conversation_state.estado_funil} | Framework: ${conversation_state.framework_ativo}\n`;
      if (conversation_state.perfil_disc) {
        const discInstr = getDiscToneInstruction(conversation_state.perfil_disc);
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

    // Channel + investor profile
    userPrompt += `\n📱 CANAL: ${canalAtivo}\n${CHANNEL_RULES[canalAtivo]}\n`;
    if (perfilInvestidor) userPrompt += `\n🎯 PERFIL: ${perfilInvestidor}\n`;

    // Cross-selling
    const cross = detectCrossCompanyInterest(mensagem_normalizada, empresa);
    if (cross.detected) userPrompt += `\n🔀 CROSS-SELL: ${cross.reason}\n`;

    // Business knowledge
    if (empresa === 'BLUE') userPrompt += formatBluePricingForPrompt();
    if (empresa === 'TOKENIZA') {
      const offers = await fetchActiveTokenizaOffers();
      userPrompt += formatTokenizaOffersForPrompt(offers);
    }

    // Product knowledge
    const productKnowledge = await fetchProductKnowledge(supabase, empresa);
    if (productKnowledge) userPrompt += productKnowledge;

    // Amelia learnings
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

    // Classification
    const contactInfo = contato ? `Nome: ${contato.nome || contato.primeiro_nome || 'Desconhecido'}` : '';
    const classInfo = classificacao ? `ICP: ${classificacao.icp}, Temp: ${classificacao.temperatura}, Score: ${classificacao.score_interno || 'N/A'}` : '';
    userPrompt += `\n${contactInfo}\n${classInfo}\n`;

    // History
    const historicoText = ((historico || []) as HistoricoMsg[]).slice(0, 15).map((m) => `[${m.direcao}] ${m.conteudo}`).join('\n');
    userPrompt += `\nHISTÓRICO:\n${historicoText}\n\nMENSAGEM ATUAL:\n${mensagem_normalizada}\n`;

    // Call AI
    const aiResult = await callAI({
      system: activeSystemPrompt,
      prompt: userPrompt,
      functionName: 'sdr-intent-classifier',
      empresa,
      temperature: 0.3,
      maxTokens: 1500,
      promptVersionId: selectedPromptVersionId || undefined,
      supabase,
    });

    // Parse result
    let result: ClassifierResponse | null = null;
    if (aiResult.content) {
      try {
        const cleaned = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch { log.warn('JSON parse failed'); }
    }

    // Deterministic fallback
    if (!result) {
      result = { intent: 'OUTRO', confidence: 0.3, sentimento: 'NEUTRO', resumo: 'Classificação determinística', acao: 'NENHUMA' };
    }

    // Validate intent
    const validIntents = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'DUVIDA_PRODUTO', 'DUVIDA_PRECO', 'DUVIDA_TECNICA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO', 'RECLAMACAO', 'OPT_OUT', 'OBJECAO_PRECO', 'OBJECAO_RISCO', 'SEM_INTERESSE', 'NAO_ENTENDI', 'CUMPRIMENTO', 'AGRADECIMENTO', 'FORA_CONTEXTO', 'OUTRO'];
    if (!validIntents.includes(result.intent)) result.intent = 'OUTRO';
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

    // Temperature matrix
    if (classificacao && !result.acao_detalhes?.nova_temperatura) {
      const novaTemp = computeNewTemperature(result.intent as LeadIntentTipo, classificacao.temperatura);
      if (novaTemp) {
        result.acao = result.acao || 'AJUSTAR_TEMPERATURA';
        result.acao_detalhes = { ...(result.acao_detalhes || {}), nova_temperatura: novaTemp, intent: result.intent };
      }
    }

    // Classification upgrade
    if (classificacao) {
      const upgrade = computeClassificationUpgrade({
        novaTemperatura: (result.acao_detalhes?.nova_temperatura as TemperaturaTipo) || classificacao.temperatura,
        intent: result.intent as LeadIntentTipo,
        confianca: result.confidence,
        icpAtual: classificacao.icp || `${empresa}_NAO_CLASSIFICADO`,
        prioridadeAtual: classificacao.prioridade || 3,
        empresa,
        origem: classificacao.origem,
      });
      if (Object.keys(upgrade).length > 0) result.classification_upgrade = upgrade;
    }

    // Normalize frameworks
    if (result.frameworks_atualizados) {
      result.frameworks_atualizados = normalizeFrameworkKeys(result.frameworks_atualizados);
    }

    return jsonResponse({
      ...result,
      model: aiResult.model,
      provider: aiResult.provider,
      proxima_pergunta: proximaPergunta,
      urgencia_detectada: proximaPergunta.urgencia,
      perfil_investidor_inferido: perfilInvestidor,
      cross_company: cross.detected ? cross : undefined,
    });

  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function jsonResponse(data: ClassifierResponse) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
