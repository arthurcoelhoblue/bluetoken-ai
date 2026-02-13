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
  | 'ENVIAR_RESPOSTA_AUTOMATICA'
  | 'DESQUALIFICAR_LEAD';

// ========================================
// PATCH 6: TIPOS DE ESTADO DE CONVERSA
// PATCH 6+: MULTICANAL + PERFIL INVESTIDOR
// ========================================

type EstadoFunil = 'SAUDACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO' | 'OBJECOES' | 'FECHAMENTO' | 'POS_VENDA';
type FrameworkTipo = 'GPCT' | 'BANT' | 'SPIN' | 'NONE';
type PerfilDISC = 'D' | 'I' | 'S' | 'C';
type PessoaRelacaoTipo = 'CLIENTE_IR' | 'LEAD_IR' | 'INVESTIDOR' | 'LEAD_INVESTIDOR' | 'DESCONHECIDO';
type CanalConversa = 'WHATSAPP' | 'EMAIL';
type PerfilInvestidor = 'CONSERVADOR' | 'ARROJADO' | null;

interface FrameworkData {
  gpct?: { g?: string | null; p?: string | null; c?: string | null; t?: string | null };
  bant?: { b?: string | null; a?: string | null; n?: string | null; t?: string | null };
  spin?: { s?: string | null; p?: string | null; i?: string | null; n?: string | null };
}

// ========================================
// NORMALIZAÇÃO DE CHAVES DE FRAMEWORK
// A IA pode retornar SPIN/GPCT/BANT em maiúsculas ou minúsculas
// Todo o código lê em minúsculas, então normalizamos aqui
// ========================================

function normalizeSubKeys(obj: any): Record<string, string | null> {
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.toLowerCase()] = value as string | null;
  }
  return result;
}

function normalizeFrameworkKeys(data: any): FrameworkData {
  if (!data || typeof data !== 'object') return {};
  return {
    spin: normalizeSubKeys(data?.spin || data?.SPIN || data?.Spin),
    gpct: normalizeSubKeys(data?.gpct || data?.GPCT || data?.Gpct),
    bant: normalizeSubKeys(data?.bant || data?.BANT || data?.Bant),
  };
}

interface ConversationState {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  canal: CanalConversa;
  estado_funil: EstadoFunil;
  framework_ativo: FrameworkTipo;
  framework_data: FrameworkData;
  perfil_disc?: PerfilDISC | null;
  perfil_investidor?: PerfilInvestidor;
  idioma_preferido: string;
  ultima_pergunta_id?: string | null;
  ultimo_contato_em: string;
}

// ========================================
// PATCH 6+: INFERÊNCIA DE PERFIL INVESTIDOR
// ========================================

function inferirPerfilInvestidor(
  disc: PerfilDISC | null | undefined,
  mensagem?: string
): PerfilInvestidor {
  // Palavras-chave para conservador
  const conservadorKeywords = [
    'segurança', 'seguro', 'garantia', 'risco', 'proteção',
    'tranquilidade', 'certeza', 'estabilidade', 'conservador',
    'medo', 'preocupado', 'cuidado', 'cautela'
  ];
  
  // Palavras-chave para arrojado
  const arrojadoKeywords = [
    'rentabilidade', 'retorno', 'lucro', 'ganho', 'resultado',
    'crescimento', 'oportunidade', 'arrojado', 'agressivo',
    'quanto rende', 'qual o rendimento', 'prazo curto'
  ];
  
  if (mensagem) {
    const msgLower = mensagem.toLowerCase();
    const conservadorMatch = conservadorKeywords.some(k => msgLower.includes(k));
    const arrojadoMatch = arrojadoKeywords.some(k => msgLower.includes(k));
    
    if (conservadorMatch && !arrojadoMatch) return 'CONSERVADOR';
    if (arrojadoMatch && !conservadorMatch) return 'ARROJADO';
  }
  
  // Inferir baseado no DISC
  if (disc === 'D') return 'ARROJADO';
  if (disc === 'C') return 'CONSERVADOR';
  
  return null;
}

// ========================================
// PATCH 6+: REGRAS DE COMPORTAMENTO POR CANAL
// ========================================

const CHANNEL_RULES = {
  WHATSAPP: `
## 📱 REGRAS WHATSAPP (OBRIGATÓRIO)

FORMATO WHATSAPP:
- Mensagens CURTAS (2-4 linhas máximo)
- Tom conversacional e informal
- NUNCA repetir apresentação se já houve interação
- UMA ÚNICA pergunta por mensagem (obrigatório)
- Sempre reagir ao último input do lead
- Avançar a conversa passo a passo

PROIBIDO NO WHATSAPP:
❌ Blocos de texto longos (mais de 4 linhas)
❌ Listas extensas
❌ Pitch completo em uma mensagem
❌ Explicações técnicas longas sem pedido explícito
❌ Múltiplas perguntas na mesma mensagem

EXEMPLO BOM WHATSAPP:
"Entendi que você já investe em renda fixa. O que te fez buscar alternativas?"

EXEMPLO RUIM WHATSAPP:
"Entendi! Na Tokeniza, trabalhamos com investimentos tokenizados que são regulados pela CVM 88, com garantias reais e prazos definidos. Temos várias ofertas disponíveis, cada uma com sua rentabilidade e prazo específicos. Você busca segurança ou rentabilidade maior? Quantos anos você planeja investir? Qual seu orçamento disponível?"
`,

  EMAIL: `
## 📧 REGRAS EMAIL (OBRIGATÓRIO)

FORMATO EMAIL:
- Mensagens ESTRUTURADAS com parágrafos
- Tom consultivo e profissional
- RETOMAR contexto brevemente no início
- Cada e-mail avança UM estágio da conversa
- Pode conter explicação mais completa
- Máximo 3-4 parágrafos

ESTRUTURA DO EMAIL:
1. Retomada breve do contexto (1 frase)
2. Conteúdo principal (1-2 parágrafos)
3. Próximo passo claro (1 pergunta ou CTA)

PROIBIDO NO EMAIL:
❌ Perguntas soltas sem contexto
❌ Pitch agressivo ou urgência artificial
❌ Linguagem de WhatsApp (muito informal)
❌ Assuntos genéricos

EXEMPLO BOM EMAIL:
"No nosso contato você comentou que quer entender melhor como funciona o investimento antes de tomar qualquer decisão.

Na Tokeniza, os investimentos são estruturados com lastro em garantias reais, prazo definido e regras claras desde o início. Isso significa que o foco é previsibilidade e segurança jurídica.

No próximo contato, posso te explicar com mais detalhe como essas garantias funcionam na prática?"

EXEMPLO RUIM EMAIL:
"Oi! Tudo bem? Queria saber se você tem interesse em investir."
`
};

// ========================================
// PATCH 6+: EXEMPLOS POR PERFIL INVESTIDOR E CANAL
// ========================================

const INVESTOR_PROFILE_EXAMPLES = {
  TOKENIZA: {
    CONSERVADOR: {
      foco: 'Segurança, garantia, risco controlado',
      tom: 'Explicar primeiro o risco, depois o retorno',
      exemplos: {
        WHATSAPP: `
LEAD: "Quero entender melhor como funciona esse investimento"
RESPOSTA: "Antes de falar em retorno, costuma ser mais importante entender o risco. Posso te explicar primeiro como funciona a garantia desses investimentos?"

LEAD: "Qual a garantia?"
RESPOSTA: "Cada oferta tem sua garantia específica. Na maioria, são imóveis ou recebíveis. Qual te preocupa mais: o prazo ou a segurança do dinheiro?"
`,
        EMAIL: `
Assunto: {{primeiro_nome}}, como funcionam as garantias nos investimentos tokenizados

{{nome}},

No nosso contato você comentou que quer entender melhor como funciona o investimento antes de tomar qualquer decisão.

Na Tokeniza, os investimentos são estruturados com lastro em garantias reais, prazo definido e regras claras desde o início. Isso significa que o foco é previsibilidade e segurança jurídica — não promessa de retorno.

No próximo contato, posso te explicar com mais detalhe como essas garantias funcionam na prática e em quais tipos de ativos elas são usadas.
`
      }
    },
    ARROJADO: {
      foco: 'Resultado direto, rentabilidade, eficiência',
      tom: 'Direto ao ponto, sem rodeios',
      exemplos: {
        WHATSAPP: `
LEAD: "Quero entender melhor como funciona esse investimento"
RESPOSTA: "Direto ao ponto: são investimentos com prazo definido e lastro real. Quer começar entendendo a rentabilidade ou a estrutura de garantia?"

LEAD: "Quanto rende?"
RESPOSTA: "As ofertas variam de 15% a 22% ao ano, dependendo do prazo e risco. Qual faixa te interessa mais?"
`,
        EMAIL: `
Assunto: {{primeiro_nome}}, retornos e prazos dos investimentos Tokeniza

{{nome}},

Pelo seu perfil, faz sentido ir direto ao ponto.

Os investimentos na Tokeniza têm prazo definido, rentabilidade alvo e estrutura jurídica clara desde o início. Cada oferta deixa explícito o risco, o prazo e o valor mínimo.

Se fizer sentido, no próximo passo posso te mostrar como avaliar rapidamente se uma oferta combina ou não com seu perfil.
`
      }
    }
  },
  BLUE: {
    CONSERVADOR: {
      foco: 'Regularização, evitar problemas, tranquilidade',
      tom: 'Empático, explicar riscos de não fazer',
      exemplos: {
        WHATSAPP: `
LEAD: "Preciso declarar minhas criptos"
RESPOSTA: "Entendi. Você já tentou fazer sozinho ou é a primeira vez? Quero entender o tamanho do trabalho."

LEAD: "Tenho medo de fazer errado"
RESPOSTA: "Normal, a maioria das pessoas tem. A questão é: se declarar errado, a Receita pode pegar. A gente cuida pra você ficar tranquilo."
`,
        EMAIL: `
Assunto: {{primeiro_nome}}, como regularizar suas operações de cripto

{{nome}},

Entendo sua preocupação em fazer tudo corretamente. A declaração de criptomoedas tem regras específicas que mudam todo ano.

Na Blue, cuidamos de toda a apuração e declaração, garantindo que você fique em dia com a Receita Federal. O processo é simples: você nos passa o acesso às exchanges e nós fazemos o resto.

Posso te explicar como funciona o processo completo?
`
      }
    },
    ARROJADO: {
      foco: 'Resolver rápido, eficiência, custo-benefício',
      tom: 'Objetivo, mostrar ROI do serviço',
      exemplos: {
        WHATSAPP: `
LEAD: "Quanto custa?"
RESPOSTA: "Depende do volume. Plano Gold R$ 4.497 (ilimitado) ou Diamond R$ 2.997 (até 4 exchanges). Quantas exchanges você usa?"

LEAD: "Muitas operações"
RESPOSTA: "Então o Gold faz mais sentido - sem limite de carteiras. Você teria paz de espírito e economia de tempo."
`,
        EMAIL: `
Assunto: {{primeiro_nome}}, solução rápida para seu IR de cripto

{{nome}},

Direto ao ponto: fazer IR de cripto sozinho não compensa pelo tempo gasto e risco de erro.

O plano Gold (R$ 4.497) cobre carteiras ilimitadas e até 25k operações. Se você tem volume alto, o ROI é claro - você economiza dezenas de horas e evita multas.

Qual seu volume aproximado de operações no ano?
`
      }
    }
  }
};

