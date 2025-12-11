import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 6G - SDR IA Qualificador Consultivo
// Receita Previsível + SPIN/GPCT + Decisão de Próxima Pergunta
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// TIPOS
// ========================================

type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type TemperaturaTipo = 'FRIO' | 'MORNO' | 'QUENTE';
type ICPTipo = 
  | 'TOKENIZA_SERIAL' | 'TOKENIZA_MEDIO_PRAZO' | 'TOKENIZA_EMERGENTE' 
  | 'TOKENIZA_ALTO_VOLUME_DIGITAL' | 'TOKENIZA_NAO_CLASSIFICADO'
  | 'BLUE_ALTO_TICKET_IR' | 'BLUE_RECURRENTE' | 'BLUE_PERDIDO_RECUPERAVEL' 
  | 'BLUE_NAO_CLASSIFICADO';
type PersonaTipo = 
  | 'CONSTRUTOR_PATRIMONIO' | 'COLECIONADOR_DIGITAL' | 'INICIANTE_CAUTELOSO'
  | 'CRIPTO_CONTRIBUINTE_URGENTE' | 'CLIENTE_FIEL_RENOVADOR' | 'LEAD_PERDIDO_RECUPERAVEL';

type LeadIntentTipo =
  | 'INTERESSE_COMPRA'
  | 'INTERESSE_IR'
  | 'DUVIDA_PRODUTO'
  | 'DUVIDA_PRECO'
  | 'DUVIDA_TECNICA'
  | 'SOLICITACAO_CONTATO'
  | 'AGENDAMENTO_REUNIAO'
  | 'RECLAMACAO'
  | 'OPT_OUT'
  | 'OBJECAO_PRECO'
  | 'OBJECAO_RISCO'
  | 'SEM_INTERESSE'
  | 'NAO_ENTENDI'
  | 'CUMPRIMENTO'
  | 'AGRADECIMENTO'
  | 'FORA_CONTEXTO'
  | 'OUTRO';

type SdrAcaoTipo =
  | 'PAUSAR_CADENCIA'
  | 'CANCELAR_CADENCIA'
  | 'RETOMAR_CADENCIA'
  | 'AJUSTAR_TEMPERATURA'
  | 'CRIAR_TAREFA_CLOSER'
  | 'MARCAR_OPT_OUT'
  | 'NENHUMA'
  | 'ESCALAR_HUMANO'
  | 'ENVIAR_RESPOSTA_AUTOMATICA';

// ========================================
// PATCH 6: TIPOS DE ESTADO DE CONVERSA
// ========================================

type EstadoFunil = 'SAUDACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO' | 'OBJECOES' | 'FECHAMENTO' | 'POS_VENDA';
type FrameworkTipo = 'GPCT' | 'BANT' | 'SPIN' | 'NONE';
type PerfilDISC = 'D' | 'I' | 'S' | 'C';
type PessoaRelacaoTipo = 'CLIENTE_IR' | 'LEAD_IR' | 'INVESTIDOR' | 'LEAD_INVESTIDOR' | 'DESCONHECIDO';

interface FrameworkData {
  gpct?: { g?: string | null; p?: string | null; c?: string | null; t?: string | null };
  bant?: { b?: string | null; a?: string | null; n?: string | null; t?: string | null };
  spin?: { s?: string | null; p?: string | null; i?: string | null; n?: string | null };
}

interface ConversationState {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  canal: string;
  estado_funil: EstadoFunil;
  framework_ativo: FrameworkTipo;
  framework_data: FrameworkData;
  perfil_disc?: PerfilDISC | null;
  idioma_preferido: string;
  ultima_pergunta_id?: string | null;
  ultimo_contato_em: string;
}

interface PessoaContext {
  pessoa: {
    id: string;
    nome: string;
    telefone_e164?: string | null;
    email_principal?: string | null;
    idioma_preferido: string;
    perfil_disc?: PerfilDISC | null;
  };
  relacionamentos: {
    empresa: EmpresaTipo;
    tipo_relacao: PessoaRelacaoTipo;
    ultima_interacao_em?: string | null;
  }[];
}

// ========================================
// PATCH 6G: TIPOS DE DECISÃO DE PERGUNTA
// ========================================

type ProximaPerguntaTipo =
  | 'SPIN_S' | 'SPIN_P' | 'SPIN_I' | 'SPIN_N'
  | 'GPCT_G' | 'GPCT_P' | 'GPCT_C' | 'GPCT_T'
  | 'BANT_B' | 'BANT_A' | 'BANT_N' | 'BANT_T'
  | 'CTA_REUNIAO'
  | 'NENHUMA';

interface ConversationQualiState {
  empresa: EmpresaTipo;
  estadoFunil: EstadoFunil;
  spin?: { s?: string | null; p?: string | null; i?: string | null; n?: string | null };
  gpct?: { g?: string | null; p?: string | null; c?: string | null; t?: string | null };
  bant?: { b?: string | null; a?: string | null; n?: string | null; t?: string | null };
  temperatura: TemperaturaTipo;
  intentAtual?: LeadIntentTipo;
}

// Mapeamento de tipos de pergunta para instruções
const PERGUNTA_INSTRUCOES: Record<ProximaPerguntaTipo, string> = {
  // SPIN
  'SPIN_S': 'Faça uma pergunta de SITUAÇÃO (S): entenda como o lead declara IR hoje, se já declarou cripto antes, se usa software/contador.',
  'SPIN_P': 'Faça uma pergunta de PROBLEMA (P): entenda o que é mais difícil para o lead hoje - dúvidas com cálculos, volume, regras, medo de errar.',
  'SPIN_I': 'Faça uma pergunta de IMPLICAÇÃO (I): leve o lead a perceber os riscos - multas, malha fina, insegurança se continuar assim.',
  'SPIN_N': 'Faça uma pergunta de NEED-PAYOFF (N): mostre o valor da solução - como ele se sentiria com tudo regularizado.',
  // GPCT
  'GPCT_G': 'Faça uma pergunta sobre GOALS (G): entenda o objetivo do lead com investimentos - renda extra, aposentadoria, diversificar.',
  'GPCT_P': 'Faça uma pergunta sobre PLANS (P): entenda como ele investe hoje - tradicionais, cripto, tokenização.',
  'GPCT_C': 'Faça uma pergunta sobre CHALLENGES (C): entenda os desafios que atrapalham - banco ganhando mais, falta de tempo/conhecimento, medo.',
  'GPCT_T': 'Faça uma pergunta sobre TIMELINE (T): entenda o horizonte de tempo - curto, médio, longo prazo, eventos específicos.',
  // BANT
  'BANT_B': 'Faça uma pergunta sobre BUDGET (B): entenda a faixa de investimento - abaixo de 10k, entre 10k-50k, acima de 50k.',
  'BANT_A': 'Faça uma pergunta sobre AUTHORITY (A): entenda se ele decide sozinho ou precisa consultar alguém.',
  'BANT_N': 'Faça uma pergunta sobre NEED (N): entenda quão forte é a necessidade de mudar a situação atual.',
  'BANT_T': 'Faça uma pergunta sobre TIMING (T): entenda quando ele quer resolver isso - agora, em meses, distante.',
  // CTA
  'CTA_REUNIAO': 'O lead está qualificado. Sugira uma reunião com nosso especialista explicando brevemente o que será discutido.',
  'NENHUMA': 'Continue a conversa de forma natural, respondendo ao que o lead disse.',
};

// ========================================
// PATCH 6G: TABELA DE PREÇOS BLUE (IR CRIPTO)
// ========================================

const BLUE_PRICING = {
  planos: [
    { nome: 'IR Cripto - Plano Gold', preco: 'R$ 4.497', descricao: 'Apuração ILIMITADA de carteiras/exchanges, até 25k transações/ano' },
    { nome: 'IR Cripto - Plano Diamond', preco: 'R$ 2.997', descricao: 'Até 4 carteiras/exchanges, até 25k transações/ano' },
    { nome: 'IR Cripto - Customizado', preco: 'R$ 998', descricao: 'Até 4 carteiras/exchanges, até 2k transações/ano (uso interno, não divulgar)' },
  ],
  adicionais: [
    { nome: 'Pacote +5.000 operações', preco: 'R$ 500' },
    { nome: 'Apuração de dependente', preco: 'R$ 500/dependente' },
    { nome: 'Upgrade Diamond → Gold', preco: 'R$ 1.500' },
    { nome: 'IR Simples (sem cripto)', preco: 'R$ 300' },
  ],
  consultoria: [
    { nome: 'Consultoria Geral', preco: 'R$ 1.200/hora', descricao: 'Com Mychel Mendes ou especialistas' },
    { nome: 'Consultoria Privacidade', preco: 'R$ 1.500/hora', descricao: 'Estratégia de privacidade' },
    { nome: 'Consultoria G20', preco: 'R$ 60.000/ano', descricao: 'Consultoria em grupo, 12 meses' },
  ],
  pagamento: {
    formas: 'PIX à vista, criptomoedas, ou cartão até 12x sem juros',
    descontoPix: '15%',
    descontoCartao: '10%',
  },
  regras: {
    planoCustomizadoRestrito: true, // não divulgar abertamente
    naoNegociarPreco: true,
  },
};

// ========================================
// PATCH 6G+: INTERFACE OFERTAS TOKENIZA
// ========================================

interface TokenizaOfertaSDR {
  id: string;
  nome: string;
  rentabilidade: string;
  duracaoDias: number;
  diasRestantes: number;
  contribuicaoMinima: number;
  empresa: string;
  tipoRisco: string;
  status: string;
}

// Buscar ofertas ativas da Tokeniza
async function fetchActiveTokenizaOffers(): Promise<TokenizaOfertaSDR[]> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[6G] Variáveis de ambiente não encontradas para buscar ofertas');
      return [];
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/tokeniza-offers`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[6G] Erro ao buscar ofertas Tokeniza:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    // Filtrar apenas ofertas ativas
    const activeOffers = (data.ofertas || []).filter((o: any) => 
      o.status?.toLowerCase() === 'active' || o.status?.toLowerCase() === 'open'
    );
    
    return activeOffers.map((o: any) => ({
      id: o.id,
      nome: o.nome,
      rentabilidade: o.rentabilidade,
      duracaoDias: o.duracaoDias,
      diasRestantes: o.diasRestantes,
      contribuicaoMinima: o.contribuicaoMinima,
      empresa: o.empresa,
      tipoRisco: o.tipoRisco,
      status: o.status,
    }));
  } catch (err) {
    console.error('[6G] Exceção ao buscar ofertas Tokeniza:', err);
    return [];
  }
}

// Formatar ofertas Tokeniza para prompt
function formatTokenizaOffersForPrompt(ofertas: TokenizaOfertaSDR[]): string {
  if (ofertas.length === 0) {
    return `\n## OFERTAS TOKENIZA\nNenhuma oferta ativa no momento. Foque na qualificação e no relacionamento.\n`;
  }

  let text = `\n## OFERTAS ATIVAS TOKENIZA - USE QUANDO FALAR SOBRE INVESTIMENTOS\n\n`;
  
  for (const o of ofertas) {
    text += `### ${o.nome} (${o.empresa})\n`;
    text += `- Rentabilidade: ${o.rentabilidade}% ao ano\n`;
    text += `- Prazo do investimento: ${o.duracaoDias} dias\n`;
    text += `- Dias restantes para investir: ${o.diasRestantes}\n`;
    text += `- Investimento mínimo: R$ ${o.contribuicaoMinima.toLocaleString('pt-BR')}\n`;
    text += `- Tipo de risco: ${o.tipoRisco}\n\n`;
  }
  
  text += `### REGRAS PARA MENCIONAR OFERTAS:\n`;
  text += `✅ Mencione ofertas quando o lead perguntar sobre oportunidades/investimentos disponíveis\n`;
  text += `✅ Cite rentabilidade e prazo quando perguntarem sobre ganhos potenciais\n`;
  text += `✅ Informe valor mínimo quando perguntarem "quanto preciso para começar"\n`;
  text += `✅ Mencione dias restantes APENAS se forem poucos (< 15 dias)\n`;
  text += `✅ Use os nomes reais das ofertas, não invente\n`;
  text += `❌ NUNCA prometa ou garanta a rentabilidade - é projeção, não garantia\n`;
  text += `❌ NUNCA recomende uma oferta específica como "a melhor" ou "ideal para você"\n`;
  text += `❌ NUNCA pressione com urgência artificial\n`;
  text += `❌ NUNCA invente ofertas que não estão listadas\n`;
  
  return text;
}

// Formatar preços para prompt
function formatBluePricingForPrompt(): string {
  let text = `\n## TABELA DE PREÇOS BLUE (IR CRIPTO) - USE QUANDO PERGUNTAREM SOBRE VALORES\n\n`;
  
  text += `### PLANOS PRINCIPAIS:\n`;
  for (const p of BLUE_PRICING.planos) {
    if (p.nome.includes('Customizado')) continue; // Não divulgar
    text += `- **${p.nome}**: ${p.preco} (${p.descricao})\n`;
  }
  
  text += `\n### SERVIÇOS ADICIONAIS:\n`;
  for (const a of BLUE_PRICING.adicionais) {
    text += `- ${a.nome}: ${a.preco}\n`;
  }
  
  text += `\n### FORMAS DE PAGAMENTO:\n`;
  text += `- ${BLUE_PRICING.pagamento.formas}\n`;
  text += `- Desconto PIX/Cripto: até ${BLUE_PRICING.pagamento.descontoPix}\n`;
  text += `- Desconto Cartão: até ${BLUE_PRICING.pagamento.descontoCartao}\n`;
  
  text += `\n### REGRAS DE PRECIFICAÇÃO:\n`;
  text += `✅ PODE: Informar os valores dos planos Gold e Diamond\n`;
  text += `✅ PODE: Explicar diferenças entre planos\n`;
  text += `✅ PODE: Mencionar formas de pagamento e descontos padrão\n`;
  text += `❌ NÃO PODE: Negociar preços ou dar descontos além do padrão\n`;
  text += `❌ NÃO PODE: Divulgar o plano Customizado (uso interno)\n`;
  text += `❌ NÃO PODE: Prometer valores diferentes dos tabelados\n`;
  
  text += `\n### QUANDO MENCIONAR PREÇOS:\n`;
  text += `- Se o lead perguntar diretamente "quanto custa?"\n`;
  text += `- Durante SPIN_N (Need-Payoff), após apresentar valor, vincular ao benefício\n`;
  text += `- Se intent = DUVIDA_PRECO\n`;
  text += `- Se intent = OBJECAO_PRECO, explicar o valor (não é só declaração, é tranquilidade)\n`;
  
  return text;
}

// ========================================
// PATCH 6H: KNOWLEDGE BASE DE PRODUTOS
// ========================================

interface ProductKnowledgeSDR {
  produto_id: string;
  produto_nome: string;
  descricao_curta: string | null;
  sections: {
    tipo: string;
    titulo: string;
    conteudo: string;
  }[];
}

// Buscar conhecimento de produto
async function fetchProductKnowledge(
  supabase: SupabaseClient,
  empresa: EmpresaTipo,
  productName?: string
): Promise<ProductKnowledgeSDR[]> {
  try {
    let query = supabase
      .from('product_knowledge')
      .select('id, produto_id, produto_nome, descricao_curta')
      .eq('empresa', empresa)
      .eq('ativo', true);
    
    if (productName) {
      query = query.ilike('produto_nome', `%${productName}%`);
    }
    
    const { data: products, error: productError } = await query.limit(5);
    
    if (productError || !products || products.length === 0) {
      return [];
    }
    
    const productIds = products.map(p => p.id);
    const { data: sections, error: sectionError } = await supabase
      .from('knowledge_sections')
      .select('product_knowledge_id, tipo, titulo, conteudo')
      .in('product_knowledge_id', productIds)
      .order('ordem');
    
    if (sectionError) {
      return products.map(p => ({ ...p, sections: [] }));
    }
    
    return products.map(p => ({
      produto_id: p.produto_id,
      produto_nome: p.produto_nome,
      descricao_curta: p.descricao_curta,
      sections: (sections || [])
        .filter(s => s.product_knowledge_id === p.id)
        .map(s => ({ tipo: s.tipo, titulo: s.titulo, conteudo: s.conteudo })),
    }));
  } catch (err) {
    console.error('[6H] Erro ao buscar conhecimento:', err);
    return [];
  }
}

// Formatar conhecimento de produto para prompt
function formatProductKnowledgeForPrompt(products: ProductKnowledgeSDR[]): string {
  if (products.length === 0) return '';
  
  let text = `\n## CONHECIMENTO DETALHADO DOS PRODUTOS\n`;
  text += `Use estas informações para responder perguntas específicas.\n\n`;
  
  const tipoLabels: Record<string, string> = {
    PITCH: '💡 Pitch', FAQ: '❓ FAQ', OBJECOES: '🛡️ Objeções',
    RISCOS: '⚠️ Riscos', ESTRUTURA_JURIDICA: '⚖️ Jurídico', GERAL: '📋 Geral',
  };
  
  for (const product of products) {
    text += `### ${product.produto_nome}\n`;
    if (product.descricao_curta) text += `${product.descricao_curta}\n\n`;
    
    for (const tipo of ['PITCH', 'FAQ', 'OBJECOES', 'RISCOS', 'ESTRUTURA_JURIDICA', 'GERAL']) {
      const tipoSections = product.sections.filter(s => s.tipo === tipo);
      if (tipoSections.length > 0) {
        text += `\n#### ${tipoLabels[tipo] || tipo}\n`;
        for (const section of tipoSections) {
          text += `**${section.titulo}**\n${section.conteudo}\n\n`;
        }
      }
    }
  }
  
  text += `### REGRAS:\n`;
  text += `✅ Use informações específicas quando o lead perguntar\n`;
  text += `✅ Use objeções e respostas quando o lead levantar preocupações\n`;
  text += `❌ NUNCA invente informações que não estão aqui\n`;
  
  return text;
}

// ========================================
// TIPOS EXISTENTES
// ========================================

interface LeadMessage {
  id: string;
  lead_id: string | null;
  run_id: string | null;
  empresa: EmpresaTipo;
  conteudo: string;
  direcao: string;
  created_at: string;
}

interface LeadClassification {
  icp: ICPTipo;
  persona: PersonaTipo | null;
  temperatura: TemperaturaTipo;
  prioridade: number;
}