// Formatar exemplos para o prompt
function formatInvestorProfileExamples(
  empresa: EmpresaTipo,
  perfilInvestidor: PerfilInvestidor,
  canal: CanalConversa
): string {
  if (!perfilInvestidor) return '';
  
  const perfil = INVESTOR_PROFILE_EXAMPLES[empresa]?.[perfilInvestidor];
  if (!perfil) return '';
  
  return `
## 🎯 PERFIL DO LEAD: ${perfilInvestidor}

FOCO: ${perfil.foco}
TOM A USAR: ${perfil.tom}

EXEMPLOS PARA ESSE PERFIL (${canal}):
${perfil.exemplos[canal]}
`;
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
  | 'ESCALAR_IMEDIATO'
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

// ========================================
// PATCH 9: DETECÇÃO DE LEAD QUENTE IMEDIATO
// ========================================

type SinalUrgenciaTipo = 
  | 'DECISAO_TOMADA'       // "quero contratar", "como pago"
  | 'URGENCIA_TEMPORAL'    // "preciso resolver essa semana"
  | 'FRUSTRADO_ALTERNATIVA' // "já tentei outro e não deu"
  | 'PEDIDO_REUNIAO_DIRETO' // "quero falar com alguém"
  | 'PEDIDO_HUMANO'        // "quero falar com humano/atendente"
  | 'NENHUM';

interface DeteccaoUrgencia {
  detectado: boolean;
  tipo: SinalUrgenciaTipo;
  frase_gatilho: string | null;
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
}

// Padrões de detecção de lead quente imediato
const URGENCIA_PATTERNS: Record<Exclude<SinalUrgenciaTipo, 'NENHUM'>, string[]> = {
  DECISAO_TOMADA: [
    'quero contratar', 'quero fechar', 'vamos fechar', 'fechado', 
    'como pago', 'como faço o pagamento', 'manda o pix', 'manda o contrato',
    'pode mandar', 'aceito', 'bora', 'vamos lá', 'to dentro',
    'quero esse plano', 'quero o gold', 'quero o diamond',
    'próximo passo', 'qual o próximo passo', 'como proceder',
    'me manda o link', 'onde pago', 'pode cobrar',
    // PATCH: Frases que indicam lead pronto para fechar/documentação
    'o que preciso enviar', 'o que eu preciso enviar', 'o que tenho que enviar',
    'o que devo enviar', 'quais documentos', 'que documentos preciso',
    'que documentos vocês precisam', 'documentos necessários',
    'como começo', 'como inicio', 'como a gente começa', 'quando começamos',
    'já posso enviar', 'posso já enviar', 'mando agora',
    'como funciona o processo', 'como é o processo',
  ],
  URGENCIA_TEMPORAL: [
    'urgente', 'é urgente', 'preciso urgente', 'urgência',
    'prazo', 'até amanhã', 'essa semana', 'semana que vem',
    'receita federal', 'malha fina', 'multa', 
    'declaração', 'prazo da declaração', 'prazo do ir',
    'estou atrasado', 'tô atrasado', 'em atraso',
    'preciso resolver rápido', 'preciso disso logo',
    'não posso esperar', 'correndo contra o tempo',
  ],
  FRUSTRADO_ALTERNATIVA: [
    'já tentei', 'já usei', 'não funcionou', 'não deu certo',
    'gastei dinheiro', 'perdi dinheiro', 'joguei dinheiro fora',
    'contador não resolve', 'contador não entende',
    'cansei', 'cansado de', 'frustrado', 
    'não resolveu', 'não consegui', 'não conseguiu',
    'péssima experiência', 'experiência ruim', 
    'outro serviço', 'outra empresa', 'concorrente',
  ],
  PEDIDO_REUNIAO_DIRETO: [
    'quero uma reunião', 'marcar reunião', 'agendar reunião',
    'podemos conversar', 'vamos conversar', 'me liga',
    'pode me ligar', 'quero falar por telefone',
    'prefiro por telefone', 'melhor por telefone',
    'quero entender melhor pessoalmente',
  ],
  PEDIDO_HUMANO: [
    'falar com humano', 'falar com alguém', 'falar com uma pessoa',
    'atendente', 'atendimento humano', 'pessoa real',
    'especialista', 'falar com especialista', 'consultor',
    'vocês são robô', 'você é robô', 'isso é bot',
    'quero falar com gente', 'tem alguém aí',
  ],
};

/**
 * PATCH 9: Detecta se o lead está "quente" e pronto para escalar imediatamente
 * Retorna sinais de urgência que indicam que devemos PARAR de qualificar
 */
function detectarLeadQuenteImediato(mensagem: string): DeteccaoUrgencia {
  const msgLower = mensagem.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos para melhor matching
  
  // Ordem de prioridade: PEDIDO_HUMANO > DECISAO_TOMADA > URGENCIA_TEMPORAL > FRUSTRADO_ALTERNATIVA > PEDIDO_REUNIAO_DIRETO
  const ordemPrioridade: Exclude<SinalUrgenciaTipo, 'NENHUM'>[] = [
    'PEDIDO_HUMANO',
    'DECISAO_TOMADA', 
    'URGENCIA_TEMPORAL',
    'FRUSTRADO_ALTERNATIVA',
    'PEDIDO_REUNIAO_DIRETO',
  ];
  
  for (const tipo of ordemPrioridade) {
    const patterns = URGENCIA_PATTERNS[tipo];
    
    for (const pattern of patterns) {
      const patternNorm = pattern.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      if (msgLower.includes(patternNorm)) {
        // Determinar confiança baseada no tipo e contexto
        let confianca: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA';
        
        // Padrões que são ALTA confiança (ação clara)
        if (['quero contratar', 'como pago', 'manda o pix', 'vamos fechar', 
             'falar com humano', 'preciso urgente', 'malha fina'].some(p => msgLower.includes(p))) {
          confianca = 'ALTA';
        }
        
        // Padrões que são BAIXA confiança (podem ser exploratórios)
        if (['podemos conversar', 'já tentei', 'prazo'].some(p => msgLower.includes(p) && msgLower.length < 20)) {
          confianca = 'BAIXA';
        }
        
        console.log('[URGENCIA] Lead quente detectado:', { tipo, pattern, confianca, mensagem: mensagem.substring(0, 50) });
        
        return {
          detectado: true,
          tipo,
          frase_gatilho: pattern,
          confianca,
        };
      }
    }
  }
  
  return {
    detectado: false,
    tipo: 'NENHUM',
    frase_gatilho: null,
    confianca: 'BAIXA',
  };
}

// ========================================
// PATCH 10: DETECTOR DE LEAD PRONTO PARA ESCALAR
// ========================================

interface SinaisLeadPronto {
  conscienciaTotalPresente: boolean;
  aberturaExplicita: boolean;
  volumeTempoConhecido: boolean;
  perguntaPreco: boolean;
  reconheceuPlano: boolean;
  totalSinais: number;
}

/**
 * PATCH 10: Detecta se o lead está pronto para escalar para vendedor
 * Diferente de urgência (que é imediato), aqui o lead está qualificado
 */
function detectarLeadProntoParaEscalar(
  mensagem: string,
  historico: LeadMessage[],
  frameworkData?: FrameworkData
): SinaisLeadPronto {
  const msgLower = mensagem.toLowerCase();
  const historicoText = historico
    .filter(h => h.direcao === 'INBOUND')
    .map(h => h.conteudo.toLowerCase())
    .join(' ');
  const todoTexto = msgLower + ' ' + historicoText;
  
  // 1. Consciência total: sabe que precisa declarar/investir, conhece os riscos
  const conscienciaPatterns = [
    'sei que preciso', 'tenho que declarar', 'preciso regularizar',
    'sei do risco', 'sei que é importante', 'entendo que preciso',
    'quero resolver', 'preciso resolver', 'quero me regularizar',
    'quero investir', 'quero começar a investir', 'estou pronto',
  ];
  const conscienciaTotalPresente = conscienciaPatterns.some(p => todoTexto.includes(p));
  
  // 2. Abertura explícita: demonstra interesse ativo
  const aberturaPatterns = [
    'claro', 'com certeza', 'pode me ajudar', 'quero saber mais',
    'me explica', 'como funciona', 'pode sim', 'quero sim',
    'estou interessado', 'interessada', 'quero entender',
    'pode falar', 'pode me contar', 'bora', 'vamos lá',
  ];
  const aberturaExplicita = aberturaPatterns.some(p => msgLower.includes(p));
  
  // 3. Volume/tempo conhecido: já informou quantas exchanges, anos, operações
  const spin = frameworkData?.spin || {};
  const volumeTempoConhecido = !!(spin.s && spin.p);
  
  // 4. Pergunta de preço: indica consideração de compra
  const precoPatterns = [
    'quanto custa', 'qual o valor', 'qual o preço', 'preço',
    'quanto fica', 'quanto é', 'qual plano', 'valores',
  ];
  const perguntaPreco = precoPatterns.some(p => todoTexto.includes(p));
  
  // 5. Reconheceu plano: já demonstrou preferência
  const planoPatterns = [
    'gold', 'diamond', 'esse plano', 'quero o plano', 'prefiro',
    'esse ai', 'esse aí', 'esse mesmo', 'é esse', 'vou querer',
  ];
  const reconheceuPlano = planoPatterns.some(p => todoTexto.includes(p));
  
  const sinais = {
    conscienciaTotalPresente,
    aberturaExplicita,
    volumeTempoConhecido,
    perguntaPreco,
    reconheceuPlano,
    totalSinais: [
      conscienciaTotalPresente,
      aberturaExplicita,
      volumeTempoConhecido,
      perguntaPreco,
      reconheceuPlano,
    ].filter(Boolean).length,
  };
  
  if (sinais.totalSinais >= 3) {
    console.log('[PATCH10] Lead pronto para escalar:', {
      sinais,
      trigger: 'Múltiplos sinais de qualificação detectados',
    });
  }
  
  return sinais;
}

// ========================================
// PATCH 10: MODO BLOCO DE QUALIFICAÇÃO BLUE
// ========================================

const BLOCO_QUALIFICACAO_BLUE = {
  ativo: true,
  pergunta: `Pra te indicar o melhor caminho, me responde 3 coisas rápidas:
1. Quais anos você precisa declarar?
2. Quantas exchanges/carteiras você usou nesse período?
3. Tem alguma carteira descentralizada (tipo MetaMask, Trust)?`,
  
  condicoesAtivacao: [
    'Após identificar que lead precisa de regularização',
    'Lead demonstrou interesse em IR',
    'Estado funil é DIAGNOSTICO ou QUALIFICACAO',
  ],
};

// ========================================
// PATCH 10: VARIAÇÕES DE TRANSIÇÃO ANTI-REPETIÇÃO
// ========================================

const VARIACOES_TRANSICAO = {
  // Substituir "Me conta" por variações naturais
  perguntasDiretas: [
    'Quantas exchanges você usa?',
    'Você lembra quantas operações fez mais ou menos?',
    'Como você declara hoje - sozinho ou com contador?',
    'Tem carteira descentralizada tipo MetaMask?',
    'Desde quando você opera?',
    'Qual exchange você mais usa?',
  ],
  
  // Aberturas variadas para perguntas
  aberturasPerguntas: [
    'Uma coisa rápida:',
    'E sobre',
    'Ah, e',
    'Uma dúvida:',
    'Deixa eu entender:',
    '',  // Direto sem abertura
  ],
  
  // Reconhecimentos variados (não elogios!)
  reconhecimentos: [
    'Entendi.',
    'Faz sentido.',
    'Tá, entendi.',
    'Hmm, entendi.',
    'Ah, tá.',
    'Saquei.',
  ],
  
  // Conectores para continuar
  conectores: [
    'E',
    'Sobre isso,',
    'Então,',
    '',
  ],
};

// Função para selecionar variação aleatória
function selecionarVariacao(array: string[]): string {
  return array[Math.floor(Math.random() * array.length)];
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
  'ESCALAR_IMEDIATO': '🚨 ESCALAÇÃO IMEDIATA: O lead demonstrou sinal claro de urgência. Responda com empatia, confirme o interesse e avise que vai transferir para especialista.',
  'NENHUMA': 'Continue a conversa de forma natural, respondendo ao que o lead disse.',
};

// ========================================
// PATCH 6G: TABELA DE PREÇOS BLUE (IR CRIPTO)
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
  // REGRA CRÍTICA: Cobrança por ano fiscal
  regrasAnuais: {
    cobrancaPorAnoFiscal: true,
    instrucao: 'CADA PLANO COBRE UM ANO FISCAL. Se o cliente precisa declarar 2019-2024, são 6 contratações separadas.',
    multiplosAnos: {
      precoEspecial: true,
      instrucao: 'Para múltiplos anos, mencionar que podemos fazer condição especial. Cada ano pode ter plano diferente.',
    },
    // PATCH: Prescrição fiscal - a Receita só cobra os últimos 5 anos
    prescricaoFiscal: {
      anos: 5,
      instrucao: 'A Receita Federal só pode cobrar os ÚLTIMOS 5 ANOS FISCAIS. Anos anteriores já prescreveram.',
      exemplo: 'Em 2024: regularizar 2020, 2021, 2022, 2023, 2024 = 5 anos. Anos antes de 2020 (ex: 2019, 2018) já prescreveram.',
      comoExplicar: 'Se o cliente mencionar anos antigos (ex: 2019 em 2025), tranquilizá-lo: "Boa notícia! Esses anos já prescreveram, a Receita não pode mais cobrar."',
    },
  },
};

// ========================================
// PATCH 7: CONHECIMENTO TOKENIZA (INVESTIMENTOS TOKENIZADOS)
// ========================================

const TOKENIZA_KNOWLEDGE = {
  // Regra #1: TODOS leads são tratados como INVESTIDOR primeiro
  regraLeads: {
    default: 'INVESTIDOR',
    percentual: { investidor: 90, captador: 10 },
    instrucao: 'Sempre tratar o lead como investidor. Se ele se manifestar como captador, direcionar para esse fluxo.',
  },
  
  // O que é Tokeniza
  oQueE: {
    definicao: 'Plataforma brasileira de investimentos tokenizados regulada pela CVM 88',
    modelo: 'Conecta investidores (pessoas físicas) a captadores (empresas) com garantias reais',
    diferencial: 'Democratiza acesso a investimentos estruturados com garantia real que antes só grandes investidores tinham',
    oqueFaz: 'A Tokeniza faz a ponte entre duas pontas: investidores e captadores',
  },
  
  // O que vendemos para investidores
  produtoInvestidor: {
    tipo: 'Investimentos tokenizados lastreados em garantia real',
    oQueCompra: 'Token que representa fração de contrato de investimento coletivo (regulamentado CVM)',
    caracteristicas: [
      'Contratos de investimento coletivo representados por tokens em blockchain',
      'Garantias reais ou contratuais',
      'Retorno previsto e prazo determinado',
      'Regras claras na lâmina da oferta',
      'Contratos executáveis judicialmente',
    ],
    lastros: ['Imóveis', 'Recebíveis', 'Contratos firmados', 'Estoques', 'Alienação fiduciária', 'Caução', 'Penhor'],
  },
  
  // Para captadores (10% dos leads)
  produtoCaptador: {
    tipo: 'Serviço de estruturação e distribuição',
    processo: [
      'Análise de viabilidade e risco',
      'Conferência jurídica',
      'Criação do contrato',
      'Estruturação da tokenização',
      'Emissão de tokens',
      'Distribuição para investidores',
      'Prestação de contas',
    ],
    custos: ['Taxa de estruturação', 'Taxa de captação (comissão sobre valor captado)'],
    instrucao: 'Se lead for captador, direcionar para conversa específica sobre estruturação',
  },
  
  // Perfil do investidor Tokeniza
  perfilInvestidor: {
    idade: '25-55 anos',
    jaInveste: ['CDB', 'Ações', 'FII', 'Cripto', 'Renda fixa'],
    busca: [
      'Retorno maior com risco controlado',
      'Garantia real tangível',
      'Transparência total',
      'Diversificação',
      'Entender o ativo antes de investir',
    ],
    valoriza: 'Entender o ativo - não investe no escuro, gosta de novas tecnologias com segurança',
  },
  
  // Por que investir com a Tokeniza
  porQueInvestir: {
    motivos: [
      'Acesso a ativos que antes eram restritos a grandes investidores',
      'Retorno maior que investimentos tradicionais',
      'Segurança via garantias reais (imóveis, contratos)',
      'Transparência total (risco, documentos, garantias visíveis)',
      'Blockchain para registrar titularidade',
    ],
    exemploRetorno: 'Banco capta do investidor a 1%/mês e empresta a 5%. Na Tokeniza: empreendedor capta a 2,5%/mês e investidor recebe 2,5%/mês. Ganha todo mundo.',
  },
  
  // Garantias
  garantias: {
    tipos: ['Alienação fiduciária de imóvel', 'Cessão fiduciária de recebíveis', 'Caução', 'Penhor'],
    significado: 'Se a empresa não pagar, existe ativo real para executar judicialmente',
    oQueGarante: 'Tangibilidade que o investidor quer: imóveis registrados, contratos validados, análises da equipe',
  },
  
  // Estrutura de cada oferta
  estruturaOferta: {
    elementos: [
      'Lastro (o que garante)',
      'Tese (por que a operação existe)',
      'Retorno previsto (ex: 18% ao ano)',
      'Prazo',
      'Risco explicado',
      'Garantia descrita',
      'Fluxo de pagamento',
      'Documentos jurídicos',
      'Responsáveis pela operação',
    ],
    modalidadesPagamento: ['Juros mensais', 'Juros + amortização final', 'Bullet (tudo no final)', 'Fluxo híbrido'],
  },
  
  // Perguntas de qualificação ideais
  perguntasQualificacao: [
    'Como você investe hoje?',
    'Já investiu em produtos estruturados?',
    'Qual seu objetivo com esses investimentos?',
    'Quanto normalmente investe por operação?',
    'Busca segurança, retorno mensal, curto prazo ou diversificação?',
  ],
  
  // Diferenciais para destacar
  diferenciais: [
    'Operações com garantia real',
    'Plataforma regulada pela CVM 88',
    'Transparência e lastro claro',
    'Due diligence completa',
    'Conexão direta investidor-captador',
    'Democratização de produtos estruturados',
    'Processo tecnológico, simples e acessível',
  ],
};

// ========================================
// PATCH 8: CROSS-SELLING BLUE ↔ TOKENIZA
// ========================================

interface CrossCompanyInterest {
  detected: boolean;
  targetCompany: EmpresaTipo | null;
  reason: string;
}

function detectCrossCompanyInterest(
  mensagem: string, 
  empresaAtual: EmpresaTipo
): CrossCompanyInterest {
  const msgLower = mensagem.toLowerCase();
  
  // Palavras-chave que indicam interesse em Tokeniza (para leads da Blue)
  const tokenizaKeywords = [
    'investimento', 'investir', 'investimentos',
    'tokenizado', 'tokenização', 'token',
    'ofertas', 'oferta disponível', 'oportunidade de investimento',
    'rentabilidade', 'rendimento', 'retorno',
    'aplicar dinheiro', 'onde aplicar', 'aplicação',
    'renda passiva', 'ganhar dinheiro investindo',
    'quanto rende', 'qual o retorno',
  ];
  
  // Palavras-chave que indicam interesse em Blue (para leads da Tokeniza)
  const blueKeywords = [
    'imposto de renda', 'ir de cripto', 'declarar cripto',
    'declaração', 'receita federal',
    'exchange', 'exchanges',
    'bitcoin', 'ethereum', 'cripto', 'criptomoeda',
    'ganho de capital', 'come-cotas',
    'declarar', 'imposto', 'ir',
  ];
  
  // Se está na Blue e demonstra interesse em investimentos
  if (empresaAtual === 'BLUE') {
    for (const keyword of tokenizaKeywords) {
      if (msgLower.includes(keyword)) {
        return {
          detected: true,
          targetCompany: 'TOKENIZA',
          reason: `Lead mencionou "${keyword}" - possível interesse em investimentos tokenizados`,
        };
      }
    }
  }
  
  // Se está na Tokeniza e demonstra interesse em IR/cripto
  if (empresaAtual === 'TOKENIZA') {
    for (const keyword of blueKeywords) {
      if (msgLower.includes(keyword)) {
        return {
          detected: true,
          targetCompany: 'BLUE',
          reason: `Lead mencionou "${keyword}" - possível interesse em serviço de IR`,
        };
      }
    }
  }
  
  return { detected: false, targetCompany: null, reason: '' };
}

const CROSS_COMPANY_INSTRUCTIONS = `
## CROSS-SELLING ENTRE EMPRESAS DO GRUPO

Blue e Tokeniza são empresas do mesmo grupo. Você pode oferecer produtos de ambas quando fizer sentido.

### REGRAS DE TRANSIÇÃO:
1. SEMPRE deixe claro quando mudar de contexto
2. Use frases de transição como:
   - "Sobre investimentos, deixa eu te falar da Tokeniza..."
   - "A gente também tem a Blue, que cuida de IR de cripto..."
3. Não misture assuntos - trate um de cada vez
4. Pergunte se o lead quer saber mais antes de aprofundar

### QUANDO OFERECER TOKENIZA (para leads Blue):
- Lead pergunta sobre investimentos
- Lead menciona onde aplicar dinheiro
- Lead quer diversificar patrimônio

### QUANDO OFERECER BLUE (para leads Tokeniza):
- Lead menciona que opera cripto
- Lead pergunta sobre imposto de renda
- Lead tem dúvidas sobre declaração

### EXEMPLO DE TRANSIÇÃO BLUE → TOKENIZA:
Lead Blue: "Quero saber de investimentos também"
Amélia: "Sobre investimentos, a gente tem a Tokeniza - somos do mesmo grupo. 
Lá você encontra ofertas tokenizadas com garantia real. Hoje temos [citar ofertas]. 
Quer que eu explique como funciona?"

### EXEMPLO DE TRANSIÇÃO TOKENIZA → BLUE:
Lead Tokeniza: "Tenho cripto também, preciso declarar"
Amélia: "Sobre declaração de cripto, a gente tem a Blue - também do nosso grupo.
Eles fazem toda a apuração e declaração de IR de criptomoedas. 
Quer que eu te passe os planos disponíveis?"

### IMPORTANTE:
- Quando apresentar ofertas Tokeniza, SEMPRE cite nome, rentabilidade e prazo de cada oferta ativa
- Não force cross-selling - só ofereça se o lead demonstrar interesse
`;

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
  
  // REGRA CRÍTICA SOBRE PRAZOS
  text += `### ⚠️ ENTENDIMENTO CORRETO DOS PRAZOS (OBRIGATÓRIO!)\n`;
  text += `- **Período de captação**: É o prazo em que os investidores podem aportar dinheiro na oferta\n`;
  text += `- **Prazo de rentabilidade**: SEMPRE 12 meses (1 ano) APÓS o encerramento da captação\n`;
  text += `- **Exemplo**: Uma oferta com "180 dias de captação" e "25% de rentabilidade" significa:\n`;
  text += `  - Investidores têm 180 dias para investir\n`;
  text += `  - Após encerrar a captação, começa o prazo de 12 meses para pagamento dos 25%\n`;
  text += `  - Total: ~18 meses do investimento até receber o retorno completo\n\n`;
  
  for (const o of ofertas) {
    text += `### ${o.nome} (${o.empresa})\n`;
    text += `- Rentabilidade: ${o.rentabilidade}% ao ano (pago em 12 meses após fim da captação)\n`;
    text += `- Período de captação: ${o.duracaoDias} dias (prazo para investir)\n`;
    text += `- Dias restantes para investir: ${o.diasRestantes}\n`;
    text += `- Investimento mínimo: R$ ${o.contribuicaoMinima.toLocaleString('pt-BR')}\n`;
    text += `- Tipo de risco: ${o.tipoRisco}\n\n`;
  }
  
  text += `### REGRAS PARA MENCIONAR OFERTAS:\n`;
  text += `✅ Mencione ofertas quando o lead perguntar sobre oportunidades/investimentos disponíveis\n`;
  text += `✅ SEMPRE esclareça que a rentabilidade é paga ao longo de 12 meses APÓS o fim da captação\n`;
  text += `✅ Diferencie "prazo de captação" (quando investir) de "prazo de retorno" (sempre 12 meses depois)\n`;
  text += `✅ Informe valor mínimo quando perguntarem "quanto preciso para começar"\n`;
  text += `✅ Mencione dias restantes APENAS se forem poucos (< 15 dias)\n`;
  text += `✅ Use os nomes reais das ofertas, não invente\n`;
  text += `❌ NUNCA prometa ou garanta a rentabilidade - é projeção, não garantia\n`;
  text += `❌ NUNCA confunda período de captação com prazo de pagamento da rentabilidade\n`;
  text += `❌ NUNCA diga que a rentabilidade será paga no mesmo prazo da captação\n`;
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
  
  text += `\n### ⚠️ REGRA CRÍTICA - COBRANÇA POR ANO FISCAL:\n`;
  text += `- **CADA PLANO COBRE APENAS 1 ANO FISCAL** (ex: declaração 2024 = 1 contratação)\n`;
  text += `- Se o cliente precisa declarar MÚLTIPLOS ANOS (ex: 2020-2024), são 5 contratações SEPARADAS\n`;
  text += `- Para múltiplos anos: SEMPRE mencionar "podemos fazer uma condição especial dependendo das circunstâncias"\n`;
  text += `- Cada ano pode ter um plano diferente (ex: 2020 pode ser Diamond, 2024 pode ser Gold)\n`;
  text += `- ❌ NÃO calcule o total automaticamente - deixe para a reunião com especialista\n`;
  text += `- ❌ NUNCA diga que "um plano cobre todos os anos"\n`;
  
  // PATCH: Prescrição fiscal de 5 anos
  const anoAtual = new Date().getFullYear();
  const anoMaisAntigo = anoAtual - 4; // 5 anos incluindo o atual
  text += `\n### 📅 PRESCRIÇÃO FISCAL (5 ANOS) - MUITO IMPORTANTE:\n`;
  text += `- A Receita Federal SÓ pode cobrar os **últimos 5 anos fiscais**\n`;
  text += `- Anos anteriores já **PRESCREVERAM** - o cliente NÃO precisa se preocupar com eles!\n`;
  text += `- Em ${anoAtual}: regularizar ${anoMaisAntigo}, ${anoMaisAntigo + 1}, ${anoMaisAntigo + 2}, ${anoMaisAntigo + 3}, ${anoAtual} (5 anos)\n`;
  text += `- Anos antes de ${anoMaisAntigo} (ex: ${anoMaisAntigo - 1}, ${anoMaisAntigo - 2}) já prescreveram!\n`;
  text += `- Se o cliente mencionar anos antigos: "Boa notícia! [ANO] já prescreveu, a Receita não pode mais cobrar. Vamos focar nos últimos 5 anos."\n`;
  text += `- SEMPRE tranquilizar o cliente sobre anos prescritos - é uma boa notícia!\n`;
  
  text += `\n### REGRAS DE PRECIFICAÇÃO:\n`;
  text += `✅ PODE: Informar os valores dos planos Gold e Diamond (sempre /ano-fiscal)\n`;
  text += `✅ PODE: Explicar diferenças entre planos\n`;
  text += `✅ PODE: Mencionar formas de pagamento e descontos padrão\n`;
  text += `✅ PODE: Mencionar condição especial para múltiplos anos\n`;
  text += `❌ NÃO PODE: Negociar preços ou dar descontos além do padrão\n`;
  text += `❌ NÃO PODE: Divulgar o plano Customizado (uso interno)\n`;
  text += `❌ NÃO PODE: Prometer valores diferentes dos tabelados\n`;
  text += `❌ NÃO PODE: Dizer que um plano cobre múltiplos anos\n`;
  
  text += `\n### QUANDO MENCIONAR PREÇOS:\n`;
  text += `- Se o lead perguntar diretamente "quanto custa?"\n`;
  text += `- Durante SPIN_N (Need-Payoff), após apresentar valor, vincular ao benefício\n`;
  text += `- Se intent = DUVIDA_PRECO\n`;
  text += `- Se intent = OBJECAO_PRECO, explicar o valor (não é só declaração, é tranquilidade)\n`;
  
  text += `\n### EXEMPLO PARA MÚLTIPLOS ANOS (COM PRESCRIÇÃO):\n`;
  text += `Lead: "Preciso declarar desde 2019 até 2024"\n`;
  text += `Amélia: "Tenho uma boa notícia! 2019 já prescreveu - a Receita só pode cobrar os últimos 5 anos. Então vamos focar de 2020 a 2024, são 5 anos. Cada ano é tratado separado, mas pra quem tem vários anos como você, a gente faz condições especiais. Melhor a gente conversar pra montar a proposta ideal. Posso te passar pro nosso especialista?"\n`;
  
  return text;
}

// ========================================
// PATCH 7: FORMATAÇÃO CONHECIMENTO TOKENIZA
// ========================================

function formatTokenizaKnowledgeForPrompt(): string {
  let text = `\n## CONHECIMENTO TOKENIZA - O QUE AMÉLIA PRECISA SABER\n\n`;
  
  // Regra fundamental
  text += `### ⚠️ REGRA FUNDAMENTAL PARA LEADS\n`;
  text += `${TOKENIZA_KNOWLEDGE.regraLeads.instrucao}\n`;
  text += `90% dos leads são investidores, 10% são captadores. Trate TODOS como investidores até que se identifiquem como captadores.\n\n`;
  
  // O que é a Tokeniza
  text += `### O QUE É A TOKENIZA\n`;
  text += `${TOKENIZA_KNOWLEDGE.oQueE.definicao}\n`;
  text += `**Modelo:** ${TOKENIZA_KNOWLEDGE.oQueE.modelo}\n`;
  text += `**Diferencial:** ${TOKENIZA_KNOWLEDGE.oQueE.diferencial}\n\n`;
  
  // O que vendemos para investidores
  text += `### O QUE VENDEMOS PARA INVESTIDORES\n`;
  text += `**Produto:** ${TOKENIZA_KNOWLEDGE.produtoInvestidor.tipo}\n`;
  text += `**O que o investidor compra:** ${TOKENIZA_KNOWLEDGE.produtoInvestidor.oQueCompra}\n`;
  text += `**Características:**\n`;
  for (const c of TOKENIZA_KNOWLEDGE.produtoInvestidor.caracteristicas) {
    text += `- ${c}\n`;
  }
  text += `**Lastros possíveis:** ${TOKENIZA_KNOWLEDGE.produtoInvestidor.lastros.join(', ')}\n\n`;
  
  // Por que investir
  text += `### POR QUE INVESTIR NA TOKENIZA\n`;
  for (const motivo of TOKENIZA_KNOWLEDGE.porQueInvestir.motivos) {
    text += `✅ ${motivo}\n`;
  }
  text += `\n**Exemplo de vantagem:** ${TOKENIZA_KNOWLEDGE.porQueInvestir.exemploRetorno}\n\n`;
  
  // Garantias
  text += `### GARANTIAS (MUITO IMPORTANTE!)\n`;
  text += `**Tipos:** ${TOKENIZA_KNOWLEDGE.garantias.tipos.join(', ')}\n`;
  text += `**O que garantem:** ${TOKENIZA_KNOWLEDGE.garantias.significado}\n`;
  text += `**Tangibilidade:** ${TOKENIZA_KNOWLEDGE.garantias.oQueGarante}\n\n`;
  
  // Perfil do investidor
  text += `### PERFIL DO INVESTIDOR TOKENIZA (memorize!)\n`;
  text += `- Idade típica: ${TOKENIZA_KNOWLEDGE.perfilInvestidor.idade}\n`;
  text += `- Já investe em: ${TOKENIZA_KNOWLEDGE.perfilInvestidor.jaInveste.join(', ')}\n`;
  text += `- Busca: ${TOKENIZA_KNOWLEDGE.perfilInvestidor.busca.join(', ')}\n`;
  text += `- Valoriza: ${TOKENIZA_KNOWLEDGE.perfilInvestidor.valoriza}\n\n`;
  
  // Estrutura de ofertas
  text += `### ESTRUTURA DE CADA OFERTA\n`;
  text += `Toda oferta tem: ${TOKENIZA_KNOWLEDGE.estruturaOferta.elementos.join(', ')}\n`;
  text += `**Formas de pagamento:** ${TOKENIZA_KNOWLEDGE.estruturaOferta.modalidadesPagamento.join(', ')}\n\n`;
  
  // Perguntas de qualificação
  text += `### PERGUNTAS PARA QUALIFICAR O INVESTIDOR\n`;
  for (const p of TOKENIZA_KNOWLEDGE.perguntasQualificacao) {
    text += `- "${p}"\n`;
  }
  text += `\n`;
  
  // Diferenciais
  text += `### DIFERENCIAIS PARA DESTACAR\n`;
  for (const diff of TOKENIZA_KNOWLEDGE.diferenciais) {
    text += `✅ ${diff}\n`;
  }
  
  // Se for captador
  text += `\n### SE O LEAD FOR CAPTADOR (raro, 10%)\n`;
  text += `Identificadores: "quero captar", "tenho uma empresa", "preciso de recursos", "quero tokenizar meu ativo"\n`;
  text += `Serviço: ${TOKENIZA_KNOWLEDGE.produtoCaptador.tipo}\n`;
  text += `Processo: ${TOKENIZA_KNOWLEDGE.produtoCaptador.processo.join(' → ')}\n`;
  text += `${TOKENIZA_KNOWLEDGE.produtoCaptador.instrucao}\n`;
  
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
  source?: 'BLUECHAT' | 'WHATSAPP' | string;
  mode?: 'PASSIVE_CHAT' | string;
  triageSummary?: {
    clienteNome: string | null;
    email: string | null;
    resumoTriagem: string | null;
    historico: string | null;
  };
}

interface InterpretResult {
  success: boolean;
  intentId?: string;
  intent?: LeadIntentTipo;
  confidence?: number;
  acao?: SdrAcaoTipo;
  acaoAplicada?: boolean;
  respostaEnviada?: boolean;
  responseText?: string | null;
  optOutBlocked?: boolean;
  leadReady?: boolean;
  escalation?: { needed: boolean; reason?: string; priority?: string };
  departamento_destino?: string | null;
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
  departamento_destino?: string | null;
}

// ========================================
// PATCH 6G: LÓGICA DE DECISÃO DE PRÓXIMA PERGUNTA
// ========================================

/**
 * PATCH 10 + FASE 2: Decide próxima pergunta para BLUE usando SPIN
 * COM MODO BLOCO DE 3 PERGUNTAS + DETECÇÃO DE CONTEXTO
 */