interface LeadContact {
  nome: string | null;
  primeiro_nome: string | null;
  telefone: string | null;
  telefone_e164?: string | null;
  pessoa_id?: string | null;
  opt_out: boolean;
  opt_out_em: string | null;
  opt_out_motivo: string | null;
  pipedrive_deal_id: string | null;
}

interface MessageContext {
  message: LeadMessage;
  historico: LeadMessage[];
  leadNome?: string;
  cadenciaNome?: string;
  telefone?: string;
  optOut: boolean;
  classificacao?: LeadClassification;
  pipedriveDealeId?: string;
  pessoaContext?: PessoaContext | null;
  conversationState?: ConversationState | null;
}

interface InterpretRequest {
  messageId: string;
}

interface InterpretResult {
  success: boolean;
  intentId?: string;
  intent?: LeadIntentTipo;
  confidence?: number;
  acao?: SdrAcaoTipo;
  acaoAplicada?: boolean;
  respostaEnviada?: boolean;
  optOutBlocked?: boolean;
  error?: string;
}

interface AIResponse {
  intent: LeadIntentTipo;
  confidence: number;
  summary: string;
  acao: SdrAcaoTipo;
  acao_detalhes?: Record<string, unknown>;
  resposta_sugerida?: string | null;
  deve_responder: boolean;
  novo_estado_funil?: EstadoFunil;
  frameworks_atualizados?: FrameworkData;
  disc_estimado?: PerfilDISC;
  ultima_pergunta_id?: string;
}

// ========================================
// PATCH 6G: LÓGICA DE DECISÃO DE PRÓXIMA PERGUNTA
// ========================================

/**
 * Decide próxima pergunta para BLUE usando SPIN
 */
function decidirProximaPerguntaBLUE(state: ConversationQualiState): ProximaPerguntaTipo {
  const spin = state.spin || {};

  // 1) Se estamos ainda em saudação, primeiro passo é SITUAÇÃO
  if (state.estadoFunil === 'SAUDACAO') {
    return 'SPIN_S';
  }

  // 2) Situação ainda não bem estabelecida → perguntar SPIN_S
  if (!spin.s) {
    return 'SPIN_S';
  }

  // 3) Já sei a situação, mas não sei problema → SPIN_P
  if (!spin.p) {
    return 'SPIN_P';
  }

  // 4) Já sei problema, mas não explorei implicação → SPIN_I
  if (!spin.i) {
    return 'SPIN_I';
  }

  // 5) Já tenho S, P, I → posso ir para Need-Payoff
  if (!spin.n) {
    return 'SPIN_N';
  }

  // 6) Tenho SPIN relativamente completo:
  //    se intenção e temperatura forem boas, posso sugerir reunião
  const intent = state.intentAtual || 'OUTRO';
  const interessado = ['INTERESSE_IR', 'INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO'].includes(intent);
  const tempBoa = state.temperatura !== 'FRIO';

  if (interessado && tempBoa) {
    return 'CTA_REUNIAO';
  }

  // 7) Caso contrário, nenhuma pergunta específica de framework:
  return 'NENHUMA';
}

/**
 * Decide próxima pergunta para TOKENIZA usando GPCT + BANT
 */