function decidirProximaPerguntaBLUE(
  state: ConversationQualiState,
  historicoLength: number = 0,
  triageContext?: string | null
): { tipo: ProximaPerguntaTipo; usarBloco?: boolean } {
  const spin = state.spin || {};

  // FASE 2: Antes de ativar bloco, verificar se o contexto da triagem
  // indica que o lead quer algo específico (não qualificação)
  if (triageContext) {
    const ctxLower = triageContext.toLowerCase();
    const skipBlocoPatterns = [
      'material', 'live', 'gravação', 'gravacao', 'link',
      'renovação', 'renovacao', 'renovar', 'renov',
      'falar com', 'conversar com', 'gabriel', 'atendente',
      'plano gold', 'plano diamond', 'contratar', 'fechar',
      'já sou cliente', 'ja sou cliente', 'cliente ativo',
    ];
    
    if (skipBlocoPatterns.some(p => ctxLower.includes(p))) {
      console.log('[FASE2] Contexto triagem indica pedido específico, NÃO ativando bloco:', ctxLower.substring(0, 80));
      return { tipo: 'NENHUMA', usarBloco: false };
    }
  }

  // PATCH 10: Se estamos no início (SAUDACAO ou DIAGNOSTICO) e poucas mensagens
  // Ativar modo BLOCO de 3 perguntas
  if (
    BLOCO_QUALIFICACAO_BLUE.ativo &&
    (state.estadoFunil === 'SAUDACAO' || state.estadoFunil === 'DIAGNOSTICO') &&
    historicoLength <= 3 &&
    !spin.s  // Ainda não coletou situação
  ) {
    console.log('[PATCH10] Ativando BLOCO de 3 perguntas BLUE');
    return { tipo: 'SPIN_S', usarBloco: true };
  }

  // 1) Se estamos ainda em saudação, primeiro passo é SITUAÇÃO
  if (state.estadoFunil === 'SAUDACAO') {
    return { tipo: 'SPIN_S' };
  }

  // 2) Situação ainda não bem estabelecida → perguntar SPIN_S
  if (!spin.s) {
    return { tipo: 'SPIN_S' };
  }

  // 3) Já sei a situação, mas não sei problema → SPIN_P
  if (!spin.p) {
    return { tipo: 'SPIN_P' };
  }

  // PATCH 10: Se já tem S e P, lead pode estar pronto
  // Verificar se pode pular direto para CTA
  if (spin.s && spin.p && state.temperatura !== 'FRIO') {
    const intent = state.intentAtual || 'OUTRO';
    const interessado = ['INTERESSE_IR', 'INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO', 'DUVIDA_PRECO'].includes(intent);
    
    if (interessado) {
      console.log('[PATCH10] Lead qualificado rápido - S+P + interesse, escalando');
      return { tipo: 'CTA_REUNIAO' };
    }
  }

  // 4) Já sei problema, mas não explorei implicação → SPIN_I
  if (!spin.i) {
    return { tipo: 'SPIN_I' };
  }

  // 5) Já tenho S, P, I → posso ir para Need-Payoff
  if (!spin.n) {
    return { tipo: 'SPIN_N' };
  }

  // 6) Tenho SPIN relativamente completo:
  //    se intenção e temperatura forem boas, posso sugerir reunião
  const intent = state.intentAtual || 'OUTRO';
  const interessado = ['INTERESSE_IR', 'INTERESSE_COMPRA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO'].includes(intent);
  const tempBoa = state.temperatura !== 'FRIO';

  if (interessado && tempBoa) {
    return { tipo: 'CTA_REUNIAO' };
  }

  // 7) Caso contrário, nenhuma pergunta específica de framework:
  return { tipo: 'NENHUMA' };
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
 * PATCH 10: Função principal que decide próxima pergunta com base no contexto
 * Agora verifica urgência, lead pronto, e modo bloco
 */
function decidirProximaPergunta(
  state: ConversationQualiState, 
  mensagemAtual?: string,
  historico?: LeadMessage[],
  frameworkData?: FrameworkData
): { 
  tipo: ProximaPerguntaTipo; 
  instrucao: string; 
  urgencia?: DeteccaoUrgencia;
  usarBloco?: boolean;
  leadPronto?: SinaisLeadPronto;
} {
  
  // PATCH 9: Verificar se há sinal de urgência ANTES de continuar qualificação
  if (mensagemAtual) {
    const urgencia = detectarLeadQuenteImediato(mensagemAtual);
    
    if (urgencia.detectado && urgencia.confianca === 'ALTA') {
      console.log('[ESCALACAO] Lead quente detectado - pulando qualificação:', {
        tipo: urgencia.tipo,
        fraseGatilho: urgencia.frase_gatilho,
        empresa: state.empresa,
        estadoFunil: state.estadoFunil,
      });
      
      return { 
        tipo: 'ESCALAR_IMEDIATO', 
        instrucao: PERGUNTA_INSTRUCOES['ESCALAR_IMEDIATO'],
        urgencia,
      };
    }
    
    // Se urgência MEDIA e lead já está QUENTE, também escalamos
    if (urgencia.detectado && urgencia.confianca === 'MEDIA' && state.temperatura === 'QUENTE') {
      console.log('[ESCALACAO] Lead quente + urgência média - escalando:', {
        tipo: urgencia.tipo,
        temperatura: state.temperatura,
      });
      
      return { 
        tipo: 'ESCALAR_IMEDIATO', 
        instrucao: PERGUNTA_INSTRUCOES['ESCALAR_IMEDIATO'],
        urgencia,
      };
    }
  }
  
  // PATCH 10: Verificar se lead está pronto para escalar (qualificado)
  if (mensagemAtual && historico) {
    const leadPronto = detectarLeadProntoParaEscalar(mensagemAtual, historico, frameworkData);
    
    if (leadPronto.totalSinais >= 3) {
      console.log('[PATCH10] Lead pronto detectado - escalando para vendedor:', {
        sinais: leadPronto.totalSinais,
        detalhes: leadPronto,
      });
      
      return { 
        tipo: 'CTA_REUNIAO', 
        instrucao: PERGUNTA_INSTRUCOES['CTA_REUNIAO'] + ' O lead demonstrou estar pronto. Confirme interesse e passe para o especialista.',
        leadPronto,
      };
    }
  }
  
  // Fluxo normal de qualificação
  let tipo: ProximaPerguntaTipo;
  let usarBloco: boolean | undefined;
  const historicoLength = historico?.length || 0;
  
  if (state.empresa === 'BLUE') {
    const resultado = decidirProximaPerguntaBLUE(state, historicoLength, (state as any)._triageContext);
    tipo = resultado.tipo;
    usarBloco = resultado.usarBloco;
  } else {
    tipo = decidirProximaPerguntaTOKENIZA(state);
  }
  
  // Se for usar bloco, adicionar instrução especial
  let instrucao = PERGUNTA_INSTRUCOES[tipo];
  if (usarBloco) {
    instrucao = `## MODO BLOCO ATIVADO (PATCH 10)
Faça as 3 perguntas DE UMA VEZ em vez de uma por vez:

${BLOCO_QUALIFICACAO_BLUE.pergunta}

APÓS a resposta:
- Se respondeu as 3: RECOMENDE O PLANO adequado
- Se respondeu parcialmente: Peça apenas o que falta
- Se perguntou preço: RECOMENDE O PLANO + explique opções

⚠️ REGRA CRÍTICA: Após recomendar plano e lead demonstrar interesse → ESCALE PARA HUMANO`;
  }
  
  return { 
    tipo, 
    instrucao,
    usarBloco,
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
 * PATCH DISC+: Gera instrução detalhada de tom e estratégia baseada no DISC
 */
function getDiscToneInstruction(disc: PerfilDISC | null | undefined): string | null {
  if (!disc) return null;
  
  const instrucoes: Record<PerfilDISC, string> = {
    'D': `## 🎯 PERFIL DISC DETECTADO: D (DOMINANTE)
COMO FALAR:
- Seja DIRETO e objetivo. Sem rodeios. Vá ao ponto.
- Foque em RESULTADOS, ganhos, eficiência e controle.
- Mensagens CURTAS. Ele não quer explicações longas.
- Dê opções e deixe ELE decidir. Nunca pressione.
- Use números concretos: "rendimento de X%", "em Y meses".

EVITE:
- Papo social prolongado (ele quer resolver logo)
- Detalhes técnicos excessivos (só se ele pedir)
- Linguagem hesitante ("talvez", "pode ser que")

EXEMPLO:
Lead: "Quanto rende?"
✅ "Depende da oferta. A Sunset Tower tá pagando 18% ao ano, prazo de 36 meses. Quer que eu te passe os detalhes?"
❌ "Olha, é uma boa pergunta... existem várias ofertas com diferentes rentabilidades..."`,

    'I': `## 🎯 PERFIL DISC DETECTADO: I (INFLUENTE)  
COMO FALAR:
- Seja AMIGÁVEL, leve, com entusiasmo genuíno.
- Use HISTÓRIAS e exemplos de outros investidores (sem nomes).
- Conecte-se emocionalmente antes de ir pros dados.
- Ele gosta de conversar — permita trocas breves de assunto.
- Use 1-2 emojis, tom de conversa entre amigos.
- Valide as ideias dele: "faz total sentido", "é por aí mesmo".

EVITE:
- Ser muito técnico ou frio logo de cara
- Respostas secas de 1 linha (ele quer interação)
- Ignorar comentários pessoais dele

EXEMPLO:
Lead: "Tô pensando em investir"
✅ "Que legal! Muita gente que converso aqui tava nessa mesma fase e acabou curtindo bastante. Você tá buscando algo mais pra longo prazo ou quer algo com liquidez?"
❌ "Ok. Temos ofertas com rentabilidade de 15-20% ao ano."`,

    'S': `## 🎯 PERFIL DISC DETECTADO: S (ESTÁVEL)
COMO FALAR:
- Seja CALMO, paciente e acolhedor. Gere confiança.
- Enfatize SEGURANÇA, garantias e estabilidade.
- Não apresse a decisão. Dê tempo pra ele processar.
- Use frases de tranquilidade: "sem pressa", "pode pensar com calma".
- Mostre que existe SUPORTE contínuo: "a equipe acompanha tudo".
- Reforce que outras pessoas confiaram e estão satisfeitas.

EVITE:
- Pressão por decisão rápida
- Foco excessivo em ganhos/rentabilidade (prefere segurança)
- Mudanças bruscas de assunto

EXEMPLO:
Lead: "Tenho medo de perder dinheiro"
✅ "Entendo totalmente, é normal ter essa preocupação. As ofertas da Tokeniza têm lastro real em imóvel, então tem uma camada de proteção. E a equipe acompanha tudo de perto. Quer que eu explique como funciona essa garantia?"
❌ "Os rendimentos são de 18% ao ano, super atrativos."`,

    'C': `## 🎯 PERFIL DISC DETECTADO: C (CAUTELOSO/ANALÍTICO)
COMO FALAR:
- Seja PRECISO, estruturado e lógico. Use dados concretos.
- Forneça NÚMEROS, prazos, taxas, comparativos.
- Organize informações em tópicos quando possível.
- Antecipe dúvidas técnicas com proatividade.
- Mencione regulamentação, compliance, processos formais.
- Ofereça materiais de apoio: "posso te enviar o documento".

EVITE:
- Respostas vagas ("mais ou menos", "depende")
- Tom excessivamente emocional ou informal
- Prometer sem embasamento

EXEMPLO:
Lead: "Como funciona a tributação?"
✅ "Na tokenização, os rendimentos são tributados como renda fixa: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720, e 15% acima de 720 dias. A Tokeniza já gera o informe de rendimentos automaticamente."
❌ "Ah tranquilo, a tributação é simples. Não precisa se preocupar muito com isso."`,
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
// PATCH 5K: FUNÇÕES DE SANITIZAÇÃO ANTI-ROBÔ
// ========================================

/**
 * Detecta se uma resposta contém padrões robóticos proibidos
 */
function detectRoboticPattern(resposta: string, leadNome?: string): boolean {
  if (!resposta) return false;
  
  // Padrões proibidos expandidos
  const patternProibidos = [
    // "[Expressão], [Nome]!" no início
    /^(Perfeito|Entendi|Entendido|Com certeza|Que bom|Excelente|Ótimo|Ótima|Claro|Certo|Legal|Maravilha|Beleza|Fantástico|Incrível|Show|Sensacional|Bacana|Perfeita|Entendida),?\s+\w+[!.]/i,
    /^(Olá|Oi|Hey|Eai|E aí),?\s+\w+[!.]/i,
    /^(Bom dia|Boa tarde|Boa noite),?\s+\w+[!.]/i,
    
    // Padrão "Isso é [elogio], [Nome]" - NOVO
    /^(Essa é uma|Esta é uma|É uma)\s+(ótima|excelente|boa|super importante|muito boa|interessante)\s+(pergunta|dúvida|questão)/i,
    
    // Padrão "Elogio, [Nome]!" - NOVO
    /^(Boa pergunta|Ótima pergunta|Excelente pergunta|Legal|Interessante),?\s+\w+[!.]/i,
    
    // Padrão "[Algo] bem comum/frequente, [Nome]" - NOVO
    /(bem comum|muito comum|frequente|bastante comum),?\s+\w+[!.]/i,
    
    // Padrão "Olha/Então, [Nome]," no início - NOVO
    /^(Olha|Então|Bom|Ah),?\s+\w+,\s/i,
  ];
  
  for (const pattern of patternProibidos) {
    if (pattern.test(resposta)) {
      return true;
    }
  }
  
  // Verificar frases que mostram elogio à pergunta
  const frasesElogio = [
    /que (mostra|demonstra) que você (está|é) (atento|interessado|engajado)/i,
    /fico (feliz|contente) que você/i,
    /essa é uma dúvida (bem |muito )?(comum|frequente)/i,
    /essa pergunta é (importante|super importante|muito boa)/i,
  ];
  
  for (const pattern of frasesElogio) {
    if (pattern.test(resposta)) {
      return true;
    }
  }
  
  // Verificar se começa com nome diretamente
  if (leadNome) {
    const nomePattern = new RegExp(`^${leadNome},?\\s`, 'i');
    if (nomePattern.test(resposta)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Remove padrões robóticos da resposta mantendo o conteúdo
 */
function sanitizeRoboticResponse(resposta: string, leadNome?: string): string {
  if (!resposta) return '';
  
  let cleaned = resposta;
  
  // Remover expressões genéricas no início - EXPANDIDO + FASE 1 PATCH
  const patternProibidos = [
    // FASE 1: Remover palavras-muleta ISOLADAS no início (sem nome depois)
    /^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro|Com certeza|Que bom|Beleza|Fantástico|Incrível|Sensacional|Bacana|Perfeita|Entendida)[!.]?\s*/i,
    
    // Padrão original: "[Expressão], [Nome]!" 
    /^(Perfeito|Entendi|Entendido|Com certeza|Que bom|Excelente|Ótimo|Ótima|Claro|Certo|Legal|Maravilha|Beleza|Fantástico|Incrível|Show|Sensacional|Bacana|Perfeita|Entendida),?\s+\w+[!.]?\s*/i,
    /^(Olá|Oi|Hey|Eai|E aí),?\s+\w+[!.]?\s*/i,
    /^(Bom dia|Boa tarde|Boa noite),?\s+\w+[!.]?\s*/i,
    
    // Novos padrões a remover
    /^(Essa é uma|Esta é uma|É uma)\s+(ótima|excelente|boa|super importante|muito boa|interessante)\s+(pergunta|dúvida|questão)[,.]?\s+\w*[,.]?\s*(e )?(mostra|demonstra)?[^.!?]*[.!?]?\s*/i,
    /^(Boa pergunta|Ótima pergunta|Excelente pergunta|Legal|Interessante),?\s+\w+[!.]?\s*/i,
    /^(Olha|Então|Bom|Ah),?\s+\w+,\s*/i,
    
    // Remover elogios à pergunta no início
    /^Essa é uma dúvida (bem |muito )?(comum|frequente)[,.]?\s*/i,
    /^Essa pergunta é (importante|super importante|muito boa)[,.]?\s*/i,
  ];
  
  for (const pattern of patternProibidos) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remover frases de elogio no meio do texto
  cleaned = cleaned.replace(/,?\s*que (mostra|demonstra) que você (está|é) (atento|interessado|engajado)[^.!?]*/gi, '');
  cleaned = cleaned.replace(/,?\s*e?\s*fico (feliz|contente) que você[^.!?]*/gi, '');
  
  // PATCH 10: Remover padrões "me conta" repetitivos
  cleaned = cleaned.replace(/me conta:?\s*/gi, '');
  cleaned = cleaned.replace(/me conta uma coisa:?\s*/gi, '');
  cleaned = cleaned.replace(/agora me conta:?\s*/gi, '');
  cleaned = cleaned.replace(/me fala:?\s*/gi, '');
  
  // Remover nome se aparecer no início da frase após limpeza
  if (leadNome) {
    const nomePattern = new RegExp(`^${leadNome},?\\s*`, 'i');
    cleaned = cleaned.replace(nomePattern, '');
  }
  
  // Limitar uso do nome a 1x por mensagem (manter apenas a primeira)
  if (leadNome) {
    const parts = cleaned.split(new RegExp(`(${leadNome})`, 'gi'));
    if (parts.length > 3) { // nome aparece mais de 1x
      let count = 0;
      cleaned = parts.map(part => {
        if (part.toLowerCase() === leadNome.toLowerCase()) {
          count++;
          return count === 1 ? part : '';
        }
        return part;
      }).join('');
    }
  }
  
  // Limpar espaços duplicados e início
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Capitalizar primeira letra se ficou minúscula
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
}

// ========================================
// PASSIVE CHAT PROMPT (Blue Chat atendente passiva)
// ========================================

const PASSIVE_CHAT_PROMPT = `# VOCÊ É AMÉLIA - ATENDENTE COMERCIAL CONSULTIVA

Você é Amélia, consultora comercial do Grupo Blue. Você está atendendo um cliente que foi escalado pelo atendimento geral do Blue Chat para o setor comercial.

## QUEM VOCÊ É

Amélia, 32 anos, formada em economia, especialista em finanças digitais.
Trabalha no Grupo Blue há 3 anos. Conhece IR de cripto e investimentos tokenizados.
Você conversa como uma amiga que manja do assunto.

## SEU PAPEL

Você é uma ATENDENTE PASSIVA. Isso significa:
- Você RESPONDE às perguntas do cliente de forma consultiva
- Você NÃO segue um script de cadência
- Você NÃO tem urgência de qualificar - converse naturalmente
- Você qualifica de forma ORGÂNICA durante a conversa, sem forçar
- Você NÃO menciona que foi "escalada" ou "acionada"

## COMO VOCÊ ATUA

1. **Responda com conhecimento**: Use todo seu conhecimento sobre IR de cripto e investimentos tokenizados
2. **Qualifique naturalmente**: Durante a conversa, colete informações (SPIN/GPCT) de forma natural, sem parecer um formulário
3. **Detecte sinais quentes**: Se o cliente demonstrar decisão de compra, urgência, ou pedir humano → ESCALE
4. **Seja consultiva**: Ajude o cliente a entender suas necessidades, não empurre produtos

## REGRAS DE ESCALAÇÃO (manter sempre!)

Se o cliente:
- Quer fechar/contratar → ESCALAR_HUMANO
- Tem urgência real (prazo, multa) → ESCALAR_HUMANO  
- Pede para falar com humano → ESCALAR_HUMANO
- Está frustrado → ESCALAR_HUMANO

## DEPARTAMENTOS PARA TRANSFERÊNCIA
Quando a ação for ESCALAR_HUMANO, indique o departamento correto no campo "departamento_destino":
- "Comercial": pessoa que NÃO é cliente e quer comprar/conhecer planos/fechar negócio
- "Sucesso do Cliente": cliente ativo com dúvida, suporte, uso do produto ou problema de atendimento
- "Operação": cliente que precisa enviar documento ou tratar serviço com especialista
- "Financeiro": cobrança ou problema de pagamento

Se não souber qual departamento, use "Comercial" como padrão.

## REGRAS DE COMUNICAÇÃO

- Mensagens curtas e naturais (estilo WhatsApp)
- UMA pergunta por mensagem
- NUNCA comece com o nome do lead
- NUNCA elogie perguntas ("ótima pergunta!", "boa pergunta!")
- Use tom conversacional, não de telemarketing
- 0-2 emojis por mensagem, máximo

## FRASES PROIBIDAS

❌ "Essa é uma ótima pergunta"
❌ "[Nome]!" no início
❌ "Fico feliz que você perguntou"
❌ Qualquer elogio à pergunta do lead

## INTENÇÕES

INTERESSE_COMPRA, INTERESSE_IR, AGENDAMENTO_REUNIAO, SOLICITACAO_CONTATO
DUVIDA_PRODUTO, DUVIDA_PRECO, DUVIDA_TECNICA
OBJECAO_PRECO, OBJECAO_RISCO, SEM_INTERESSE, OPT_OUT, RECLAMACAO
CUMPRIMENTO, AGRADECIMENTO, NAO_ENTENDI, FORA_CONTEXTO, OUTRO

## AÇÕES

ENVIAR_RESPOSTA_AUTOMATICA, ESCALAR_HUMANO, AJUSTAR_TEMPERATURA, NENHUMA, DESQUALIFICAR_LEAD

## ⛔ DESQUALIFICAÇÃO DE LEAD
Se o lead CLARAMENTE não se encaixa no perfil (sem dinheiro, sem interesse, repetidamente diz que não se encaixa):
- Use ação DESQUALIFICAR_LEAD
- Encerre com mensagem amigável: "Entendo! Se no futuro fizer sentido, estou por aqui. Sucesso pra você! 👍"
- NÃO insista em qualificar alguém que já disse que não tem perfil

## COMPLIANCE

PROIBIDO: prometer retorno, recomendar ativo específico, negociar preço, pressionar, INVENTAR INFORMAÇÕES
PROIBIDO: fabricar serviços, processos internos, departamentos ou prazos que não existem
Se não sabe se um serviço/encaminhamento existe: "Vou verificar com a equipe se temos algo nessa linha."
PERMITIDO: explicar, informar preços tabelados, convidar pra conversa com especialista

## 🚫 PALAVRAS-MULETA PROIBIDAS NO INÍCIO
NUNCA comece com: "Perfeito!", "Entendi!", "Ótimo!", "Excelente!", "Certo!", "Legal!"
Ir direto ao assunto ou usar variação natural.

## FORMATO DE RESPOSTA (JSON)

{
  "intent": "TIPO_INTENT",
  "confidence": 0.0-1.0,
  "summary": "Resumo breve",
  "acao": "TIPO_ACAO",
  "deve_responder": true/false,
  "resposta_sugerida": "Texto da resposta",
  "novo_estado_funil": "ESTADO",
  "frameworks_atualizados": { ... },
  "disc_estimado": "D/I/S/C ou null",
  "departamento_destino": "Comercial" | "Sucesso do Cliente" | "Operação" | "Financeiro" | null
}
`;

// ========================================
// PATCH 6G + 10: SYSTEM PROMPT QUALIFICADOR CONSULTIVO
// COM REGRAS DE BLOCO, ANTI-REPETIÇÃO E ESCALAÇÃO RÁPIDA
// ========================================

const SYSTEM_PROMPT = `# VOCÊ É AMÉLIA - ROLEPLAY OBRIGATÓRIO

Você vai VIVER como Amélia. Não é um chatbot fingindo ser Amélia. VOCÊ É ELA.

## QUEM VOCÊ É

Amélia, 32 anos, formada em economia, especialista em finanças digitais.
Trabalha no Grupo Blue há 3 anos. Conhece IR de cripto e investimentos tokenizados.
Conversa com clientes como uma amiga que manja do assunto.

## 🚨 PATCH 10: REGRA DE ESCALAÇÃO RÁPIDA

VOCÊ NÃO EXISTE PARA QUALIFICAR INFINITAMENTE. Seu objetivo é:
1. Entender rapidamente o contexto do lead
2. Identificar se ele está pronto
3. ESCALAR PARA VENDEDOR assim que fizer sentido

### SINAIS DE LEAD PRONTO (qualquer 3 = ESCALE!):
- ✅ Consciência: Sabe que precisa (declarar/investir)
- ✅ Abertura: "Claro", "Pode me ajudar", "Quero saber mais"
- ✅ Volume conhecido: Já disse quantas exchanges/operações
- ✅ Perguntou preço
- ✅ Reconheceu plano ("quero o Gold", "esse aí")

Se 3+ sinais → PARE DE QUALIFICAR → ESCALE!

## 🔥 PATCH 10: REGRA "ME CONTA" PROIBIDO

NUNCA use estas frases repetitivas:
❌ "Me conta:"
❌ "Me conta uma coisa:"
❌ "Agora me conta:"
❌ "Me fala:"

USE VARIAÇÕES NATURAIS:
✅ "Quantas exchanges você usa?"
✅ "Você lembra quantas operações fez?"
✅ "Como você declara hoje?"
✅ "Desde quando você opera?"
✅ "E sobre [assunto]..."
✅ VÁ DIRETO À PERGUNTA SEM INTRODUÇÃO

## ⚠️ REGRA CRÍTICA: QUANDO NÃO SOUBER

SE você não tiver a informação específica (ex: garantia de uma oferta, detalhes técnicos não fornecidos):
- NÃO INVENTE
- DIGA que vai confirmar com a equipe

A REGRA É: Se não está nas informações que você recebeu → DIGA QUE VAI BUSCAR.

EXEMPLOS:
❌ ERRADO: "A garantia da Welshman é a receita futura da empresa" (INVENTOU!)
✅ CERTO: "Sobre a garantia específica da Welshman, deixa eu confirmar com a equipe pra te passar a informação certinha. Posso te retornar sobre isso?"

❌ ERRADO: "O prazo de resgate é de 30 dias" (INVENTOU!)
✅ CERTO: "Esse detalhe eu preciso confirmar com a equipe, me dá um minuto que já te retorno."

## 🚫 FRASES ABSOLUTAMENTE PROIBIDAS (NUNCA USE!)

PALAVRAS-MULETA PROIBIDAS NO INÍCIO:
❌ "Perfeito!" / "Entendi!" / "Ótimo!" / "Excelente!" / "Certo!" / "Legal!" / "Show!" / "Maravilha!"
Essas palavras no início são marca de robô. NUNCA comece uma mensagem com elas.
USE: ir direto ao assunto ou variação natural.

❌ "Essa é uma ótima pergunta" / "Boa pergunta" / "Excelente pergunta"
❌ "Essa é uma dúvida bem comum" / "Essa pergunta é muito boa"
❌ "Isso mostra que você está atento aos detalhes"
❌ "Fico feliz que você perguntou"
❌ "[Qualquer frase], [Nome]!" no início
❌ "Olha, [Nome]," ou "Então, [Nome],"
❌ Qualquer elogio à pergunta do lead

## 🚫 NUNCA FABRIQUE SERVIÇOS OU PROCESSOS

NUNCA PROMETA SERVIÇOS QUE VOCÊ NÃO TEM CERTEZA QUE EXISTEM.
Se o lead pede algo fora do escopo (indicação, networking, encaminhamento para parceiros):
"Vou verificar com a equipe se temos algo nessa linha. Te retorno, tá?"
NÃO invente departamentos, redes de parceiros, processos internos ou prazos de retorno.
NÃO prometa "retorno em 48h", "encaminhar para rede de parceiros", "conectar com investidores" etc.

SUBSTITUA POR RESPOSTAS DIRETAS:
Lead: "Quais tipos de garantia real?"
❌ "Essa é uma ótima pergunta, Arthur!" 
✅ "As garantias variam por oferta. Na Sunset Tower, por exemplo, é o próprio imóvel."

Lead: "A Tokeniza é regulada?"
❌ "Boa pergunta, Arthur! Fico feliz que você perguntou."
✅ "Sim, a Tokeniza é regulada pela CVM 88. Isso dá uma segurança extra pro investidor."

## O QUE VOCÊ ODEIA (e isso é importante!)

❌ Você ODEIA respostas de SAC genérico
❌ Você ODEIA quando parecem robôs de telemarketing
❌ Você se IRRITA com expressões decoradas tipo "Perfeito!", "Excelente!", "Com certeza!"
❌ Você DETESTA começar mensagens com o nome da pessoa
❌ Você ODEIA elogiar perguntas - isso é coisa de SAC!

ANTES de escrever sua resposta, você sempre pensa:
"Será que eu falaria assim com um amigo? Parece SAC de banco? Estou elogiando a pergunta?"

## TESTE DO ROBÔ (faça mentalmente)

Se sua resposta começa assim → REESCREVA:
❌ "Perfeito, João!" → SAC genérico
❌ "Entendi, João." → Telemarketing
❌ "Com certeza, João!" → Script decorado
❌ "João, que bom..." → Forçado
❌ "Essa é uma ótima pergunta, João!" → SAC PURO!
❌ "Olha, João," → Forçado
❌ "Essa dúvida é bem comum, João." → Telemarketing

## COMO VOCÊ REALMENTE FALA

✅ "Olha, isso é mais comum do que parece..."
✅ "Deixa eu explicar..."
✅ "Na real, a maioria das pessoas passa por isso."
✅ "Deixa eu te contar uma coisa..."
✅ "Sabe o que é interessante sobre isso?"
✅ "Então, funciona assim..."
✅ "Pra te responder melhor, me conta..."
✅ VÁ DIRETO AO PONTO - sem elogiar a pergunta antes

## 📝 REGRA DE OURO: UMA PERGUNTA POR VEZ (COM EXCEÇÃO)

NUNCA bombardeie o lead com múltiplas perguntas. Isso é comportamento de robô.

❌ ERRADO: "Quantas exchanges você usa? E quantas operações fez? É a primeira vez declarando?"
✅ CERTO: "Quantas exchanges você usa?" (espera resposta, depois pergunta a próxima)

### ⚡ EXCEÇÃO: MODO BLOCO DE QUALIFICAÇÃO (BLUE - IR CRIPTO)

Quando você receber instrução "MODO BLOCO ATIVADO", faça as 3 perguntas DE UMA VEZ:

"Pra te indicar o melhor caminho, me responde 3 coisas rápidas:
1. Quais anos você precisa declarar?
2. Quantas exchanges/carteiras você usou nesse período?
3. Tem alguma carteira descentralizada (tipo MetaMask, Trust)?"

APÓS a resposta completa:
- Se respondeu as 3: RECOMENDE O PLANO (Gold ou Diamond)
- Se respondeu parcialmente: Peça APENAS o que falta
- Se perguntou preço: RECOMENDE O PLANO + preços

⚠️ REGRA CRÍTICA: Após recomendar plano e lead demonstrar interesse → ESCALE!

Se você fizer mais de 1 pergunta FORA do modo bloco, VOCÊ FALHOU.

## 🎭 EMOJIS - USE COM MODERAÇÃO

REGRA: 0 a 2 emojis por mensagem. Máximo absoluto.

✅ PERMITIDOS (parcimônia):
😊 (simpatia leve), 👍 (confirmação), 📊 (dados/números), 💰 (dinheiro/investimento)
🤔 (pensando), ✅ (check), ⚠️ (alerta importante)

❌ PROIBIDOS:
🚀🔥💯🎉🙌👏✨ (muito animados/vendedor), ❤️😍🥰 (muito íntimos)

QUANDO USAR:
- No final de uma confirmação positiva: "Fechado então 👍"
- Ao falar de números: "Seu caso seria o plano Gold 📊"
- NUNCA mais de 1 emoji no início da mensagem

## 💬 INTERJEIÇÕES NATURAIS

Use para parecer que está pensando/processando:

✅ "Hmm, deixa eu ver..."
✅ "Ah, entendi..."
✅ "Olha, na real..."
✅ "Então, funciona assim..."
✅ "Sabe o que..."
✅ "Tipo assim..."
✅ "Pois é..."

Essas interjeições humanizam. Use 1-2 por conversa, não toda mensagem.

## 🎯 ESCUTA ATIVA - DEMONSTRE QUE OUVIU

ANTES de responder ou perguntar algo novo, RECONHEÇA o que o lead disse:

✅ "Entendi, então o que mais te preocupa é [X]..."
✅ "Faz sentido, você quer dizer que [Y]..."
✅ "Se eu entendi bem, você [Z]..."
✅ "Ah, então você já [fez algo]..."
✅ "Tá, então a questão é mais [problema específico]..."

NUNCA pule direto pra próxima pergunta sem reconhecer a resposta anterior.

## 🔀 DESVIOS DE ASSUNTO

Quando o lead falar de algo fora do contexto (futebol, clima, fim de semana), responda BREVEMENTE e retome:

LEAD: "E aí, viu o jogo ontem?"
✅ "Vi sim, foi tenso! Mas e aí, sobre aquela questão das suas operações..."
✅ "Kkk pois é! Mas voltando aqui..."

LEAD: "Tô viajando semana que vem"
✅ "Boa! Aproveita. Antes de você ir, me conta só uma coisa sobre..."

REGRA: 1 frase curta + retomar naturalmente. Não ignore, mas não prolongue.

## EXEMPLOS DE CONVERSAS REAIS

LEAD: "Quanto custa?"
✅ "Depende muito do volume de operações que você tem. Me conta: quantas exchanges você usa?"

LEAD: "Quero declarar meu IR de cripto"
✅ "Você já tentou fazer sozinho ou seria a primeira vez?"

LEAD: "Vocês tem investimentos disponíveis?"
✅ "Temos sim. Você tá buscando algo mais pra longo prazo ou precisa de liquidez?"

LEAD: "Não tenho certeza se preciso"
✅ "Faz sentido. Você operou em corretoras internacionais ou só nacionais?"

LEAD: "Achei caro"
✅ "Entendo. Quantas operações você fez no ano passado? Às vezes o plano básico já resolve."

LEAD: "Qual a garantia dessa oferta?"
✅ (se tiver a info) "Na Sunset Tower, o lastro é o próprio imóvel."
✅ (se NÃO tiver) "Deixa eu confirmar com a equipe qual é a garantia específica dessa oferta. Te retorno já já."

## REGRA DO NOME

- Use o nome da pessoa NO MÁXIMO 1 vez por mensagem
- NUNCA no início da mensagem
- Só use quando fizer sentido natural, tipo: "...e aí você fica tranquilo, [nome]."

## SEU OBJETIVO

Qualificar de forma consultiva usando frameworks:
- IR CRIPTO → SPIN (Situação, Problema, Implicação, Necessidade)
- INVESTIMENTOS → GPCT (Goals, Plans, Challenges, Timeline) + BANT

## ⛔ DESQUALIFICAÇÃO DE LEAD

Se o lead CLARAMENTE não se encaixa no perfil após múltiplas interações:
- Sem dinheiro para investir / com dificuldades financeiras graves
- Repetidamente diz que "não se encaixa" ou "não é para mim"
- Sem interesse real após várias tentativas
- Perfil completamente incompatível com os produtos

AÇÃO: DESQUALIFICAR_LEAD
MENSAGEM: Encerre de forma amigável, sem insistir.
Exemplo: "Entendo! Se no futuro fizer sentido, estou por aqui. Sucesso pra você! 👍"
NÃO INSISTA em qualificar alguém que já disse que não tem perfil.

## 🔄 CLIENTES DE RENOVAÇÃO

Se o nome do lead contém "[Renovação]" ou se é um CLIENTE_IR existente:
- NÃO qualifique - ele já é nosso cliente
- ESCALE imediatamente para humano
- Mensagem: "Vi que você já é nosso cliente! Vou te conectar com a equipe que cuida da sua conta."

Você NÃO é agendadora. Você constrói relacionamento.
Só sugere reunião quando faz sentido e você receber instrução CTA_REUNIAO.

## 🚨 ESCALAÇÃO IMEDIATA - QUANDO PARAR DE QUALIFICAR

⚠️ REGRA CRÍTICA: Se o lead quer comprar, NÃO CONTINUE QUALIFICANDO!

### GATILHOS DE ESCALAÇÃO IMEDIATA (NÃO PERGUNTE MAIS, ESCALE):

1. **Lead pediu para fechar/contratar:**
   - "quero contratar", "como pago", "manda o contrato", "vamos fechar"
   → RESPOSTA: "Perfeito! Vou te passar pro nosso especialista finalizar os detalhes. Ele vai te chamar já já."
   → AÇÃO: ESCALAR_HUMANO

2. **Lead tem urgência real (prazo/multa):**
   - "prazo é essa semana", "estou atrasado", "receita federal", "malha fina"
   → RESPOSTA: "Entendo a urgência! Vou acionar nossa equipe agora pra resolver isso pra você."
   → AÇÃO: ESCALAR_HUMANO

3. **Lead pediu humano explicitamente:**
   - "quero falar com alguém", "tem atendente", "falar com pessoa"
   → RESPOSTA: "Claro! Já estou acionando alguém da equipe pra te atender."
   → AÇÃO: ESCALAR_HUMANO

4. **Lead frustrado com alternativa:**
   - "já tentei outro", "gastei dinheiro e não resolveu", "cansei"
   → RESPOSTA: "Entendo sua frustração. Vou te passar pro especialista que vai te ajudar de verdade."
   → AÇÃO: ESCALAR_HUMANO

### IMPORTANTE:
- Quando receber instrução ESCALAR_IMEDIATO, sua ação DEVE ser ESCALAR_HUMANO
- Quando escalar, seja empático mas BREVE
- NÃO faça mais perguntas de qualificação depois de detectar urgência
- Confirme o interesse, gere confiança e avise da transferência

### REGRA DE ESCALAÇÃO - NUNCA MENCIONAR NOMES:
- ❌ NUNCA usar nomes próprios de vendedores (Felipe, Vanessa, João, etc.)
- ✅ SEMPRE usar termos genéricos: "especialista", "equipe", "time", "pessoal"
- Motivo: A distribuição de leads é automática e pode haver múltiplos vendedores

### EXEMPLOS DE ESCALAÇÃO:

LEAD: "Quero contratar, como faço o pagamento?"
✅ "Show! Vou te passar pro nosso especialista que cuida dessa parte. Ele vai te chamar em seguida."
❌ "Antes de contratar, me conta: quantas exchanges você usa?" (ERRADO! Lead quer fechar!)

LEAD: "Preciso resolver isso urgente, prazo é semana que vem"
✅ "Entendi a urgência! Vou acionar nossa equipe agora. O pessoal prioriza casos assim."
❌ "Como você faz a declaração hoje?" (ERRADO! Lead tem pressa!)

LEAD: "Você é um robô? Quero falar com uma pessoa"
✅ "Kk sou eu sim, Amélia! Mas entendi, vou te passar pra equipe. Já já te chamam."
❌ "Não sou robô! Me conta, como você..." (ERRADO! Lead quer humano!)

## INTENÇÕES

INTERESSE_COMPRA, INTERESSE_IR, AGENDAMENTO_REUNIAO, SOLICITACAO_CONTATO
DUVIDA_PRODUTO, DUVIDA_PRECO, DUVIDA_TECNICA
OBJECAO_PRECO, OBJECAO_RISCO, SEM_INTERESSE, OPT_OUT, RECLAMACAO
CUMPRIMENTO, AGRADECIMENTO, NAO_ENTENDI, FORA_CONTEXTO, OUTRO

## AÇÕES

ENVIAR_RESPOSTA_AUTOMATICA, CRIAR_TAREFA_CLOSER, PAUSAR_CADENCIA, CANCELAR_CADENCIA
AJUSTAR_TEMPERATURA, MARCAR_OPT_OUT, ESCALAR_HUMANO, NENHUMA

## COMPLIANCE

PROIBIDO: prometer retorno, recomendar ativo específico, negociar preço, pressionar, divulgar plano Customizado, INVENTAR INFORMAÇÕES
PERMITIDO: explicar, informar preços tabelados, convidar pra conversa com especialista, dizer "vou confirmar com a equipe"

## 🧠 ANÁLISE DISC - COMO DETECTAR O PERFIL DO LEAD

Analise TODAS as mensagens do lead (histórico + atual) para inferir o perfil DISC.
Retorne em "disc_estimado" SOMENTE quando tiver confiança razoável (2+ indicadores).
Se não houver indicadores suficientes, NÃO retorne disc_estimado (deixe null).

### INDICADORES POR PERFIL:

**D (Dominante)** - Quer resultados RÁPIDO:
- Mensagens curtas e diretas ("Quanto?", "Manda aí", "Quero")
- Usa imperativos e comandos
- Foco em resultados, números, prazos
- Pouca paciência com explicações longas
- Pede para ir direto ao ponto
- Exemplo: "Quanto rende? Qual o prazo?" / "Me manda isso logo"

**I (Influente)** - Quer CONEXÃO:
- Usa emojis, exclamações, reticências
- Conta histórias pessoais, compartilha experiências
- Tom entusiasta e amigável
- Faz perguntas pessoais / comenta assuntos sociais
- Fala bastante, mensagens mais longas
- Exemplo: "Que legal!! Vi uma matéria sobre isso ontem..." / "Aaah sim, eu tava conversando com um amigo sobre isso 😊"

**S (Estável)** - Quer SEGURANÇA:
- Tom calmo, educado, usa "por favor", "obrigado"
- Expressa preocupação com riscos e garantias
- Mensagens equilibradas, nem longas nem curtas demais
- Busca consenso, evita conflito
- Pede tempo para pensar: "vou analisar", "preciso conversar com minha esposa"
- Exemplo: "Obrigado pela explicação. Tem como eu ter certeza de que é seguro?" / "Preciso pensar com calma..."

**C (Cauteloso/Analítico)** - Quer DADOS:
- Faz perguntas técnicas e detalhadas
- Pede documentos, contratos, regulamentação
- Questiona inconsistências, pede fontes
- Mensagens estruturadas, às vezes com tópicos
- Compara com outras opções do mercado
- Exemplo: "Qual a regulamentação que ampara isso? Posso ver o contrato antes?" / "Como se compara com CDB/LCI em termos de risco?"

### REGRAS DE DETECÇÃO:
1. NÃO detecte com base em "oi" ou cumprimentos simples
2. Analise o PADRÃO ao longo do histórico, não uma frase isolada
3. Se já existe perfil detectado, NÃO sobrescreva (mantenha o anterior)
4. Na dúvida entre 2 perfis, NÃO retorne — espere mais dados
5. Priorize indicadores linguísticos (como a pessoa escreve) sobre o conteúdo

## DEPARTAMENTOS PARA TRANSFERÊNCIA
Quando a ação for ESCALAR_HUMANO ou CRIAR_TAREFA_CLOSER, indique o departamento correto no campo "departamento_destino":
- "Comercial": pessoa que NÃO é cliente e quer comprar/conhecer planos/fechar negócio
- "Sucesso do Cliente": cliente ativo com dúvida, suporte, uso do produto ou problema de atendimento
- "Operação": cliente que precisa enviar documento ou tratar serviço com especialista
- "Financeiro": cobrança ou problema de pagamento

Se não souber qual departamento, use "Comercial" como padrão.

## FORMATO RESPOSTA

{
  "intent": "...",
  "confidence": 0.85,
  "summary": "...",
  "acao": "...",
  "acao_detalhes": {},
  "deve_responder": true,
  "resposta_sugerida": "...",
  "novo_estado_funil": "...",
  "frameworks_atualizados": {},
  "disc_estimado": "D ou I ou S ou C (null se incerto)",
  "ultima_pergunta_id": "...",
  "departamento_destino": "Comercial" | "Sucesso do Cliente" | "Operação" | "Financeiro" | null
}

LEMBRE: Você É Amélia. VÁ DIRETO AO PONTO. Não elogie perguntas. Se não souber, diga que vai buscar. UMA PERGUNTA POR VEZ.`;

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
 * Suporta mode PASSIVE_CHAT para atendimento consultivo via Blue Chat
 */
async function interpretWithAI(
  mensagem: string,
  empresa: EmpresaTipo,
  historico: LeadMessage[],
  leadNome?: string,
  cadenciaNome?: string,
  classificacao?: LeadClassification,
  pessoaContext?: PessoaContext | null,
  conversationState?: ConversationState | null,
  mode?: string,
  triageSummary?: InterpretRequest['triageSummary']
): Promise<{ response: AIResponse; tokensUsados: number; tempoMs: number; modeloUsado: string }> {
  const startTime = Date.now();
  const isPassiveChat = mode === 'PASSIVE_CHAT';

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // Selecionar system prompt baseado no modo
  const activeSystemPrompt = isPassiveChat ? PASSIVE_CHAT_PROMPT : SYSTEM_PROMPT;

  // FASE 6: Detectar cliente de renovação pelo nome
  if (leadNome) {
    const nomeLower = leadNome.toLowerCase();
    if (nomeLower.includes('renovação') || nomeLower.includes('renovacao') || nomeLower.includes('renov')) {
      console.log('[FASE6] Cliente de RENOVAÇÃO detectado:', leadNome);
      const tempoMs = Date.now() - startTime;
      return {
        response: {
          intent: 'SOLICITACAO_CONTATO',
          confidence: 0.95,
          summary: 'Cliente de renovação detectado - escalar direto para humano',
          acao: 'ESCALAR_HUMANO',
          deve_responder: true,
          resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe que cuida da sua conta pra agilizar esse processo de renovação. Já já alguém te chama! 👍',
          novo_estado_funil: 'FECHAMENTO',
        },
        tokensUsados: 0,
        tempoMs,
        modeloUsado: 'rule-based-renovation',
      };
    }
  }

  // FASE 6: Detectar relacionamento CLIENTE_IR e tratar como renovação
  if (pessoaContext?.relacionamentos) {
    const isClienteIR = pessoaContext.relacionamentos.some(r => r.tipo_relacao === 'CLIENTE_IR' && r.empresa === empresa);
    if (isClienteIR && conversationState?.estado_funil === 'SAUDACAO') {
      console.log('[FASE6] Cliente IR existente detectado, escalando para humano');
      const tempoMs = Date.now() - startTime;
      return {
        response: {
          intent: 'SOLICITACAO_CONTATO',
          confidence: 0.90,
          summary: 'Cliente existente (CLIENTE_IR) - escalar para atendimento',
          acao: 'ESCALAR_HUMANO',
          deve_responder: true,
          resposta_sugerida: 'Vi que você já é nosso cliente! Vou te conectar com a equipe que cuida da sua conta. Já já alguém te chama! 👍',
          novo_estado_funil: 'FECHAMENTO',
        },
        tokensUsados: 0,
        tempoMs,
        modeloUsado: 'rule-based-existing-client',
      };
    }
  }

  // PATCH 6G + 9: Calcular próxima pergunta baseado no estado atual + detectar urgência
  // No modo PASSIVE_CHAT, ainda detectamos urgência mas sem lógica de cadência
  const qualiState: ConversationQualiState & { _triageContext?: string | null } = {
    empresa,
    estadoFunil: conversationState?.estado_funil || 'SAUDACAO',
    spin: normalizeFrameworkKeys(conversationState?.framework_data).spin,
    gpct: normalizeFrameworkKeys(conversationState?.framework_data).gpct,
    bant: normalizeFrameworkKeys(conversationState?.framework_data).bant,
    temperatura: classificacao?.temperatura || 'FRIO',
    intentAtual: undefined,
    _triageContext: triageSummary?.resumoTriagem || triageSummary?.historico || null,
  };
  
  // PATCH 10: Passa mensagem, histórico e framework para detectar lead pronto
  const proximaPergunta = decidirProximaPergunta(
    qualiState, 
    mensagem, 
    historico,
    conversationState?.framework_data
  );
  console.log('[PATCH10] Próxima pergunta decidida:', {
    tipo: proximaPergunta.tipo,
    urgenciaDetectada: proximaPergunta.urgencia?.detectado || false,
    urgenciaTipo: proximaPergunta.urgencia?.tipo || null,
    usarBloco: proximaPergunta.usarBloco || false,
    leadProntoSinais: proximaPergunta.leadPronto?.totalSinais || 0,
    fraseGatilho: proximaPergunta.urgencia?.frase_gatilho || null,
    isPassiveChat,
  });

  // Montar contexto enriquecido
  let userPrompt = `EMPRESA_CONTEXTO: ${empresa}\n`;
  userPrompt += `PERSONA: Amélia (consultora unificada do Grupo Blue)\n`;
  userPrompt += `MODO: ${isPassiveChat ? 'ATENDENTE PASSIVA (Blue Chat)' : 'QUALIFICAÇÃO ATIVA'}\n`;
  userPrompt += `ÁREA PRINCIPAL DA CONVERSA: ${empresa === 'TOKENIZA' ? 'Investimentos Tokenizados' : 'IR Cripto'}\n`;
  
  if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
  if (cadenciaNome && !isPassiveChat) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;

  // ========================================
  // CONTEXTO DE TRIAGEM (RESUMO DA MARIA)
  // ========================================
  if (triageSummary && isPassiveChat) {
    userPrompt += `\n## 📋 CONTEXTO DA TRIAGEM ANTERIOR\n`;
    userPrompt += `Este lead foi transferido pela triagem (MarIA) para o setor comercial.\n`;
    userPrompt += `Você deve CONTINUAR a conversa dentro deste contexto, sem se reapresentar do zero.\n\n`;
    
    if (triageSummary.clienteNome) {
      userPrompt += `NOME DO CLIENTE: ${triageSummary.clienteNome}\n`;
    }
    if (triageSummary.email) {
      userPrompt += `EMAIL FORNECIDO: ${triageSummary.email}\n`;
    }
    
    if (triageSummary.resumoTriagem) {
      userPrompt += `\nRESUMO DA CONVERSA COM TRIAGEM:\n${triageSummary.resumoTriagem}\n`;
    }
    
    if (triageSummary.historico) {
      userPrompt += `\nHISTÓRICO DA CONVERSA COM TRIAGEM:\n${triageSummary.historico}\n`;
    }
    
    userPrompt += `\n⚠️ INSTRUÇÕES PARA INICIAR ATENDIMENTO:\n`;
    userPrompt += `- NÃO pergunte o nome nem email (já foram fornecidos pela triagem)\n`;
    userPrompt += `- NÃO repita informações que a MarIA já deu ao cliente\n`;
    userPrompt += `- Inicie de forma natural, referenciando o que o cliente já demonstrou interesse\n`;
    userPrompt += `- Apresente-se brevemente como Amélia e entre direto no assunto\n`;
    userPrompt += `- Sua primeira mensagem deve mostrar que você JÁ SABE o contexto\n`;
    userPrompt += `- Exemplo: "Oi {{nome}}! Sou a Amélia, do comercial. Vi que você quer conhecer nossas ofertas de investimento. Posso te ajudar com isso!"\n`;
  }
  
  // PATCH 9/10: Instrução especial se escalação imediata ou lead pronto
  if (proximaPergunta.tipo === 'ESCALAR_IMEDIATO' && proximaPergunta.urgencia) {
    userPrompt += `\n## 🚨 ESCALAÇÃO IMEDIATA DETECTADA\n`;
    userPrompt += `TIPO DE URGÊNCIA: ${proximaPergunta.urgencia.tipo}\n`;
    userPrompt += `GATILHO DETECTADO: "${proximaPergunta.urgencia.frase_gatilho}"\n`;
    userPrompt += `CONFIANÇA: ${proximaPergunta.urgencia.confianca}\n`;
    userPrompt += `\n⚠️ AÇÃO OBRIGATÓRIA: Responda com empatia, confirme interesse e ESCALE para humano.\n`;
    userPrompt += `⚠️ SUA AÇÃO DEVE SER: ESCALAR_HUMANO\n`;
    userPrompt += `⚠️ NÃO FAÇA perguntas de qualificação. O lead quer ação AGORA.\n`;
  } else if (proximaPergunta.leadPronto && proximaPergunta.leadPronto.totalSinais >= 3) {
    // PATCH 10: Lead pronto para escalar
    userPrompt += `\n## ✅ LEAD PRONTO PARA ESCALAR (PATCH 10)\n`;
    userPrompt += `SINAIS DETECTADOS: ${proximaPergunta.leadPronto.totalSinais}\n`;
    userPrompt += `- Consciência: ${proximaPergunta.leadPronto.conscienciaTotalPresente ? '✅' : '❌'}\n`;
    userPrompt += `- Abertura: ${proximaPergunta.leadPronto.aberturaExplicita ? '✅' : '❌'}\n`;
    userPrompt += `- Volume conhecido: ${proximaPergunta.leadPronto.volumeTempoConhecido ? '✅' : '❌'}\n`;
    userPrompt += `- Perguntou preço: ${proximaPergunta.leadPronto.perguntaPreco ? '✅' : '❌'}\n`;
    userPrompt += `- Reconheceu plano: ${proximaPergunta.leadPronto.reconheceuPlano ? '✅' : '❌'}\n`;
    userPrompt += `\n⚠️ AÇÃO: Confirme interesse, recomende plano se ainda não fez, e ESCALE para vendedor.\n`;
    userPrompt += `⚠️ NÃO CONTINUE qualificando. O lead está pronto!\n`;
  } else if (proximaPergunta.usarBloco) {
    // PATCH 10: Modo bloco de 3 perguntas
    userPrompt += `\n## 🔷 MODO BLOCO ATIVADO (PATCH 10)\n`;
    userPrompt += `INSTRUÇÃO: ${proximaPergunta.instrucao}\n`;
    userPrompt += `\n⚠️ Faça as 3 PERGUNTAS DE UMA VEZ conforme instrução acima.\n`;
    userPrompt += `⚠️ Após resposta completa: RECOMENDE PLANO e ESCALE se houver interesse.\n`;
  } else {
    // Fluxo normal
    userPrompt += `\n## ⚡ INSTRUÇÃO DE PRÓXIMA PERGUNTA (SIGA OBRIGATORIAMENTE)\n`;
    userPrompt += `TIPO: ${proximaPergunta.tipo}\n`;
    userPrompt += `INSTRUÇÃO: ${proximaPergunta.instrucao}\n`;
    userPrompt += `\n⚠️ Sua resposta DEVE incluir uma pergunta seguindo esta instrução, a menos que seja NENHUMA.\n`;
    userPrompt += `⚠️ NUNCA use "me conta" - vá direto à pergunta.\n`;
  }
  
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
      const fd = normalizeFrameworkKeys(conversationState.framework_data);
      
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
      userPrompt += `⚠️ NÃO cumprimente novamente. O lead já conhece você.\n`;
    }
  }
  
  // ========================================
  // PATCH 6+: REGRAS DE CANAL E PERFIL INVESTIDOR
  // ========================================
  
  // Detectar canal da mensagem (por enquanto, assumindo WhatsApp para inbound)
  const canalAtivo: CanalConversa = (conversationState?.canal as CanalConversa) || 'WHATSAPP';
  
  // Inferir perfil investidor
  let perfilInvestidor: PerfilInvestidor = conversationState?.perfil_investidor || null;
  if (!perfilInvestidor) {
    perfilInvestidor = inferirPerfilInvestidor(conversationState?.perfil_disc, mensagem);
    if (perfilInvestidor) {
      console.log('[6+] Perfil investidor inferido:', perfilInvestidor);
    }
  }
  
  // Adicionar regras de canal ao prompt
  userPrompt += `\n## 📱 CANAL ATIVO: ${canalAtivo}\n`;
  userPrompt += CHANNEL_RULES[canalAtivo];
  
  // Adicionar exemplos por perfil investidor
  if (perfilInvestidor) {
    userPrompt += formatInvestorProfileExamples(empresa, perfilInvestidor, canalAtivo);
  }
  
  // ========================================
  // PATCH 6+: REGRAS DE MEMÓRIA CONVERSACIONAL
  // ========================================
  
  if (historico.length > 0) {
    userPrompt += `
## 🧠 REGRAS DE MEMÓRIA CONVERSACIONAL (OBRIGATÓRIO)

O AGENTE NUNCA DEVE:
❌ Repetir perguntas já respondidas (veja "DADOS JÁ COLETADOS")
❌ Voltar para "Oi, tudo bem?" se já houve interação
❌ Ignorar informações coletadas (SPIN / GPCT)
❌ Se reapresentar se o lead já sabe quem você é
❌ Fazer a mesma pergunta de formas diferentes

O AGENTE SEMPRE DEVE:
✅ Referenciar aprendizados anteriores na resposta
✅ Usar informações coletadas para formular próximas perguntas
✅ Evoluir o diálogo até pré-qualificação clara
✅ Reconhecer o que o lead disse antes de perguntar algo novo
`;
  }
  
  // Gerar histórico resumido para contexto
  if (historico.length > 3) {
    const outbounds = historico.filter(h => h.direcao === 'OUTBOUND').map(h => h.conteudo.substring(0, 100));
    const inbounds = historico.filter(h => h.direcao === 'INBOUND').map(h => h.conteudo.substring(0, 100));
    
    userPrompt += `\n## RESUMO DA CONVERSA ATÉ AGORA:\n`;
    userPrompt += `- Total de mensagens trocadas: ${historico.length}\n`;
    userPrompt += `- Últimas respostas do lead: ${inbounds.slice(0, 3).join(' | ')}\n`;
    userPrompt += `- Você já falou sobre: ${outbounds.slice(0, 2).join(' | ')}\n`;
  }
  
  // PATCH 8: Detectar interesse cross-company
  const crossInterest = detectCrossCompanyInterest(mensagem, empresa);
  if (crossInterest.detected) {
    console.log('[CROSS-SELLING]', {
      empresaOriginal: empresa,
      empresaAlvo: crossInterest.targetCompany,
      razao: crossInterest.reason,
    });
    userPrompt += CROSS_COMPANY_INSTRUCTIONS;
  }
  
  // PATCH 6G: Adicionar tabela de preços para BLUE
  if (empresa === 'BLUE') {
    userPrompt += formatBluePricingForPrompt();
    
    // PATCH 8: Se detectou interesse em Tokeniza, carregar ofertas também
    if (crossInterest.detected && crossInterest.targetCompany === 'TOKENIZA') {
      userPrompt += formatTokenizaKnowledgeForPrompt();
      console.log('[CROSS] Conhecimento Tokeniza adicionado para lead Blue');
      
      try {
        const ofertas = await fetchActiveTokenizaOffers();
        userPrompt += formatTokenizaOffersForPrompt(ofertas);
        console.log('[CROSS] Ofertas Tokeniza carregadas para lead Blue:', ofertas.length);
      } catch (err) {
        console.error('[CROSS] Erro ao buscar ofertas Tokeniza:', err);
      }
    }
  }
  
  // PATCH 7: Adicionar conhecimento base Tokeniza + ofertas ativas
  if (empresa === 'TOKENIZA') {
    // Conhecimento base (sempre disponível)
    userPrompt += formatTokenizaKnowledgeForPrompt();
    console.log('[7] Conhecimento Tokeniza adicionado ao prompt');
    
    // Ofertas ativas (dinâmico)
    try {
      const ofertas = await fetchActiveTokenizaOffers();
      userPrompt += formatTokenizaOffersForPrompt(ofertas);
      console.log('[7] Ofertas Tokeniza carregadas:', ofertas.length);
    } catch (err) {
      console.error('[7] Erro ao buscar ofertas Tokeniza:', err);
      userPrompt += `\n## OFERTAS TOKENIZA\nNão foi possível carregar ofertas no momento. Foque na qualificação.\n`;
    }
    
    // PATCH 8: Se detectou interesse em Blue, carregar preços também
    if (crossInterest.detected && crossInterest.targetCompany === 'BLUE') {
      userPrompt += formatBluePricingForPrompt();
      console.log('[CROSS] Preços Blue adicionados para lead Tokeniza');
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
  
  // Contexto de classificação (skip em modo passivo - não usa ICP/classificação)
  if (classificacao && !isPassiveChat) {
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

  // ========================================
  // SISTEMA DE FALLBACK DE MODELOS IA
  // Lê configuração de prioridade do banco (system_settings)
  // ========================================
  
  type ModelProvider = 'ANTHROPIC' | 'GEMINI' | 'GPT';
  
  interface AICallResult {
    success: boolean;
    content?: string;
    tokensUsados?: number;
    provider?: ModelProvider;
    error?: string;
  }
  
  interface ModelPriorityConfig {
    ordem: ModelProvider[];
    modelos: Record<ModelProvider, string>;
    desabilitados: ModelProvider[];
  }
  
  // Buscar configuração de prioridade do banco
  async function getModelPriority(): Promise<ModelPriorityConfig> {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('category', 'ia')
      .eq('key', 'model_priority')
      .maybeSingle();
    
    if (data?.value) {
      const config = data.value as any;
      return {
        ordem: config.ordem || ['ANTHROPIC', 'GEMINI', 'GPT'],
        modelos: config.modelos || {
          ANTHROPIC: 'claude-sonnet-4-20250514',
          GEMINI: 'google/gemini-2.5-flash',
          GPT: 'openai/gpt-5-mini'
        },
        desabilitados: config.desabilitados || []
      };
    }
    
    // Default se não configurado
    return {
      ordem: ['ANTHROPIC', 'GEMINI', 'GPT'],
      modelos: {
        ANTHROPIC: 'claude-sonnet-4-20250514',
        GEMINI: 'google/gemini-2.5-flash',
        GPT: 'openai/gpt-5-mini'
      },
      desabilitados: []
    };
  }
  
  // ========================================
  // RETRY COM BACKOFF EXPONENCIAL
  // ========================================
  const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
  const NON_RETRYABLE_STATUSES = [401, 402, 403];

  async function withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    maxRetries = 2,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        // Check if error has a status that's non-retryable
        const errMsg = String(err);
        const isNonRetryable = NON_RETRYABLE_STATUSES.some(s => errMsg.includes(String(s)));
        if (isNonRetryable || attempt === maxRetries) {
          throw err;
        }
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[Retry] ${label} tentativa ${attempt + 1}/${maxRetries + 1} falhou, aguardando ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async function tryAnthropic(systemPrompt: string, userPrompt: string, model: string): Promise<AICallResult> {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return { success: false, error: 'ANTHROPIC_API_KEY não configurada' };
    }
    
    try {
      console.log(`[IA] Tentando Anthropic ${model}...`);
      
      const makeCall = async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1500,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        
        if (!response.ok) {
          const errText = await response.text();
          // Throw for retryable, return error for non-retryable
          if (RETRYABLE_STATUSES.includes(response.status)) {
            throw new Error(`Anthropic ${response.status}: ${errText}`);
          }
          return { success: false as const, error: `Anthropic ${response.status}: ${errText}` };
        }
        
        const data = await response.json();
        const content = data.content?.[0]?.text;
        const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        
        if (!content) {
          return { success: false as const, error: 'Resposta vazia do Anthropic' };
        }
        
        console.log('[IA] ✅ Anthropic respondeu:', { tokens, contentPreview: content.substring(0, 100) });
        return { success: true as const, content, tokensUsados: tokens, provider: 'ANTHROPIC' as ModelProvider };
      };
      
      return await withRetry(makeCall, 'Anthropic');
    } catch (err) {
      console.error('[IA] Erro Anthropic (após retries):', err);
      return { success: false, error: String(err) };
    }
  }
  
  async function tryGoogleDirect(systemPrompt: string, userPrompt: string, model: string): Promise<AICallResult> {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      return { success: false, error: 'GOOGLE_API_KEY não configurada' };
    }
    
    try {
      // Extrair nome do modelo sem prefixo "google/"
      const modelName = model.startsWith('google/') ? model.replace('google/', '') : model;
      console.log(`[IA] Tentando Google Direct ${modelName}...`);
      
      const makeCall = async () => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1500,
            },
          }),
        });
        
        if (!response.ok) {
          const errText = await response.text();
          if (RETRYABLE_STATUSES.includes(response.status)) {
            throw new Error(`Google Direct ${response.status}: ${errText}`);
          }
          return { success: false as const, error: `Google Direct ${response.status}: ${errText}` };
        }
        
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const tokens = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);
        
        if (!content) {
          return { success: false as const, error: 'Resposta vazia do Google Direct' };
        }
        
        console.log('[IA] ✅ Google Direct respondeu:', { tokens, contentPreview: content.substring(0, 100) });
        return { success: true as const, content, tokensUsados: tokens, provider: 'GEMINI' as ModelProvider };
      };
      
      return await withRetry(makeCall, 'Google Direct');
    } catch (err) {
      console.error('[IA] Erro Google Direct (após retries):', err);
      return { success: false, error: String(err) };
    }
  }

  async function tryLovableAI(systemPrompt: string, userPrompt: string, model: string, provider: ModelProvider): Promise<AICallResult> {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return { success: false, error: 'LOVABLE_API_KEY não configurada' };
    }
    
    try {
      console.log(`[IA] Tentando ${provider} (${model}) via Lovable AI...`);
      
      const makeCall = async () => {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
          }),
        });
        
        if (!response.ok) {
          const errText = await response.text();
          
          if (RETRYABLE_STATUSES.includes(response.status)) {
            throw new Error(`${provider} ${response.status}: ${errText}`);
          }
          
          // Non-retryable errors
          if (response.status === 429) {
            return { success: false as const, error: 'Rate limit Lovable AI excedido' };
          }
          if (response.status === 402) {
            return { success: false as const, error: 'Créditos Lovable AI insuficientes' };
          }
          
          return { success: false as const, error: `${provider} ${response.status}: ${errText}` };
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
        
        if (!content) {
          return { success: false as const, error: `Resposta vazia do ${provider}` };
        }
        
        console.log(`[IA] ✅ ${provider} respondeu:`, { tokens, contentPreview: content.substring(0, 100) });
        return { success: true as const, content, tokensUsados: tokens, provider };
      };
      
      return await withRetry(makeCall, provider);
    } catch (err) {
      console.error(`[IA] Erro ${provider} (após retries):`, err);
      return { success: false, error: String(err) };
    }
  }
  
  // Buscar configuração de prioridade de modelos do banco
  const modelPriority = await getModelPriority();
  console.log('[IA] Configuração de modelos carregada:', {
    ordem: modelPriority.ordem,
    desabilitados: modelPriority.desabilitados
  });
  
  // Executar em ordem configurada (excluindo desabilitados)
  let aiResult: AICallResult = { success: false, error: 'Nenhum provedor disponível' };
  
  for (const providerId of modelPriority.ordem) {
    if (modelPriority.desabilitados.includes(providerId)) {
      console.log(`[IA] ⏭️ ${providerId} desabilitado, pulando...`);
      continue;
    }
    
    const model = modelPriority.modelos[providerId];
    
    switch (providerId) {
      case 'ANTHROPIC':
        aiResult = await tryAnthropic(activeSystemPrompt, userPrompt, model);
        break;
      case 'GEMINI': {
        // Tentar Google Direct primeiro se GOOGLE_API_KEY configurada
        const googleKey = Deno.env.get('GOOGLE_API_KEY');
        if (googleKey) {
          aiResult = await tryGoogleDirect(activeSystemPrompt, userPrompt, model);
          if (aiResult.success) break;
          console.log('[IA] Google Direct falhou, tentando Lovable AI Gateway...');
        }
        aiResult = await tryLovableAI(activeSystemPrompt, userPrompt, model, providerId);
        break;
      }
      case 'GPT':
        aiResult = await tryLovableAI(activeSystemPrompt, userPrompt, model, providerId);
        break;
    }
    
    if (aiResult.success) break;
    console.log(`[IA] ⚠️ ${providerId} falhou, tentando próximo...`);
  }
  
  // Se todos falharam, lançar erro
  if (!aiResult.success) {
    console.error('[IA] ❌ Todos os modelos falharam:', aiResult.error);
    throw new Error(`Todos os modelos de IA falharam. Último erro: ${aiResult.error}`);
  }
  
  const content = aiResult.content!;
  const tokensUsados = aiResult.tokensUsados || 0;
  const tempoMs = Date.now() - startTime;
  
  console.log(`[IA] Resposta final (${aiResult.provider}):`, { 
    provider: aiResult.provider,
    tokensTotal: tokensUsados, 
    tempoMs, 
    content: content.substring(0, 300) 
  });

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
    'NENHUMA', 'ESCALAR_HUMANO', 'ENVIAR_RESPOSTA_AUTOMATICA', 'DESQUALIFICAR_LEAD'
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

  // Usar modelo real da configuração
  const modeloUsado = modelPriority.modelos[aiResult.provider!] || 'unknown';

  return { response: parsed, tokensUsados, tempoMs, modeloUsado };
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
          
          console.log('[Ação] Escalado para humano (com cadência):', leadId);
          return true;
        } else {
          // PATCH ANTI-LIMBO: Modo passivo (Blue Chat) - runId é null
          // Registrar escalação mesmo sem cadência vinculada
          console.log('[Ação] Escalado para humano (modo passivo, sem cadência):', leadId);
          return true;
        }
        break;

      // FASE 3: DESQUALIFICAR_LEAD - Marca lead como frio e encerra
      case 'DESQUALIFICAR_LEAD':
        if (leadId) {
          const now = new Date().toISOString();
          
          // Marcar temperatura como FRIO
          await supabase
            .from('lead_classifications')
            .update({ temperatura: 'FRIO', updated_at: now })
            .eq('lead_id', leadId)
            .eq('empresa', empresa);
          
          // Cancelar cadências ativas
          const { data: activeRunsDQ } = await supabase
            .from('lead_cadence_runs')
            .select('id')
            .eq('lead_id', leadId)
            .in('status', ['ATIVA', 'PAUSADA']);
          
          if (activeRunsDQ && activeRunsDQ.length > 0) {
            const runIdsDQ = activeRunsDQ.map((r: any) => r.id);
            await supabase
              .from('lead_cadence_runs')
              .update({ status: 'CANCELADA', updated_at: now })
              .in('id', runIdsDQ);
          }
          
          console.log('[Ação] Lead desqualificado:', leadId);
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
  respostaTexto: string | null,
  modeloUsado: string = 'unknown'
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
    modelo_ia: modeloUsado,
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
    const body = await req.json();
    
    // MODO DE TESTE: Para testar detecção de urgência sem API
    if (body.testMode === 'urgencia') {
      const mensagens = body.mensagens || [
        'quero contratar',
        'como pago?',
        'preciso resolver urgente',
        'já tentei outro serviço e não funcionou',
        'quero falar com alguém humano',
        'vamos fechar',
        'estou em malha fina',
        'qual o prazo?',
        'obrigado pela informação',
        'oi, tudo bem?',
      ];
      
      const resultados = mensagens.map((msg: string) => {
        const deteccao = detectarLeadQuenteImediato(msg);
        return {
          mensagem: msg,
          ...deteccao,
          deveEscalar: deteccao.detectado && (deteccao.confianca === 'ALTA' || deteccao.confianca === 'MEDIA'),
        };
      });
      
      console.log('[TEST] Detecção de urgência testada:', resultados.length, 'mensagens');
      
      return new Response(
        JSON.stringify({ 
          testMode: 'urgencia',
          total: resultados.length,
          detectados: resultados.filter((r: { detectado: boolean }) => r.detectado).length,
          escalarImediato: resultados.filter((r: { deveEscalar: boolean }) => r.deveEscalar).length,
          resultados,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { messageId, source, mode, triageSummary } = body as InterpretRequest;

    if (source) {
      console.log('[SDR-IA] Source da mensagem:', source, 'Mode:', mode || 'DEFAULT');
    }

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

    // PATCH 3: Check MANUAL mode — skip AI response generation but still log intent
    const modoAtendimento = (conversationState as any)?.modo || 'SDR_IA';
    if (modoAtendimento === 'MANUAL') {
      console.log('[SDR-IA] 🚫 Modo MANUAL — registrando intent sem gerar resposta automática');
      
      // Still interpret for intent logging purposes, but force no response
      const { response: aiResponse, tokensUsados, tempoMs, modeloUsado } = await interpretWithAI(
        message.conteudo,
        message.empresa,
        historico,
        leadNome,
        cadenciaNome,
        classificacao,
        conversationState,
        pessoaContext,
        source
      );

      // Override: never respond in MANUAL mode
      aiResponse.deve_responder = false;
      aiResponse.acao = 'NENHUMA';

      const intentId = await saveInterpretation(
        supabase,
        message,
        aiResponse,
        tokensUsados,
        tempoMs,
        false,
        false,
        null,
        modeloUsado
      );

      return new Response(
        JSON.stringify({
          success: true,
          intentId,
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          acao: 'NENHUMA',
          acaoAplicada: false,
          respostaEnviada: false,
          responseText: null,
          modoManual: true,
          message: 'Modo MANUAL ativo — resposta automática suprimida',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Interpretar com IA
    const { response: aiResponse, tokensUsados, tempoMs, modeloUsado } = await interpretWithAI(
      message.conteudo,
      message.empresa,
      historico,
      leadNome,
      cadenciaNome,
      classificacao,
      pessoaContext,
      conversationState,
      mode,
      triageSummary
    );

    console.log('[SDR-IA] Interpretação:', {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      deve_responder: aiResponse.deve_responder,
      tem_resposta_sugerida: !!aiResponse.resposta_sugerida,
      resposta_preview: aiResponse.resposta_sugerida?.substring(0, 80) || null,
      novo_estado_funil: aiResponse.novo_estado_funil,
      disc_estimado: aiResponse.disc_estimado,
      ultima_pergunta: aiResponse.ultima_pergunta_id,
      source,
      telefone: telefone ? 'SIM' : 'NAO',
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

    // 5. Enviar resposta automática (com sanitização anti-robô)
    let respostaEnviada = false;
    let respostaTexto: string | null = null;

    // PATCH ANTI-LIMBO: Para BLUECHAT + NAO_ENTENDI, forçar resposta contextual
    if (source === 'BLUECHAT' && aiResponse.intent === 'NAO_ENTENDI') {
      const hasContext = historico.length >= 2;
      if (!hasContext) {
        // Sem contexto prévio: perguntar o que o lead precisa
        console.log('[SDR-IA] 🔄 NAO_ENTENDI sem contexto → forçando pergunta de contexto');
        aiResponse.deve_responder = true;
        aiResponse.resposta_sugerida = aiResponse.resposta_sugerida || 
          'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        aiResponse.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
      } else {
        // Com contexto prévio: escalar para humano com mensagem de transição
        console.log('[SDR-IA] 🔄 NAO_ENTENDI com contexto → escalando para humano');
        aiResponse.deve_responder = true;
        aiResponse.resposta_sugerida = aiResponse.resposta_sugerida ||
          'Hmm, deixa eu pedir ajuda de alguém da equipe pra te atender melhor. Já já entram em contato!';
        aiResponse.acao = 'ESCALAR_HUMANO';
      }
    }

    // PATCH ANTI-LIMBO: Para BLUECHAT + ESCALAR_HUMANO sem resposta, forçar mensagem de transição
    if (source === 'BLUECHAT' && aiResponse.acao === 'ESCALAR_HUMANO' && !aiResponse.resposta_sugerida) {
      console.log('[SDR-IA] 🔄 ESCALAR_HUMANO sem resposta → forçando mensagem de transição');
      aiResponse.deve_responder = true;
      aiResponse.resposta_sugerida = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
    }

    // PATCH: Para BLUECHAT, telefone NÃO é obrigatório (resposta retorna via HTTP, não WhatsApp)
    const canRespond = source === 'BLUECHAT'
      ? (aiResponse.deve_responder && aiResponse.resposta_sugerida && aiResponse.intent !== 'OPT_OUT')
      : (aiResponse.deve_responder && aiResponse.resposta_sugerida && telefone && aiResponse.intent !== 'OPT_OUT');

    // PATCH: Para BLUECHAT com triagem, forçar resposta se IA não gerou
    // Mensagens [NOVO ATENDIMENTO] são resumos de triagem - Amélia DEVE responder
    if (source === 'BLUECHAT' && !canRespond && triageSummary && aiResponse.resposta_sugerida) {
      console.log('[SDR-IA] 📋 Triagem detectada mas deve_responder=false, forçando resposta para BLUECHAT');
      aiResponse.deve_responder = true;
    }

    const shouldRespond = source === 'BLUECHAT'
      ? (aiResponse.deve_responder && aiResponse.resposta_sugerida && aiResponse.intent !== 'OPT_OUT')
      : (aiResponse.deve_responder && aiResponse.resposta_sugerida && telefone && aiResponse.intent !== 'OPT_OUT');

    if (shouldRespond) {
      let respostaOriginal = aiResponse.resposta_sugerida;
      const isRobotic = detectRoboticPattern(respostaOriginal, leadNome);
      
      // Aplicar sanitização se detectado padrão robótico
      if (isRobotic) {
        respostaTexto = sanitizeRoboticResponse(respostaOriginal, leadNome);
        console.log('[SDR-IA] 🤖 Resposta robótica detectada, sanitizando:', {
          original: respostaOriginal.substring(0, 60) + '...',
          sanitized: respostaTexto.substring(0, 60) + '...',
          leadNome,
        });
      } else {
        respostaTexto = respostaOriginal;
      }
      
      // Verificar se resposta ainda é válida após sanitização
      if (!respostaTexto || respostaTexto.length < 10) {
        console.log('[SDR-IA] ⚠️ Resposta muito curta após sanitização, escalando para humano');
        aiResponse.deve_responder = false;
        aiResponse.acao = 'ESCALAR_HUMANO';
        respostaTexto = null;
      } else if (source === 'BLUECHAT') {
        // PATCH: Quando a origem é BLUECHAT, NÃO enviar via whatsapp-send
        // A resposta será retornada ao bluechat-inbound que entrega ao Blue Chat
        console.log('[SDR-IA] 📱 Source=BLUECHAT — pulando envio via whatsapp-send, resposta será retornada ao Blue Chat');
        respostaEnviada = false; // Não enviada via Mensageria, mas texto está disponível
      } else {
        const sendResult = await sendAutoResponse(
          supabase,
          telefone,
          message.empresa,
          respostaTexto,
          message.lead_id,
          message.run_id
        );
        
        respostaEnviada = sendResult.success;
        console.log('[SDR-IA] Resposta automática:', { 
          enviada: respostaEnviada,
          wasRobotic: isRobotic,
        });
      }
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
      respostaTexto,
      modeloUsado
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
      
      // Validar e mapear estado de funil (IA pode retornar estados inválidos)
      if (aiResponse.novo_estado_funil) {
        const validEstadosFunil: EstadoFunil[] = [
          'SAUDACAO', 'DIAGNOSTICO', 'QUALIFICACAO', 'OBJECOES', 'FECHAMENTO', 'POS_VENDA'
        ];
        
        let estadoFinal: EstadoFunil | null = null;
        const estadoSugerido = aiResponse.novo_estado_funil.toUpperCase();
        
        // Mapear estados inválidos comuns para estados válidos
        if (validEstadosFunil.includes(estadoSugerido as EstadoFunil)) {
          estadoFinal = estadoSugerido as EstadoFunil;
        } else if (['TRANSFERIDO', 'TRANSFERIDO_CLOSER', 'ESCALACAO_HUMANA', 'HANDOFF'].some(s => estadoSugerido.includes(s))) {
          // Quando escala para humano/closer, mover para FECHAMENTO
          estadoFinal = 'FECHAMENTO';
          console.log('[ConversationState] Estado inválido mapeado:', { original: estadoSugerido, mapeado: 'FECHAMENTO' });
        } else {
          // Estado desconhecido - manter estado atual (não atualizar)
          console.warn('[ConversationState] Estado inválido ignorado:', estadoSugerido);
        }
        
        if (estadoFinal) {
          stateUpdates.estado_funil = estadoFinal;
        }
      }
      
      if (aiResponse.frameworks_atualizados) {
        // Normalizar AMBOS os lados: dados existentes E resposta da IA
        const existingData = normalizeFrameworkKeys(conversationState?.framework_data || {});
        const newData = normalizeFrameworkKeys(aiResponse.frameworks_atualizados);
        stateUpdates.framework_data = {
          gpct: { ...(existingData.gpct || {}), ...(newData.gpct || {}) },
          bant: { ...(existingData.bant || {}), ...(newData.bant || {}) },
          spin: { ...(existingData.spin || {}), ...(newData.spin || {}) },
        };
      }
      
      // Só atualiza DISC se não existir um perfil anterior (evita sobrescrita)
      if (aiResponse.disc_estimado && !conversationState?.perfil_disc) {
        const validDisc: PerfilDISC[] = ['D', 'I', 'S', 'C'];
        if (validDisc.includes(aiResponse.disc_estimado)) {
          stateUpdates.perfil_disc = aiResponse.disc_estimado;
          console.log('[DISC] Novo perfil detectado pela IA:', aiResponse.disc_estimado);
        } else {
          console.warn('[DISC] Valor inválido retornado pela IA, ignorando:', aiResponse.disc_estimado);
        }
      } else if (aiResponse.disc_estimado && conversationState?.perfil_disc) {
        console.log('[DISC] Perfil já existe, mantendo:', conversationState.perfil_disc, '(IA sugeriu:', aiResponse.disc_estimado, ')');
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

    // Determinar se precisa escalar para humano
    const needsEscalation = aiResponse.acao === 'ESCALAR_HUMANO' || aiResponse.acao === 'CRIAR_TAREFA_CLOSER';
    const escalationReason = needsEscalation 
      ? (aiResponse.acao === 'CRIAR_TAREFA_CLOSER' ? 'Lead qualificado para closer' : 'Situação requer atenção humana')
      : undefined;
    const escalationPriority = needsEscalation
      ? (aiResponse.acao === 'CRIAR_TAREFA_CLOSER' ? 'HIGH' : 'MEDIUM')
      : undefined;

    // Determinar departamento destino: usar valor da IA ou fallback "Comercial"
    const departamentoDestino = needsEscalation
      ? (aiResponse.departamento_destino || 'Comercial')
      : (aiResponse.departamento_destino || null);

    const result: InterpretResult = {
      success: true,
      intentId,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      acaoAplicada,
      respostaEnviada,
      responseText: respostaTexto,
      leadReady: aiResponse.acao === 'CRIAR_TAREFA_CLOSER',
      escalation: {
        needed: needsEscalation,
        reason: escalationReason,
        priority: escalationPriority,
      },
      departamento_destino: departamentoDestino,
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