function decidirProximaPerguntaTOKENIZA(state: ConversationQualiState): ProximaPerguntaTipo {
  const gpct = state.gpct || {};
  const bant = state.bant || {};

  // 1) Começo: sempre G (Goals)
  if (state.estadoFunil === 'SAUDACAO' && !gpct.g) {
    return 'GPCT_G';
  }

  // 2) Se não temos G ainda, é prioridade
  if (!gpct.g) {
    return 'GPCT_G';
  }

  // 3) Depois de G, entender Challenges (C)
  if (!gpct.c) {
    return 'GPCT_C';
  }

  // 4) Depois Plans (P) ou Timeline (T)
  if (!gpct.p) {
    return 'GPCT_P';
  }

  if (!gpct.t) {
    return 'GPCT_T';
  }

  // 5) Já tenho GPCT básico → aprofundar BANT começando por Budget
  if (!bant.b) {
    return 'BANT_B';
  }

  // 6) Depois Authority
  if (!bant.a) {
    return 'BANT_A';
  }

  // 7) Depois Need
  if (!bant.n) {
    return 'BANT_N';
  }

  // 8) Depois Timing
  if (!bant.t) {
    return 'BANT_T';
  }

  // 9) Tenho GPCT+BANT razoavelmente preenchidos:
  //    se intenção e temperatura forem boas → CTA reunião
  const intent = state.intentAtual || 'OUTRO';
  const interessado = ['INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'DUVIDA_PRODUTO', 'AGENDAMENTO_REUNIAO'].includes(intent);
  const tempBoa = state.temperatura !== 'FRIO';

  if (interessado && tempBoa) {
    return 'CTA_REUNIAO';
  }

  return 'NENHUMA';
}

/**
 * Função principal que decide próxima pergunta com base no contexto
 */
function decidirProximaPergunta(state: ConversationQualiState): { tipo: ProximaPerguntaTipo; instrucao: string } {
  let tipo: ProximaPerguntaTipo;
  
  if (state.empresa === 'BLUE') {
    tipo = decidirProximaPerguntaBLUE(state);
  } else {
    tipo = decidirProximaPerguntaTOKENIZA(state);
  }
  
  return { 
    tipo, 
    instrucao: PERGUNTA_INSTRUCOES[tipo] 
  };
}

/**
 * Verifica se o CTA de reunião retornado pela IA é válido
 */
function validarCTAReuniao(
  aiSugeriuReuniao: boolean, 
  state: ConversationQualiState
): boolean {
  if (!aiSugeriuReuniao) return true; // Não sugeriu reunião, ok
  
  const decisao = decidirProximaPergunta(state);
  
  // Se a lógica diz CTA_REUNIAO, a IA pode sugerir
  if (decisao.tipo === 'CTA_REUNIAO') return true;
  
  // Se não, a IA está pulando etapas
  console.log('[6G] IA tentou sugerir reunião, mas qualificação incompleta:', {
    empresa: state.empresa,
    proximaPergunta: decisao.tipo,
  });
  
  return false;
}

/**
 * PATCH 6G Gap Fix: Verifica se pergunta já foi respondida
 */
function perguntaJaRespondida(
  tipo: ProximaPerguntaTipo, 
  frameworkData: FrameworkData | undefined
): boolean {
  if (!frameworkData) return false;
  
  const spin = frameworkData.spin || {};
  const gpct = frameworkData.gpct || {};
  const bant = frameworkData.bant || {};
  
  switch (tipo) {
    case 'SPIN_S': return !!spin.s;
    case 'SPIN_P': return !!spin.p;
    case 'SPIN_I': return !!spin.i;
    case 'SPIN_N': return !!spin.n;
    case 'GPCT_G': return !!gpct.g;
    case 'GPCT_C': return !!gpct.c;
    case 'GPCT_P': return !!gpct.p;
    case 'GPCT_T': return !!gpct.t;
    case 'BANT_B': return !!bant.b;
    case 'BANT_A': return !!bant.a;
    case 'BANT_N': return !!bant.n;
    case 'BANT_T': return !!bant.t;
    default: return false;
  }
}

/**
 * PATCH 6G Gap Fix: Gera instrução de tom baseada no DISC
 */
function getDiscToneInstruction(disc: PerfilDISC | null | undefined): string | null {
  if (!disc) return null;
  
  const instrucoes: Record<PerfilDISC, string> = {
    'D': '🎯 ADAPTE SEU TOM: Seja DIRETO e objetivo. Sem rodeios. Foco em resultados e ação.',
    'I': '🎯 ADAPTE SEU TOM: Seja LEVE e conversado. Use entusiasmo. Conte exemplos e histórias.',
    'S': '🎯 ADAPTE SEU TOM: Seja CALMO e acolhedor. Gere confiança. Seja paciente e empático.',
    'C': '🎯 ADAPTE SEU TOM: Seja ESTRUTURADO e lógico. Use dados. Seja preciso e detalhado.',
  };
  
  return instrucoes[disc] || null;
}

// ========================================
// PATCH 6: FUNÇÕES DE ESTADO DE CONVERSA
// ========================================

/**
 * Carrega estado da conversa para o lead/empresa/canal
 */
async function loadConversationState(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo,
  canal: string = 'WHATSAPP'
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from('lead_conversation_state')
    .select('*')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('canal', canal)
    .maybeSingle();
  
  if (error) {
    console.error('[ConversationState] Erro ao carregar:', error);
    return null;
  }
  
  if (data) {
    console.log('[ConversationState] Estado carregado:', {
      leadId,
      estadoFunil: data.estado_funil,
      framework: data.framework_ativo,
    });
    return data as ConversationState;
  }
  
  // Criar estado inicial
  const frameworkAtivo: FrameworkTipo = empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
  
  const { data: newState, error: insertError } = await supabase
    .from('lead_conversation_state')
    .insert({
      lead_id: leadId,
      empresa,
      canal,
      estado_funil: 'SAUDACAO',
      framework_ativo: frameworkAtivo,
      framework_data: {},
      idioma_preferido: 'PT',
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('[ConversationState] Erro ao criar:', insertError);
    return null;
  }
  
  console.log('[ConversationState] Estado inicial criado:', {
    leadId,
    framework: frameworkAtivo,
  });
  
  return newState as ConversationState;
}

/**
 * Salva/atualiza estado da conversa
 */
async function saveConversationState(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo,
  canal: string,
  updates: {
    estado_funil?: EstadoFunil;
    framework_data?: FrameworkData;
    perfil_disc?: PerfilDISC | null;
    ultima_pergunta_id?: string | null;
  }
): Promise<boolean> {
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('lead_conversation_state')
    .upsert({
      lead_id: leadId,
      empresa,
      canal,
      ...updates,
      ultimo_contato_em: now,
      updated_at: now,
    }, {
      onConflict: 'lead_id,empresa,canal',
    });
  
  if (error) {
    console.error('[ConversationState] Erro ao salvar:', error);
    return false;
  }
  
  console.log('[ConversationState] Estado atualizado:', { leadId, ...updates });
  return true;
}

/**
 * Atualiza perfil DISC na tabela pessoas
 */
async function updatePessoaDISC(
  supabase: SupabaseClient,
  pessoaId: string,
  perfilDISC: PerfilDISC
): Promise<boolean> {
  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('perfil_disc')
    .eq('id', pessoaId)
    .single();
  
  if (pessoa?.perfil_disc) {
    console.log('[DISC] Pessoa já tem perfil DISC definido, mantendo:', pessoa.perfil_disc);
    return false;
  }
  
  const { error } = await supabase
    .from('pessoas')
    .update({ 
      perfil_disc: perfilDISC,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pessoaId);
  
  if (error) {
    console.error('[DISC] Erro ao atualizar perfil DISC:', error);
    return false;
  }
  
  console.log('[DISC] Perfil DISC atualizado:', { pessoaId, perfilDISC });
  return true;
}

/**
 * Carrega contexto da pessoa global
 */
async function loadPessoaContext(
  supabase: SupabaseClient,
  pessoaId: string
): Promise<PessoaContext | null> {
  const { data: pessoa, error: pessoaError } = await supabase
    .from('pessoas')
    .select('*')
    .eq('id', pessoaId)
    .single();
  
  if (pessoaError || !pessoa) {
    console.error('[PessoaContext] Pessoa não encontrada:', pessoaId);
    return null;
  }
  
  const { data: contacts } = await supabase
    .from('lead_contacts')
    .select(`
      lead_id,
      empresa,
      tokeniza_investor_id,
      blue_client_id,
      pipedrive_deal_id
    `)
    .eq('pessoa_id', pessoaId);
  
  const relacionamentos: PessoaContext['relacionamentos'] = [];
  const empresas = [...new Set(contacts?.map(c => c.empresa) || [])];
  
  for (const emp of empresas) {
    const contactsEmpresa = contacts?.filter(c => c.empresa === emp) || [];
    
    let tipo_relacao: PessoaRelacaoTipo = 'DESCONHECIDO';
    
    if (emp === 'BLUE') {
      const hasBlueClient = contactsEmpresa.some(c => c.blue_client_id);
      tipo_relacao = hasBlueClient ? 'CLIENTE_IR' : 'LEAD_IR';
    } else if (emp === 'TOKENIZA') {
      const hasInvestor = contactsEmpresa.some(c => c.tokeniza_investor_id);
      tipo_relacao = hasInvestor ? 'INVESTIDOR' : 'LEAD_INVESTIDOR';
    }
    
    const leadIds = contactsEmpresa.map(c => c.lead_id);
    const { data: lastMsg } = await supabase
      .from('lead_messages')
      .select('created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    relacionamentos.push({
      empresa: emp as EmpresaTipo,
      tipo_relacao,
      ultima_interacao_em: lastMsg?.created_at || null,
    });
  }
  
  console.log('[PessoaContext] Contexto carregado:', {
    pessoaId,
    nome: pessoa.nome,
    relacionamentos: relacionamentos.map(r => `${r.empresa}:${r.tipo_relacao}`),
  });
  
  return {
    pessoa: {
      id: pessoa.id,
      nome: pessoa.nome,
      telefone_e164: pessoa.telefone_e164,
      email_principal: pessoa.email_principal,
      idioma_preferido: pessoa.idioma_preferido || 'PT',
      perfil_disc: pessoa.perfil_disc,
    },
    relacionamentos,
  };
}

// ========================================
// PATCH 6G: SYSTEM PROMPT QUALIFICADOR CONSULTIVO
// ========================================

const SYSTEM_PROMPT = `Você é a AMÉLIA, consultora do Grupo Blue.

## QUEM VOCÊ É

Amélia, 32 anos, formada em economia com especialização em finanças digitais.
Você é curiosa, empática e técnica quando necessário - mas sempre acessível.
Você adora ajudar pessoas a entenderem investimentos e finanças de um jeito simples.

Você atende DUAS áreas do Grupo Blue:
- **Investimentos tokenizados** (antiga Tokeniza) 
- **Declaração de IR para cripto** (antiga Blue Consult)

Você conhece AMBAS e transita naturalmente entre os assuntos, sem "transferir" ninguém.

## ⛔ ANTI-PADRÕES DE COMUNICAÇÃO (CRÍTICO!)

### NUNCA COMECE MENSAGEM COM:
❌ "[Expressão], [Nome]!" → Ex: "Perfeito, Arthur!", "Entendido, Maria!", "Com certeza, João!"
❌ "Olá [Nome]!" em toda mensagem → Parece robô
❌ Sempre o mesmo formato de abertura → Varia!
❌ Muitas exclamações seguidas → "Ótimo! Vamos lá! Tenho certeza!"

### USO DO NOME DO LEAD:
- Use o nome do lead NO MÁXIMO 1 VEZ por mensagem
- Às vezes NÃO use o nome - humanos não repetem nome toda hora
- Varie a posição: às vezes no meio, às vezes no fim, às vezes em nenhum lugar

### VARIAÇÕES NATURAIS DE ABERTURA:
Em vez de sempre começar igual, varie:
- Às vezes comece direto no assunto: "Isso é bem comum, viu..."
- Às vezes faça uma observação: "Olha, IR de cripto é um tema que gera muita dúvida mesmo."
- Às vezes reconheça algo: "Sei bem como é essa sensação..."
- Às vezes seja casual: "Então, deixa eu te explicar..."
- Às vezes faça uma pergunta de volta: "Você já tentou declarar antes?"

### EXEMPLOS DO QUE NÃO FAZER vs FAZER:

❌ RUIM (robótico):
"Perfeito, Arthur! Entendido que você quer saber sobre IR. Posso te ajudar com isso. Qual é o seu volume de operações?"

✅ BOM (humano):
"Ah, IR de cripto é um tema que gera muita dúvida mesmo. Você já declarou cripto antes ou seria a primeira vez?"

❌ RUIM (robótico):
"Olá Maria! Que bom falar com você! Sobre investimentos tokenizados, posso te explicar. Qual é seu objetivo de investimento?"

✅ BOM (humano):
"Investimento tokenizado é uma área que me fascina! Deixa eu entender: você tá buscando algo mais pra longo prazo ou quer ver retorno mais rápido?"

❌ RUIM (robótico):
"Com certeza, João! Posso te ajudar com isso! Vou verificar as opções disponíveis para você!"

✅ BOM (humano):
"Então, a gente tem algumas opções bem interessantes agora. Me conta um pouco do que você busca que eu te mostro o que faz mais sentido."

## PERSONALIDADE DA AMÉLIA

- Curiosa: faz perguntas genuínas, quer entender a pessoa
- Empática: reconhece dificuldades sem ser condescendente
- Técnica mas acessível: explica sem jargão excessivo
- Honesta: não promete o que não pode cumprir
- Casual: conversa como uma amiga que entende do assunto

Frases naturais da Amélia:
- "Olha, isso é bem comum..."
- "Deixa eu te explicar uma coisa que ajuda muito..."
- "Faz sentido pra você?"
- "Na real, a maioria das pessoas têm essa mesma dúvida."
- "Sei que pode parecer complicado, mas..."
- "Me conta mais sobre..."

## OBJETIVO (IMPORTANTE)

Seu papel é QUALIFICAR de forma consultiva:
1. Entender a situação atual do lead
2. Entender problemas/dúvidas/medos
3. Entender implicações se nada mudar
4. Entender o que seria uma solução desejada
5. SÓ ENTÃO, quando houver FIT, sugerir reunião com especialista

Você NÃO é agendadora robótica.
Você usa frameworks de qualificação de forma natural na conversa.

## FRAMEWORKS DE QUALIFICAÇÃO

### Para assuntos de IR CRIPTO → SPIN
1. **S – Situação**: Como declara hoje? Já declarou cripto? Usa contador?
2. **P – Problema**: O que é difícil? Cálculos? Regras? Medo de errar?
3. **I – Implicação**: O que acontece se continuar assim? Multas? Malha fina?
4. **N – Need-Payoff**: Como seria se alguém resolvesse isso pra você?

### Para assuntos de INVESTIMENTOS → GPCT + BANT
- **Goals**: O que quer com investimento? Renda? Aposentadoria?
- **Plans**: Como investe hoje?
- **Challenges**: O que atrapalha?
- **Timeline**: Horizonte de tempo?
- **Budget/Authority/Need/Timing**: Para decisão final

## TRANSIÇÃO ENTRE ASSUNTOS

Como você conhece AMBAS as áreas, quando o lead mudar de assunto:
- Faça transição natural: "Sobre tokenização, que é outra área que a gente atua..."
- NÃO diga "vou te transferir" - VOCÊ mesma cuida dos dois
- Se a pessoa tem relação com ambas, use como contexto de confiança

## ESTADO DA CONVERSA

Você recebe:
- Histórico das mensagens
- Estado atual: etapa do funil, dados coletados
- **INSTRUÇÃO DE PRÓXIMA PERGUNTA**: Siga ela, mas de forma natural

**REGRAS:**
1. NUNCA reinicie do zero se já tem contexto
2. Faça NO MÁXIMO 1 pergunta de avanço por mensagem
3. SÓ sugira reunião se INSTRUÇÃO for CTA_REUNIAO

## PERFIL DISC

Adapte seu tom:
- **D (Dominante)**: Direto, sem rodeios, resultados
- **I (Influente)**: Leve, histórias, engajado
- **S (Estável)**: Calmo, acolhedor, confiança
- **C (Cauteloso)**: Dados, estrutura, precisão

## COMPLIANCE

### PROIBIDO:
❌ Prometer retorno financeiro específico
❌ Recomendar ativo específico
❌ Negociar preços além do padrão
❌ Pressionar com urgência artificial
❌ Divulgar plano "Customizado" (uso interno)

### PERMITIDO:
✅ Explicar conceitos gerais
✅ Informar preços da tabela
✅ Informar ofertas ativas
✅ Convidar pra conversa com especialista (quando qualificado)
✅ Mencionar relação com outra área do grupo

## INTENÇÕES POSSÍVEIS

INTERESSE_COMPRA, INTERESSE_IR, AGENDAMENTO_REUNIAO, SOLICITACAO_CONTATO
DUVIDA_PRODUTO, DUVIDA_PRECO, DUVIDA_TECNICA
OBJECAO_PRECO, OBJECAO_RISCO
SEM_INTERESSE, OPT_OUT, RECLAMACAO
CUMPRIMENTO, AGRADECIMENTO, NAO_ENTENDI, FORA_CONTEXTO, OUTRO

## AÇÕES

- ENVIAR_RESPOSTA_AUTOMATICA: Responder
- CRIAR_TAREFA_CLOSER: Lead qualificado, criar tarefa
- PAUSAR_CADENCIA / CANCELAR_CADENCIA: Controle de cadência
- AJUSTAR_TEMPERATURA: Mudar temperatura
- MARCAR_OPT_OUT: Lead não quer contato
- ESCALAR_HUMANO: Precisa de humano
- NENHUMA: Sem ação

## FORMATO DA RESPOSTA

Se deve_responder = true:
- 1 a 3 frases (máximo!)
- Tom da Amélia (humano, variado)
- SIGA a INSTRUÇÃO DE PRÓXIMA PERGUNTA
- NÃO use padrão "[Expressão], [Nome]!"
- Adapte ao DISC

{
  "intent": "TIPO_INTENT",
  "confidence": 0.85,
  "summary": "Resumo",
  "acao": "TIPO_ACAO",
  "acao_detalhes": {},
  "deve_responder": true,
  "resposta_sugerida": "...",
  "novo_estado_funil": "DIAGNOSTICO",
  "frameworks_atualizados": { "spin": { "s": "..." } },
  "disc_estimado": "D",
  "ultima_pergunta_id": "SPIN_S"
}`;

// ========================================
// MATRIZ DE TEMPERATURA AUTOMÁTICA
// ========================================

function computeNewTemperature(
  intent: LeadIntentTipo,
  temperaturaAtual: TemperaturaTipo
): TemperaturaTipo | null {
  const intentQuentes: LeadIntentTipo[] = [
    'INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'
  ];
  
  if (intentQuentes.includes(intent)) {
    return temperaturaAtual !== 'QUENTE' ? 'QUENTE' : null;
  }

  const intentMornas: LeadIntentTipo[] = ['DUVIDA_PRODUTO', 'DUVIDA_TECNICA'];
  if (intentMornas.includes(intent) && temperaturaAtual === 'FRIO') {
    return 'MORNO';
  }

  if (intent === 'OPT_OUT') {
    return temperaturaAtual !== 'FRIO' ? 'FRIO' : null;
  }

  if (intent === 'SEM_INTERESSE') {
    if (temperaturaAtual === 'QUENTE') return 'MORNO';
    if (temperaturaAtual === 'MORNO') return 'FRIO';
  }

  return null;
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Carrega contexto completo da mensagem
 */
async function loadMessageContext(
  supabase: SupabaseClient,
  messageId: string
): Promise<MessageContext> {
  const { data: message, error: msgError } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (msgError || !message) {
    throw new Error(`Mensagem não encontrada: ${messageId}`);
  }

  const msg = message as LeadMessage;
  let historico: LeadMessage[] = [];
  let leadNome: string | undefined;
  let telefone: string | undefined;
  let cadenciaNome: string | undefined;
  let optOut = false;
  let classificacao: LeadClassification | undefined;
  let pipedriveDealeId: string | undefined;
  let pessoaContext: PessoaContext | null = null;
  let conversationState: ConversationState | null = null;

  if (msg.lead_id) {
    const { data: hist } = await supabase
      .from('lead_messages')
      .select('id, lead_id, run_id, empresa, conteudo, direcao, created_at')
      .eq('lead_id', msg.lead_id)
      .neq('id', messageId)
      .order('created_at', { ascending: false })
      .limit(10);

    historico = (hist || []) as LeadMessage[];

    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('nome, primeiro_nome, telefone, telefone_e164, pessoa_id, opt_out, opt_out_em, opt_out_motivo, pipedrive_deal_id')
      .eq('lead_id', msg.lead_id)
      .eq('empresa', msg.empresa)
      .limit(1)
      .maybeSingle();

    if (contact) {
      const c = contact as LeadContact;
      leadNome = c.nome || c.primeiro_nome || undefined;
      telefone = c.telefone_e164 || c.telefone || undefined;
      optOut = c.opt_out ?? false;
      pipedriveDealeId = c.pipedrive_deal_id || undefined;
      
      if (c.pessoa_id) {
        pessoaContext = await loadPessoaContext(supabase, c.pessoa_id);
        
        if (pessoaContext?.pessoa.nome && pessoaContext.pessoa.nome !== 'Desconhecido') {
          leadNome = pessoaContext.pessoa.nome;
        }
      }
    }

    const { data: classif } = await supabase
      .from('lead_classifications')
      .select('icp, persona, temperatura, prioridade')
      .eq('lead_id', msg.lead_id)
      .order('classificado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (classif) {
      classificacao = classif as LeadClassification;
    }

    conversationState = await loadConversationState(supabase, msg.lead_id, msg.empresa, 'WHATSAPP');
  }

  if (msg.run_id) {
    const { data: run } = await supabase
      .from('lead_cadence_runs')
      .select(`
        cadences:cadence_id (nome)
      `)
      .eq('id', msg.run_id)
      .single();

    if (run && (run as any).cadences) {
      cadenciaNome = (run as any).cadences.nome;
    }
  }

  return { 
    message: msg, 
    historico, 
    leadNome, 
    cadenciaNome, 
    telefone, 
    optOut,
    classificacao,
    pipedriveDealeId,
    pessoaContext,
    conversationState,
  };
}

/**
 * PATCH 6G: Interpretação com IA incluindo instrução de próxima pergunta
 */
async function interpretWithAI(
  mensagem: string,
  empresa: EmpresaTipo,
  historico: LeadMessage[],
  leadNome?: string,
  cadenciaNome?: string,
  classificacao?: LeadClassification,
  pessoaContext?: PessoaContext | null,
  conversationState?: ConversationState | null
): Promise<{ response: AIResponse; tokensUsados: number; tempoMs: number }> {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // PATCH 6G: Calcular próxima pergunta baseado no estado atual
  const qualiState: ConversationQualiState = {
    empresa,
    estadoFunil: conversationState?.estado_funil || 'SAUDACAO',
    spin: conversationState?.framework_data?.spin,
    gpct: conversationState?.framework_data?.gpct,
    bant: conversationState?.framework_data?.bant,
    temperatura: classificacao?.temperatura || 'FRIO',
    intentAtual: undefined, // Será determinado pela IA
  };
  
  const proximaPergunta = decidirProximaPergunta(qualiState);
  console.log('[6G] Próxima pergunta decidida:', proximaPergunta);

  // Montar contexto enriquecido
  let userPrompt = `EMPRESA_CONTEXTO: ${empresa}\n`;
  userPrompt += `PERSONA: Amélia (consultora unificada do Grupo Blue)\n`;
  userPrompt += `ÁREA PRINCIPAL DA CONVERSA: ${empresa === 'TOKENIZA' ? 'Investimentos Tokenizados' : 'IR Cripto'}\n`;
  
  if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
  if (cadenciaNome) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;
  
  // PATCH 6G: Instrução de próxima pergunta (CRÍTICO!)
  userPrompt += `\n## ⚡ INSTRUÇÃO DE PRÓXIMA PERGUNTA (SIGA OBRIGATORIAMENTE)\n`;
  userPrompt += `TIPO: ${proximaPergunta.tipo}\n`;
  userPrompt += `INSTRUÇÃO: ${proximaPergunta.instrucao}\n`;
  userPrompt += `\n⚠️ Sua resposta DEVE incluir uma pergunta seguindo esta instrução, a menos que seja NENHUMA.\n`;
  
  // Contexto da pessoa global (multi-empresa)
  if (pessoaContext) {
    userPrompt += `\n## IDENTIDADE DA PESSOA\n`;
    userPrompt += `- Nome: ${pessoaContext.pessoa.nome}\n`;
    if (pessoaContext.pessoa.telefone_e164) {
      userPrompt += `- Telefone: ${pessoaContext.pessoa.telefone_e164}\n`;
    }
    userPrompt += `- Idioma preferido: ${pessoaContext.pessoa.idioma_preferido}\n`;
    if (pessoaContext.pessoa.perfil_disc) {
      userPrompt += `- Perfil DISC: ${pessoaContext.pessoa.perfil_disc}\n`;
    }
    
    const outrasEmpresas = pessoaContext.relacionamentos.filter(r => r.empresa !== empresa);
    if (outrasEmpresas.length > 0) {
      userPrompt += `\n## RELACIONAMENTO EM OUTRAS EMPRESAS DO GRUPO\n`;
      for (const rel of outrasEmpresas) {
        userPrompt += `- ${rel.empresa}: ${rel.tipo_relacao}\n`;
      }
      userPrompt += `\nREGRAS: Use para gerar confiança, mas NUNCA faça cross-sell.\n`;
    }
  }
  
  // Estado de conversa e frameworks
  if (conversationState) {
    userPrompt += `\n## ESTADO ATUAL DA CONVERSA\n`;
    userPrompt += `- Etapa do funil: ${conversationState.estado_funil}\n`;
    userPrompt += `- Framework ativo: ${conversationState.framework_ativo}\n`;
    
    // PATCH 6G Gap Fix: Contexto de última pergunta
    if (conversationState.ultima_pergunta_id) {
      userPrompt += `\n⚠️ ÚLTIMA PERGUNTA FEITA: ${conversationState.ultima_pergunta_id}\n`;
      userPrompt += `NÃO repita esta pergunta. Avance para a próxima etapa do framework.\n`;
    }
    
    // PATCH 6G Gap Fix: Listar dados JÁ coletados para evitar repetição
    if (conversationState.framework_data && Object.keys(conversationState.framework_data).length > 0) {
      userPrompt += `\n## DADOS JÁ COLETADOS (NÃO PERGUNTE NOVAMENTE):\n`;
      const fd = conversationState.framework_data;
      
      // SPIN
      if (fd.spin) {
        if (fd.spin.s) userPrompt += `✅ SPIN_S (Situação): ${fd.spin.s}\n`;
        if (fd.spin.p) userPrompt += `✅ SPIN_P (Problema): ${fd.spin.p}\n`;
        if (fd.spin.i) userPrompt += `✅ SPIN_I (Implicação): ${fd.spin.i}\n`;
        if (fd.spin.n) userPrompt += `✅ SPIN_N (Need-Payoff): ${fd.spin.n}\n`;
      }
      
      // GPCT
      if (fd.gpct) {
        if (fd.gpct.g) userPrompt += `✅ GPCT_G (Goals): ${fd.gpct.g}\n`;
        if (fd.gpct.c) userPrompt += `✅ GPCT_C (Challenges): ${fd.gpct.c}\n`;
        if (fd.gpct.p) userPrompt += `✅ GPCT_P (Plans): ${fd.gpct.p}\n`;
        if (fd.gpct.t) userPrompt += `✅ GPCT_T (Timeline): ${fd.gpct.t}\n`;
      }
      
      // BANT
      if (fd.bant) {
        if (fd.bant.b) userPrompt += `✅ BANT_B (Budget): ${fd.bant.b}\n`;
        if (fd.bant.a) userPrompt += `✅ BANT_A (Authority): ${fd.bant.a}\n`;
        if (fd.bant.n) userPrompt += `✅ BANT_N (Need): ${fd.bant.n}\n`;
        if (fd.bant.t) userPrompt += `✅ BANT_T (Timing): ${fd.bant.t}\n`;
      }
    }
    
    // PATCH 6G Gap Fix: Instrução ativa de tom DISC
    if (conversationState.perfil_disc) {
      userPrompt += `\n- Perfil DISC detectado: ${conversationState.perfil_disc}\n`;
      const discInstruction = getDiscToneInstruction(conversationState.perfil_disc);
      if (discInstruction) {
        userPrompt += `\n${discInstruction}\n`;
      }
    }
    
    if (conversationState.estado_funil !== 'SAUDACAO') {
      userPrompt += `\n⚠️ NÃO reinicie com apresentação. Continue de onde parou.\n`;
    }
  }
  
  // PATCH 6G: Adicionar tabela de preços para BLUE
  if (empresa === 'BLUE') {
    userPrompt += formatBluePricingForPrompt();
  }
  
  // PATCH 6G+: Adicionar ofertas ativas para TOKENIZA
  if (empresa === 'TOKENIZA') {
    try {
      const ofertas = await fetchActiveTokenizaOffers();
      userPrompt += formatTokenizaOffersForPrompt(ofertas);
      console.log('[6G] Ofertas Tokeniza carregadas:', ofertas.length);
    } catch (err) {
      console.error('[6G] Erro ao buscar ofertas Tokeniza:', err);
      userPrompt += `\n## OFERTAS TOKENIZA\nNão foi possível carregar ofertas no momento. Foque na qualificação.\n`;
    }
  }
  
  // PATCH 6H: Adicionar conhecimento de produtos
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const productKnowledge = await fetchProductKnowledge(supabaseAdmin, empresa);
    if (productKnowledge.length > 0) {
      userPrompt += formatProductKnowledgeForPrompt(productKnowledge);
      console.log('[6H] Conhecimento de produtos carregado:', productKnowledge.length);
    }
  } catch (err) {
    console.error('[6H] Erro ao buscar conhecimento de produtos:', err);
  }
  
  // Contexto de classificação
  if (classificacao) {
    userPrompt += `\n## CONTEXTO DO LEAD:\n`;
    userPrompt += `- ICP: ${classificacao.icp}\n`;
    if (classificacao.persona) userPrompt += `- Persona: ${classificacao.persona}\n`;
    userPrompt += `- Temperatura Atual: ${classificacao.temperatura}\n`;
    userPrompt += `- Prioridade: ${classificacao.prioridade}\n`;
  }
  
  if (historico.length > 0) {
    userPrompt += '\n## HISTÓRICO RECENTE:\n';
    historico.slice().reverse().forEach(h => {
      const dir = h.direcao === 'OUTBOUND' ? 'SDR' : 'LEAD';
      userPrompt += `[${dir}]: ${h.conteudo.substring(0, 300)}\n`;
    });
  }

  userPrompt += `\n## MENSAGEM A INTERPRETAR:\n"${mensagem}"`;

  console.log('[IA] Enviando para interpretação:', { 
    empresa, 
    mensagemPreview: mensagem.substring(0, 100),
    proximaPergunta: proximaPergunta.tipo,
    estadoFunil: conversationState?.estado_funil,
  });

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[IA] Erro na API:', response.status, errText);
    throw new Error(`Erro na API de IA: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsados = data.usage?.total_tokens || 0;
  const tempoMs = Date.now() - startTime;

  if (!content) {
    throw new Error('Resposta vazia da IA');
  }

  console.log('[IA] Resposta recebida:', { tokensUsados, tempoMs, content: content.substring(0, 300) });

  // Parse do JSON
  let parsed: AIResponse;
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[IA] Erro ao parsear JSON:', content);
    parsed = {
      intent: 'NAO_ENTENDI',
      confidence: 0.5,
      summary: 'Não foi possível interpretar a mensagem',
      acao: 'ESCALAR_HUMANO',
      deve_responder: false,
      resposta_sugerida: null,
    };
  }

  // Validar e normalizar
  const validIntents: LeadIntentTipo[] = [
    'INTERESSE_COMPRA', 'INTERESSE_IR', 'DUVIDA_PRODUTO', 'DUVIDA_PRECO',
    'DUVIDA_TECNICA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO',
    'RECLAMACAO', 'OPT_OUT', 'OBJECAO_PRECO', 'OBJECAO_RISCO',
    'SEM_INTERESSE', 'NAO_ENTENDI', 'CUMPRIMENTO', 'AGRADECIMENTO',
    'FORA_CONTEXTO', 'OUTRO'
  ];
  const validAcoes: SdrAcaoTipo[] = [
    'PAUSAR_CADENCIA', 'CANCELAR_CADENCIA', 'RETOMAR_CADENCIA',
    'AJUSTAR_TEMPERATURA', 'CRIAR_TAREFA_CLOSER', 'MARCAR_OPT_OUT',
    'NENHUMA', 'ESCALAR_HUMANO', 'ENVIAR_RESPOSTA_AUTOMATICA'
  ];

  if (!validIntents.includes(parsed.intent)) {
    parsed.intent = 'OUTRO';
  }
  if (!validAcoes.includes(parsed.acao)) {
    parsed.acao = 'NENHUMA';
  }
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
  parsed.deve_responder = parsed.deve_responder ?? false;

  // PATCH 6G: Validar se IA pode sugerir reunião
  const aiSugeriuReuniao = parsed.acao === 'CRIAR_TAREFA_CLOSER' || 
    (parsed.resposta_sugerida?.toLowerCase().includes('reunião') ?? false) ||
    (parsed.resposta_sugerida?.toLowerCase().includes('agendar') ?? false);
  
  // Atualizar qualiState com intent detectado para validação
  qualiState.intentAtual = parsed.intent;
  
  if (!validarCTAReuniao(aiSugeriuReuniao, qualiState)) {
    // PATCH 6G Gap Fix: Bloquear CTA prematuro EFETIVAMENTE
    console.log('[6G] Bloqueando CTA prematuro, removendo menção a reunião');
    
    if (parsed.acao === 'CRIAR_TAREFA_CLOSER') {
      parsed.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
    }
    
    // Remover resposta que contém CTA prematuro
    if (parsed.resposta_sugerida) {
      const respostaLower = parsed.resposta_sugerida.toLowerCase();
      const temCTA = respostaLower.includes('reunião') || 
                     respostaLower.includes('agendar') ||
                     respostaLower.includes('conversar com') ||
                     respostaLower.includes('especialista');
      
      if (temCTA) {
        console.log('[6G] Resposta bloqueada - continha CTA prematuro');
        parsed.resposta_sugerida = null;
        parsed.deve_responder = false;
      }
    }
  }

  // Aplicar matriz automática de temperatura
  if (classificacao && parsed.acao !== 'AJUSTAR_TEMPERATURA') {
    const novaTemp = computeNewTemperature(parsed.intent, classificacao.temperatura);
    if (novaTemp) {
      parsed.acao = 'AJUSTAR_TEMPERATURA';
      parsed.acao_detalhes = { 
        ...parsed.acao_detalhes, 
        nova_temperatura: novaTemp,
        motivo: `Ajuste automático baseado em intent ${parsed.intent}`
      };
      console.log('[IA] Temperatura ajustada automaticamente:', { 
        de: classificacao.temperatura, 
        para: novaTemp, 
        intent: parsed.intent 
      });
    }
  }

  // Registrar a pergunta feita
  if (!parsed.ultima_pergunta_id) {
    parsed.ultima_pergunta_id = proximaPergunta.tipo;
  }

  return { response: parsed, tokensUsados, tempoMs };
}

/**
 * Envia resposta automática via WhatsApp
 */
async function sendAutoResponse(
  supabase: SupabaseClient,
  telefone: string,
  empresa: EmpresaTipo,
  resposta: string,
  leadId: string | null,
  runId: string | null
): Promise<{ success: boolean; messageId?: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  console.log('[WhatsApp] Enviando resposta automática:', { telefone: telefone.substring(0, 6) + '...', empresa });

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: telefone,
        message: resposta,
        empresa,
        leadId,
        runId,
        isAutoResponse: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[WhatsApp] Erro ao enviar:', response.status, errText);
      return { success: false };
    }

    const result = await response.json();
    console.log('[WhatsApp] Resposta enviada:', result);

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    return { success: false };
  }
}

/**
 * Aplica ação no CRM
 */
async function applyAction(
  supabase: SupabaseClient,
  runId: string | null,
  leadId: string | null,
  empresa: EmpresaTipo,
  acao: SdrAcaoTipo,
  detalhes?: Record<string, unknown>,
  mensagemOriginal?: string
): Promise<boolean> {
  if (acao === 'NENHUMA' || acao === 'ENVIAR_RESPOSTA_AUTOMATICA') return false;
  if (!runId && !leadId) return false;

  console.log('[Ação] Aplicando:', { acao, runId, leadId });

  try {
    switch (acao) {
      case 'PAUSAR_CADENCIA':
        if (runId) {
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'PAUSADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .eq('status', 'ATIVA');
          
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ACAO',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { acao, motivo: 'Pausado automaticamente pela IA SDR' },
          });
          
          console.log('[Ação] Cadência pausada:', runId);
          return true;
        }
        break;

      case 'CANCELAR_CADENCIA':
        if (runId) {
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'CANCELADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .in('status', ['ATIVA', 'PAUSADA']);
          
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ACAO',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { acao, motivo: 'Cancelado automaticamente pela IA SDR' },
          });
          
          console.log('[Ação] Cadência cancelada:', runId);
          return true;
        }
        break;

      case 'MARCAR_OPT_OUT':
        if (leadId) {
          const now = new Date().toISOString();
          
          await supabase
            .from('lead_contacts')
            .update({ 
              opt_out: true, 
              opt_out_em: now,
              opt_out_motivo: mensagemOriginal?.substring(0, 500) || 'Solicitado via mensagem',
              updated_at: now
            })
            .eq('lead_id', leadId)
            .eq('empresa', empresa);
          
          console.log('[Ação] Opt-out marcado em lead_contacts:', leadId);

          const { data: activeRuns } = await supabase
            .from('lead_cadence_runs')
            .select('id')
            .eq('lead_id', leadId)
            .in('status', ['ATIVA', 'PAUSADA']);

          if (activeRuns && activeRuns.length > 0) {
            const runIds = activeRuns.map((r: any) => r.id);
            
            await supabase
              .from('lead_cadence_runs')
              .update({ status: 'CANCELADA', updated_at: now })
              .in('id', runIds);

            for (const rid of runIds) {
              await supabase.from('lead_cadence_events').insert({
                lead_cadence_run_id: rid,
                step_ordem: 0,
                template_codigo: 'SDR_IA_OPT_OUT',
                tipo_evento: 'RESPOSTA_DETECTADA',
                detalhes: { acao, motivo: 'Lead solicitou opt-out - todas cadências canceladas' },
              });
            }

            console.log('[Ação] Cadências canceladas por opt-out:', runIds.length);
          }

          await supabase
            .from('lead_classifications')
            .update({ 
              temperatura: 'FRIO',
              updated_at: now
            })
            .eq('lead_id', leadId);

          console.log('[Ação] Temperatura ajustada para FRIO devido a opt-out');
          return true;
        }
        break;

      case 'CRIAR_TAREFA_CLOSER':
        if (runId) {
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_TAREFA_CLOSER',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { 
              acao, 
              motivo: 'Lead qualificado pelo SDR IA - tarefa criada para closer',
              prioridade: 'ALTA',
              ...detalhes,
            },
          });
          
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'PAUSADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .eq('status', 'ATIVA');
          
          console.log('[Ação] Tarefa criada para closer:', leadId);
          return true;
        }
        break;

      case 'ESCALAR_HUMANO':
        if (runId) {
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ESCALAR',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { 
              acao, 
              motivo: 'Situação requer atenção humana',
              ...detalhes,
            },
          });
          
          console.log('[Ação] Escalado para humano:', leadId);
          return true;
        }
        break;

      case 'AJUSTAR_TEMPERATURA':
        if (leadId && detalhes?.nova_temperatura) {
          const novaTemp = detalhes.nova_temperatura as TemperaturaTipo;
          const validTemps: TemperaturaTipo[] = ['FRIO', 'MORNO', 'QUENTE'];
          
          if (validTemps.includes(novaTemp)) {
            // Buscar empresa do lead para definir ICP default caso não exista classificação
            const { data: leadContact } = await supabase
              .from('lead_contacts')
              .select('empresa')
              .eq('lead_id', leadId)
              .maybeSingle();
            
            const empresaLead = leadContact?.empresa || empresa;
            const defaultIcp = empresaLead === 'TOKENIZA' 
              ? 'TOKENIZA_NAO_CLASSIFICADO' 
              : 'BLUE_NAO_CLASSIFICADO';
            
            // Verificar se já existe classificação para este lead
            const { data: existingClassification } = await supabase
              .from('lead_classifications')
              .select('id')
              .eq('lead_id', leadId)
              .eq('empresa', empresaLead)
              .maybeSingle();
            
            let upsertError;
            
            if (existingClassification) {
              // UPDATE: Apenas atualizar temperatura se já existe
              const { error } = await supabase
                .from('lead_classifications')
                .update({ 
                  temperatura: novaTemp,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingClassification.id);
              upsertError = error;
            } else {
              // INSERT: Criar nova classificação com valores padrão
              const { error } = await supabase
                .from('lead_classifications')
                .insert({
                  lead_id: leadId,
                  empresa: empresaLead,
                  temperatura: novaTemp,
                  icp: defaultIcp,
                  prioridade: 3,
                  origem: 'AUTOMATICA',
                });
              upsertError = error;
              console.log('[Ação] Nova classificação criada para lead sem classificação prévia:', { 
                leadId, 
                empresa: empresaLead, 
                temperatura: novaTemp,
                icp: defaultIcp
              });
            }
            
            if (!upsertError) {
              console.log('[Ação] Temperatura ajustada:', { 
                leadId, 
                novaTemp, 
                operacao: existingClassification ? 'UPDATE' : 'INSERT' 
              });
              
              if (runId) {
                await supabase.from('lead_cadence_events').insert({
                  lead_cadence_run_id: runId,
                  step_ordem: 0,
                  template_codigo: 'SDR_IA_TEMPERATURA',
                  tipo_evento: 'RESPOSTA_DETECTADA',
                  detalhes: { acao, nova_temperatura: novaTemp, motivo: detalhes.motivo },
                });
              }
              
              return true;
            } else {
              console.error('[Ação] Erro ao ajustar temperatura:', upsertError);
            }
          }
        }
        break;

      // HANDOFF_EMPRESA removido - Amélia unificada atende ambas as áreas

      default:
        return false;
    }
  } catch (error) {
    console.error('[Ação] Erro ao aplicar:', error);
    return false;
  }

  return false;
}

/**
 * Sincroniza com Pipedrive
 */
async function syncWithPipedrive(
  pipedriveDealeId: string,
  empresa: EmpresaTipo,
  intent: LeadIntentTipo,
  acao: SdrAcaoTipo,
  acaoAplicada: boolean,
  historico: LeadMessage[],
  mensagemAtual: string,
  classificacao?: LeadClassification
): Promise<void> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[Pipedrive] Variáveis de ambiente não configuradas');
      return;
    }

    const messages = [
      ...historico.slice(-3).reverse().map(h => ({
        direcao: h.direcao === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        conteudo: h.conteudo.substring(0, 500),
        created_at: h.created_at,
      })),
      {
        direcao: 'INBOUND',
        conteudo: mensagemAtual.substring(0, 500),
        created_at: new Date().toISOString(),
      }
    ];

    console.log('[Pipedrive] Sincronizando conversa:', { pipedriveDealeId, intent, acao });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'log_conversation',
        deal_id: pipedriveDealeId,
        empresa,
        data: {
          messages,
          intent,
          acao_aplicada: acaoAplicada ? acao : undefined,
          classification: classificacao ? {
            icp: classificacao.icp,
            persona: classificacao.persona,
            temperatura: classificacao.temperatura,
            prioridade: classificacao.prioridade,
          } : undefined,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('[Pipedrive] Erro na sincronização:', response.status, err);
    } else {
      console.log('[Pipedrive] Conversa sincronizada com sucesso');
    }

    if (acao === 'CRIAR_TAREFA_CLOSER' && acaoAplicada) {
      const activityResponse = await fetch(`${SUPABASE_URL}/functions/v1/pipedrive-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_activity',
          deal_id: pipedriveDealeId,
          empresa,
          data: {
            activity_type: 'call',
            subject: `[SDR IA] Lead qualificado - ${intent}`,
            note: `Intent detectado: ${intent}\nConfiança: Alta\nLead qualificado via frameworks SPIN/GPCT+BANT.`,
          },
        }),
      });

      if (activityResponse.ok) {
        console.log('[Pipedrive] Atividade criada para closer');
      }
    }

  } catch (error) {
    console.error('[Pipedrive] Erro na sincronização:', error);
  }
}

/**
 * Salva interpretação no banco
 */
async function saveInterpretation(
  supabase: SupabaseClient,
  message: LeadMessage,
  aiResponse: AIResponse,
  tokensUsados: number,
  tempoMs: number,
  acaoAplicada: boolean,
  respostaEnviada: boolean,
  respostaTexto: string | null
): Promise<string> {
  const record = {
    message_id: message.id,
    lead_id: message.lead_id,
    run_id: message.run_id,
    empresa: message.empresa,
    intent: aiResponse.intent,
    intent_confidence: aiResponse.confidence,
    intent_summary: aiResponse.summary,
    acao_recomendada: aiResponse.acao,
    acao_aplicada: acaoAplicada,
    acao_detalhes: aiResponse.acao_detalhes || null,
    modelo_ia: 'google/gemini-2.5-flash',
    tokens_usados: tokensUsados,
    tempo_processamento_ms: tempoMs,
    resposta_automatica_texto: respostaTexto,
    resposta_enviada_em: respostaEnviada ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('lead_message_intents')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error('[DB] Erro ao salvar interpretação:', error);
    throw error;
  }

  return (data as { id: string }).id;
}

// ========================================
// Handler Principal
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { messageId }: InterpretRequest = await req.json();

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'messageId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SDR-IA] Iniciando interpretação:', messageId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Carregar contexto completo
    const context = await loadMessageContext(supabase, messageId);
    const { 
      message, 
      historico, 
      leadNome, 
      cadenciaNome, 
      telefone, 
      optOut, 
      classificacao, 
      pipedriveDealeId,
      pessoaContext,
      conversationState 
    } = context;

    // Verificar opt-out
    if (optOut) {
      console.log('[SDR-IA] Lead está em opt-out, bloqueando resposta automática:', message.lead_id);
      
      const intentId = await saveInterpretation(
        supabase,
        message,
        {
          intent: 'OPT_OUT',
          confidence: 1.0,
          summary: 'Lead já em opt-out - processamento bloqueado',
          acao: 'NENHUMA',
          deve_responder: false,
          resposta_sugerida: null,
        },
        0,
        0,
        false,
        false,
        null
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          intentId, 
          optOutBlocked: true,
          message: 'Lead em opt-out - resposta automática bloqueada'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 2. Verificar se já foi interpretado
    const { data: existing } = await supabase
      .from('lead_message_intents')
      .select('id')
      .eq('message_id', messageId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log('[SDR-IA] Mensagem já interpretada:', messageId);
      return new Response(
        JSON.stringify({ success: true, intentId: (existing as { id: string }).id, status: 'ALREADY_INTERPRETED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Interpretar com IA
    const { response: aiResponse, tokensUsados, tempoMs } = await interpretWithAI(
      message.conteudo,
      message.empresa,
      historico,
      leadNome,
      cadenciaNome,
      classificacao,
      pessoaContext,
      conversationState
    );

    console.log('[SDR-IA] Interpretação:', {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      deve_responder: aiResponse.deve_responder,
      novo_estado_funil: aiResponse.novo_estado_funil,
      disc_estimado: aiResponse.disc_estimado,
      ultima_pergunta: aiResponse.ultima_pergunta_id,
    });

    // 4. Aplicar ação
    const acaoAplicada = await applyAction(
      supabase,
      message.run_id,
      message.lead_id,
      message.empresa,
      aiResponse.acao,
      aiResponse.acao_detalhes,
      message.conteudo
    );

    // 5. Enviar resposta automática
    let respostaEnviada = false;
    let respostaTexto: string | null = null;

    if (
      aiResponse.deve_responder &&
      aiResponse.resposta_sugerida &&
      telefone &&
      aiResponse.intent !== 'OPT_OUT'
    ) {
      respostaTexto = aiResponse.resposta_sugerida;
      
      const sendResult = await sendAutoResponse(
        supabase,
        telefone,
        message.empresa,
        respostaTexto,
        message.lead_id,
        message.run_id
      );
      
      respostaEnviada = sendResult.success;
      console.log('[SDR-IA] Resposta automática:', { enviada: respostaEnviada });
    }

    // 6. Salvar interpretação
    const intentId = await saveInterpretation(
      supabase,
      message,
      aiResponse,
      tokensUsados,
      tempoMs,
      acaoAplicada,
      respostaEnviada,
      respostaTexto
    );

    console.log('[SDR-IA] Interpretação salva:', intentId);

    // 7. Salvar estado de conversa atualizado
    if (message.lead_id && (aiResponse.novo_estado_funil || aiResponse.frameworks_atualizados || aiResponse.disc_estimado)) {
      const stateUpdates: {
        estado_funil?: EstadoFunil;
        framework_data?: FrameworkData;
        perfil_disc?: PerfilDISC | null;
        ultima_pergunta_id?: string | null;
      } = {};
      
      if (aiResponse.novo_estado_funil) {
        stateUpdates.estado_funil = aiResponse.novo_estado_funil;
      }
      
      if (aiResponse.frameworks_atualizados) {
        const existingData = conversationState?.framework_data || {};
        stateUpdates.framework_data = {
          ...existingData,
          ...aiResponse.frameworks_atualizados,
          gpct: { ...(existingData.gpct || {}), ...(aiResponse.frameworks_atualizados.gpct || {}) },
          bant: { ...(existingData.bant || {}), ...(aiResponse.frameworks_atualizados.bant || {}) },
          spin: { ...(existingData.spin || {}), ...(aiResponse.frameworks_atualizados.spin || {}) },
        };
      }
      
      if (aiResponse.disc_estimado) {
        stateUpdates.perfil_disc = aiResponse.disc_estimado;
      }
      
      if (aiResponse.ultima_pergunta_id) {
        stateUpdates.ultima_pergunta_id = aiResponse.ultima_pergunta_id;
      }
      
      await saveConversationState(
        supabase,
        message.lead_id,
        message.empresa,
        'WHATSAPP',
        stateUpdates
      );
      
      // Salvar DISC na tabela pessoas
      if (aiResponse.disc_estimado && pessoaContext?.pessoa.id) {
        await updatePessoaDISC(supabase, pessoaContext.pessoa.id, aiResponse.disc_estimado);
      }
    }

    // 8. Sincronizar com Pipedrive
    if (pipedriveDealeId) {
      syncWithPipedrive(
        pipedriveDealeId,
        message.empresa,
        aiResponse.intent,
        aiResponse.acao,
        acaoAplicada,
        historico,
        message.conteudo,
        classificacao
      ).catch(err => console.error('[Pipedrive] Erro em background:', err));
    }

    const result: InterpretResult = {
      success: true,
      intentId,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      acaoAplicada,
      respostaEnviada,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SDR-IA] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
