import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5G-C - SDR IA Engine Evoluído
// Interpretação + Resposta Automática + Compliance + Opt-Out
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
  // PATCH 6: Novos campos
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
  // PATCH 6: Novos campos de estado
  novo_estado_funil?: EstadoFunil;
  frameworks_atualizados?: FrameworkData;
  disc_estimado?: PerfilDISC;
  ultima_pergunta_id?: string;
}

// ========================================
// PATCH 6: FUNÇÕES DE ESTADO DE CONVERSA
// ========================================

/**
 * Carrega estado da conversa para o lead/empresa/canal
 * Cria estado inicial se não existir
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
 * Carrega contexto da pessoa global (multi-empresa)
 */
async function loadPessoaContext(
  supabase: SupabaseClient,
  pessoaId: string
): Promise<PessoaContext | null> {
  // 1. Buscar dados da pessoa
  const { data: pessoa, error: pessoaError } = await supabase
    .from('pessoas')
    .select('*')
    .eq('id', pessoaId)
    .single();
  
  if (pessoaError || !pessoa) {
    console.error('[PessoaContext] Pessoa não encontrada:', pessoaId);
    return null;
  }
  
  // 2. Buscar todos os lead_contacts vinculados
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
  
  // 3. Montar relacionamentos por empresa
  const relacionamentos: PessoaContext['relacionamentos'] = [];
  const empresas = [...new Set(contacts?.map(c => c.empresa) || [])];
  
  for (const emp of empresas) {
    const contactsEmpresa = contacts?.filter(c => c.empresa === emp) || [];
    
    // Determinar tipo de relação
    let tipo_relacao: PessoaRelacaoTipo = 'DESCONHECIDO';
    
    if (emp === 'BLUE') {
      const hasBlueClient = contactsEmpresa.some(c => c.blue_client_id);
      tipo_relacao = hasBlueClient ? 'CLIENTE_IR' : 'LEAD_IR';
    } else if (emp === 'TOKENIZA') {
      const hasInvestor = contactsEmpresa.some(c => c.tokeniza_investor_id);
      tipo_relacao = hasInvestor ? 'INVESTIDOR' : 'LEAD_INVESTIDOR';
    }
    
    // Buscar última interação
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
// PROMPT DO SDR IA COM COMPLIANCE + CONTEXTO
// ========================================

const SYSTEM_PROMPT = `Você é um SDR (Sales Development Representative) de IA especializado.
Sua função é interpretar mensagens de leads, identificar intenções, recomendar ações e, quando apropriado, sugerir uma resposta automática.

## EMPRESAS E PERSONAS

### TOKENIZA (Persona: Ana)
- Plataforma de investimentos em tokens (criptoativos, imóveis tokenizados)
- Tom: Amigável, didático, empolgado com inovação
- Foco: Educação financeira, diversificação, tokenização

### BLUE (Persona: Pedro)
- Serviços de declaração de imposto de renda para criptomoedas
- Tom: Profissional, confiável, técnico quando necessário
- Foco: Conformidade fiscal, elisão legal, economia tributária

## 🌐 REGRAS MULTI-EMPRESA (CRÍTICAS!)

O grupo possui duas empresas (TOKENIZA e BLUE) que compartilham base de pessoas.
Uma pessoa pode ter DIFERENTES relacionamentos com cada empresa.

### TIPOS DE RELACIONAMENTO POR EMPRESA:

**BLUE:**
- CLIENTE_IR: Já é cliente de declaração de IR (pagou pelo serviço)
- LEAD_IR: Ainda não é cliente, mas tem interesse potencial

**TOKENIZA:**
- INVESTIDOR: Já investiu em algum token
- LEAD_INVESTIDOR: Ainda não investiu, mas tem interesse potencial

**Genérico:**
- DESCONHECIDO: Sem histórico com a empresa

### REGRAS DE CONDUTA MULTI-EMPRESA:

1. **VOCÊ REPRESENTA APENAS UMA EMPRESA POR VEZ**
   - Se estiver como Ana (TOKENIZA): só fale de tokens/investimentos
   - Se estiver como Pedro (BLUE): só fale de IR/impostos
   - NUNCA misture marcas ou faça ofertas cruzadas

2. **USE O CONTEXTO PARA GERAR CONFIANÇA (sem vender)**
   - Se pessoa é CLIENTE_IR na Blue e você é Ana (TOKENIZA):
     ✅ "Que bom que você já faz parte do grupo e já resolve seu IR com a Blue!"
     ❌ "Quer contratar nosso serviço de IR também?"
   
   - Se pessoa é INVESTIDOR na Tokeniza e você é Pedro (BLUE):
     ✅ "Sei que você já conhece a Tokeniza e investe conosco no grupo!"
     ❌ "Quer investir em mais tokens?"

3. **NUNCA FAÇA CROSS-SELL EXPLÍCITO**
   - Você pode MENCIONAR que a pessoa já é cliente de outra empresa do grupo
   - Você NÃO pode OFERECER produtos/serviços da outra empresa
   - Se lead perguntar sobre a outra empresa, diga: "Para isso, fale com [Ana/Pedro] da [empresa]. Posso passar seu contato?"

### EXEMPLO: CENÁRIO ARTHUR COELHO (Blue + Tokeniza)

**Contexto:** Arthur é CLIENTE_IR da Blue e INVESTIDOR da Tokeniza.

**Se Ana (TOKENIZA) contata Arthur:**
- Pode dizer: "Arthur, que bom falar com você! Sei que você já faz parte da família Blue também, então já está com o IR em dia 😊"
- Pode fazer: Oferecer novas oportunidades de tokens, tirar dúvidas sobre investimentos
- NÃO pode: Oferecer serviços de IR, falar de preços da Blue, negociar renovação Blue

**Se Pedro (BLUE) contata Arthur:**
- Pode dizer: "Arthur, tudo bem? Como investidor do grupo, você já sabe da importância de manter tudo regularizado!"
- Pode fazer: Falar sobre renovação IR, oferecer análise tributária, esclarecer dúvidas fiscais
- NÃO pode: Oferecer tokens, fazer pitch de investimento, falar de rentabilidade

### MATRIZ DE ABORDAGEM POR CENÁRIO:

| Eu sou | Pessoa é na Blue | Pessoa é na Tokeniza | Abordagem |
|--------|------------------|----------------------|-----------|
| Ana | CLIENTE_IR | LEAD_INVESTIDOR | "Você já resolve IR conosco. Que tal conhecer nossos investimentos?" |
| Ana | CLIENTE_IR | INVESTIDOR | "Você já é parte da família completa! Tem novas oportunidades..." |
| Ana | LEAD_IR | qualquer | Foco apenas em tokens. Não mencionar IR |
| Pedro | qualquer | INVESTIDOR | "Como investidor, é importante ter o IR em dia!" |
| Pedro | qualquer | LEAD_INVESTIDOR | Foco apenas em IR. Não mencionar investimentos |
| Pedro | CLIENTE_IR | INVESTIDOR | "Ótimo ter você conosco nas duas frentes!" |

## PERFIS ICP (Use para contextualizar resposta)

### TOKENIZA ICPs:
- TOKENIZA_SERIAL: Investidor experiente, quer diversificar em tokens
- TOKENIZA_MEDIO_PRAZO: Busca rentabilidade 6-12 meses
- TOKENIZA_EMERGENTE: Primeiro investimento, educação importante
- TOKENIZA_ALTO_VOLUME_DIGITAL: Grandes volumes, análise técnica

### BLUE ICPs:
- BLUE_ALTO_TICKET_IR: Alto volume cripto, IR complexo
- BLUE_RECURRENTE: Cliente recorrente, renovação anual
- BLUE_PERDIDO_RECUPERAVEL: Ex-cliente a reconquistar

## PERSONAS (Perfil comportamental)
- CONSTRUTOR_PATRIMONIO: Foco longo prazo, segurança
- COLECIONADOR_DIGITAL: NFTs, entusiasta tech
- INICIANTE_CAUTELOSO: Conservador, precisa educação
- CRIPTO_CONTRIBUINTE_URGENTE: Urgência com IR
- CLIENTE_FIEL_RENOVADOR: Confiança estabelecida
- LEAD_PERDIDO_RECUPERAVEL: Precisa reengajamento

## PERFIL DISC (Adapte comunicação!)

Se o perfil DISC da pessoa for informado, adapte seu tom:

| DISC | Estilo | Como abordar |
|------|--------|--------------|
| D | Dominante | Direto, objetivo, foco em resultados. Sem rodeios. |
| I | Influente | Entusiástico, amigável, conte histórias de sucesso. |
| S | Estável | Paciente, acolhedor, gere confiança gradualmente. |
| C | Cauteloso | Dados, estrutura, documentação. Seja preciso. |

## TEMPERATURAS (Estado atual do lead)
- FRIO: Baixo engajamento, nutrição necessária
- MORNO: Algum interesse, manter contato
- QUENTE: Alta intenção, priorizar conversão

## INTENÇÕES POSSÍVEIS

INTENÇÕES DE ALTA CONVERSÃO:
- INTERESSE_COMPRA: Lead quer investir/comprar (TOKENIZA)
- INTERESSE_IR: Lead interessado em serviço de IR (BLUE)
- AGENDAMENTO_REUNIAO: Quer marcar uma reunião/call
- SOLICITACAO_CONTATO: Pede para alguém ligar

INTENÇÕES DE NUTRIÇÃO:
- DUVIDA_PRODUTO: Pergunta sobre como funciona
- DUVIDA_PRECO: Pergunta sobre valores, taxas, custos
- DUVIDA_TECNICA: Pergunta técnica específica

OBJEÇÕES:
- OBJECAO_PRECO: Acha caro, não compensa
- OBJECAO_RISCO: Medo de perda, desconfiança

INTENÇÕES NEGATIVAS:
- SEM_INTERESSE: Não quer, mas sem opt-out explícito
- OPT_OUT: Pedindo para não receber mais mensagens
- RECLAMACAO: Expressando insatisfação ou problema

INTENÇÕES NEUTRAS:
- CUMPRIMENTO: Apenas "oi", "olá", "bom dia"
- AGRADECIMENTO: Agradecendo por algo
- NAO_ENTENDI: Mensagem confusa
- FORA_CONTEXTO: Não relacionada aos serviços
- OUTRO: Não se encaixa

## AÇÕES POSSÍVEIS

- ENVIAR_RESPOSTA_AUTOMATICA: Responder automaticamente ao lead
- CRIAR_TAREFA_CLOSER: Criar tarefa para humano atuar
- PAUSAR_CADENCIA: Pausar sequência de mensagens
- CANCELAR_CADENCIA: Cancelar sequência definitivamente
- AJUSTAR_TEMPERATURA: Alterar temperatura do lead (indicar nova em acao_detalhes)
- MARCAR_OPT_OUT: Registrar que lead não quer mais contato
- ESCALAR_HUMANO: Situação complexa requer humano
- NENHUMA: Nenhuma ação necessária

## MATRIZ AUTOMÁTICA DE TEMPERATURA

Use acao = "AJUSTAR_TEMPERATURA" com acao_detalhes.nova_temperatura baseado em:

| Intenção | Temperatura Atual | Nova Temperatura |
|----------|-------------------|------------------|
| INTERESSE_COMPRA | qualquer | QUENTE |
| INTERESSE_IR | qualquer | QUENTE |
| AGENDAMENTO_REUNIAO | qualquer | QUENTE |
| SOLICITACAO_CONTATO | qualquer | QUENTE |
| DUVIDA_PRODUTO | FRIO | MORNO |
| DUVIDA_TECNICA | FRIO | MORNO |
| OPT_OUT | qualquer | FRIO |
| SEM_INTERESSE | QUENTE | MORNO |
| SEM_INTERESSE | MORNO | FRIO |
| OBJECAO_PRECO | qualquer | manter |
| OBJECAO_RISCO | qualquer | manter |

## REGRAS DE COMPLIANCE (CRÍTICAS!)

### PROIBIÇÕES ABSOLUTAS - NUNCA fazer:
1. ❌ NUNCA prometer retorno financeiro ou rentabilidade específica
2. ❌ NUNCA indicar ou recomendar ativo específico para investir
3. ❌ NUNCA inventar prazos ou metas de rentabilidade
4. ❌ NUNCA negociar preços ou oferecer descontos
5. ❌ NUNCA dar conselho de investimento personalizado
6. ❌ NUNCA pressionar ou usar urgência artificial
7. ❌ NUNCA fazer cross-sell explícito entre empresas do grupo

### PERMITIDO:
✅ Explicar conceitos gerais sobre tokenização/cripto
✅ Informar sobre processo de declaração de IR
✅ Convidar para conversar com especialista
✅ Tirar dúvidas procedimentais
✅ Agradecer e ser cordial
✅ Mencionar que pessoa já é cliente de outra empresa do grupo (para confiança)

## MATRIZ DE DECISÃO: QUANDO RESPONDER?

| Intenção | Confiança | Ação Principal | Responder? |
|----------|-----------|----------------|------------|
| INTERESSE_COMPRA | >0.7 | CRIAR_TAREFA_CLOSER | SIM |
| INTERESSE_IR | >0.7 | CRIAR_TAREFA_CLOSER | SIM |
| DUVIDA_PRODUTO | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| DUVIDA_PRECO | >0.6 | CRIAR_TAREFA_CLOSER | NÃO (humano negocia) |
| DUVIDA_TECNICA | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| CUMPRIMENTO | >0.8 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| AGRADECIMENTO | >0.8 | NENHUMA | SIM |
| OPT_OUT | >0.7 | MARCAR_OPT_OUT | NÃO |
| OBJECAO_PRECO | >0.6 | CRIAR_TAREFA_CLOSER | NÃO |
| OBJECAO_RISCO | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| SEM_INTERESSE | >0.7 | PAUSAR_CADENCIA | NÃO |
| RECLAMACAO | >0.6 | ESCALAR_HUMANO | NÃO |

## FORMATO DA RESPOSTA AUTOMÁTICA

Se deve_responder = true, forneça resposta_sugerida seguindo:
- 1 a 3 frases no máximo
- Tom humanizado (Ana/Pedro)
- Adapte linguagem ao perfil ICP/Persona do lead
- Adapte tom ao perfil DISC se disponível
- Se pessoa é cliente em outra empresa do grupo, mencione de forma natural
- Sempre terminar com próximo passo claro
- SEM promessas, SEM pressão, SEM cross-sell

### Exemplos TOKENIZA (Ana):

**Lead novo:**
"Que legal sua pergunta! A tokenização permite investir em frações de ativos. Posso te explicar mais ou você prefere falar com nosso especialista?"

**Lead que é CLIENTE_IR da Blue:**
"Oi [Nome]! Que bom falar com você. Sei que você já resolve seu IR com a Blue, então entende a importância de diversificar com segurança. Quer conhecer nossas oportunidades?"

### Exemplos BLUE (Pedro):

**Lead novo:**
"Boa pergunta! A declaração de cripto tem algumas particularidades. Posso te passar para nosso contador especialista."

**Lead que é INVESTIDOR da Tokeniza:**
"Oi [Nome]! Como investidor do grupo, você sabe a importância de manter tudo regularizado. Posso te ajudar com a declaração deste ano?"

## RESPOSTA OBRIGATÓRIA (JSON)

{
  "intent": "TIPO_INTENT",
  "confidence": 0.85,
  "summary": "Resumo do que o lead quer",
  "acao": "TIPO_ACAO",
  "acao_detalhes": { "nova_temperatura": "QUENTE" },
  "deve_responder": true,
  "resposta_sugerida": "Sua resposta aqui..." ou null,
  "novo_estado_funil": "DIAGNOSTICO",
  "frameworks_atualizados": { "gpct": { "g": "objetivo identificado" } },
  "disc_estimado": "D"
}`;

// ========================================
// MATRIZ DE TEMPERATURA AUTOMÁTICA
// ========================================

function computeNewTemperature(
  intent: LeadIntentTipo,
  temperaturaAtual: TemperaturaTipo
): TemperaturaTipo | null {
  // Intenções que sempre aquecem
  const intentQuentes: LeadIntentTipo[] = [
    'INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'
  ];
  
  if (intentQuentes.includes(intent)) {
    return temperaturaAtual !== 'QUENTE' ? 'QUENTE' : null;
  }

  // Intenções que esquentam de FRIO para MORNO
  const intentMornas: LeadIntentTipo[] = ['DUVIDA_PRODUTO', 'DUVIDA_TECNICA'];
  if (intentMornas.includes(intent) && temperaturaAtual === 'FRIO') {
    return 'MORNO';
  }

  // OPT_OUT sempre esfria
  if (intent === 'OPT_OUT') {
    return temperaturaAtual !== 'FRIO' ? 'FRIO' : null;
  }

  // SEM_INTERESSE diminui temperatura
  if (intent === 'SEM_INTERESSE') {
    if (temperaturaAtual === 'QUENTE') return 'MORNO';
    if (temperaturaAtual === 'MORNO') return 'FRIO';
  }

  return null; // Manter temperatura atual
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * PATCH 6: Carrega contexto completo com classificação, opt-out, pessoa e estado de conversa
 */
async function loadMessageContext(
  supabase: SupabaseClient,
  messageId: string
): Promise<MessageContext> {
  // Buscar mensagem principal
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

  // Se tiver lead_id, buscar histórico, contato, classificação, pessoa e estado
  if (msg.lead_id) {
    // Histórico de mensagens
    const { data: hist } = await supabase
      .from('lead_messages')
      .select('id, lead_id, run_id, empresa, conteudo, direcao, created_at')
      .eq('lead_id', msg.lead_id)
      .neq('id', messageId)
      .order('created_at', { ascending: false })
      .limit(5);

    historico = (hist || []) as LeadMessage[];

    // Buscar contato com campos opt_out, pipedrive_deal_id e pessoa_id
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
      
      // PATCH 6: Carregar contexto da pessoa global
      if (c.pessoa_id) {
        pessoaContext = await loadPessoaContext(supabase, c.pessoa_id);
        
        // Se temos pessoa com nome melhor, usar
        if (pessoaContext?.pessoa.nome && pessoaContext.pessoa.nome !== 'Desconhecido') {
          leadNome = pessoaContext.pessoa.nome;
        }
      }
    }

    // Buscar classificação mais recente
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

    // PATCH 6: Carregar estado da conversa
    conversationState = await loadConversationState(supabase, msg.lead_id, msg.empresa, 'WHATSAPP');
  }

  // Se tiver run_id, buscar nome da cadência
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
 * PATCH 6: Prompt enriquecido com pessoa global, estado de conversa e frameworks
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

  // Montar contexto enriquecido
  let userPrompt = `EMPRESA: ${empresa}\n`;
  userPrompt += `PERSONA SDR: ${empresa === 'TOKENIZA' ? 'Ana' : 'Pedro'}\n`;
  
  if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
  if (cadenciaNome) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;
  
  // PATCH 6: Contexto da pessoa global (multi-empresa)
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
    
    // Relacionamentos em outras empresas
    const outrasEmpresas = pessoaContext.relacionamentos.filter(r => r.empresa !== empresa);
    if (outrasEmpresas.length > 0) {
      userPrompt += `\n## RELACIONAMENTO EM OUTRAS EMPRESAS DO GRUPO\n`;
      for (const rel of outrasEmpresas) {
        userPrompt += `- ${rel.empresa}: ${rel.tipo_relacao}\n`;
      }
      userPrompt += `\nREGRAS DE MULTI-EMPRESA:\n`;
      userPrompt += `1) Você representa APENAS a ${empresa}.\n`;
      if (empresa === 'TOKENIZA') {
        userPrompt += `2) Pode usar o fato de ser atendido pela BLUE para gerar confiança, mas NUNCA ofereça IR.\n`;
      } else {
        userPrompt += `2) Pode mencionar investimentos tokenizados do grupo, mas NUNCA faça pitch.\n`;
      }
      userPrompt += `3) NUNCA misture marcas ou use nomes híbridos.\n`;
    }
  }
  
  // PATCH 6: Estado de conversa e frameworks
  if (conversationState) {
    userPrompt += `\n## ESTADO ATUAL DA CONVERSA\n`;
    userPrompt += `- Etapa do funil: ${conversationState.estado_funil}\n`;
    userPrompt += `- Framework ativo: ${conversationState.framework_ativo}\n`;
    
    if (conversationState.framework_data && Object.keys(conversationState.framework_data).length > 0) {
      userPrompt += `- Dados já coletados: ${JSON.stringify(conversationState.framework_data)}\n`;
    }
    
    if (conversationState.ultima_pergunta_id) {
      userPrompt += `- Última pergunta feita: ${conversationState.ultima_pergunta_id}\n`;
    }
    
    if (conversationState.perfil_disc) {
      userPrompt += `- Perfil DISC: ${conversationState.perfil_disc}\n`;
    }
    
    userPrompt += `\nREGRAS DE CONTINUIDADE:\n`;
    if (conversationState.estado_funil !== 'SAUDACAO') {
      userPrompt += `- NÃO reinicie com apresentação completa. Continue de onde parou.\n`;
    }
    userPrompt += `- Use os dados já coletados para avançar a qualificação.\n`;
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
    historico.reverse().forEach(h => {
      const dir = h.direcao === 'OUTBOUND' ? 'SDR' : 'LEAD';
      userPrompt += `[${dir}]: ${h.conteudo.substring(0, 200)}\n`;
    });
  }

  userPrompt += `\n## MENSAGEM A INTERPRETAR:\n"${mensagem}"`;

  console.log('[IA] Enviando para interpretação:', { 
    empresa, 
    mensagemPreview: mensagem.substring(0, 100),
    temContexto: !!classificacao,
    temPessoa: !!pessoaContext,
    temConversation: !!conversationState,
    estadoFunil: conversationState?.estado_funil,
    framework: conversationState?.framework_ativo,
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
    // Limpar possíveis marcadores de código
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[IA] Erro ao parsear JSON:', content);
    // Fallback seguro
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

  // PATCH 5G-C Fase 5: Aplicar matriz automática de temperatura
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
    // Chamar edge function whatsapp-send
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
 * PATCH 5G-C Fase 4: Aplica ação com MARCAR_OPT_OUT corrigido
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
        // PATCH 5G-C Fase 4: Correção completa do MARCAR_OPT_OUT
        if (leadId) {
          const now = new Date().toISOString();
          
          // 1. Atualizar lead_contacts com opt_out
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

          // 2. Cancelar TODAS as cadências ativas do lead
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

            // Registrar evento em cada run
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

          // 3. Ajustar temperatura para FRIO
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
              motivo: 'Lead demonstrou alta intenção - tarefa criada para closer',
              prioridade: 'ALTA',
              ...detalhes,
            },
          });
          
          // Pausar cadência enquanto closer atua
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
            const { error } = await supabase
              .from('lead_classifications')
              .update({ 
                temperatura: novaTemp,
                updated_at: new Date().toISOString()
              })
              .eq('lead_id', leadId);
            
            if (!error) {
              console.log('[Ação] Temperatura ajustada:', { leadId, novaTemp });
              
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
            }
          }
        }
        break;

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
 * PATCH 6: Sincroniza com Pipedrive (background task)
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

    // Formatar mensagens para log
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

    // Se a ação for CRIAR_TAREFA_CLOSER, criar atividade no Pipedrive
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
            note: `Intent detectado: ${intent}\nConfiança: Alta\nLead demonstrou interesse e foi qualificado para atendimento humano.`,
          },
        }),
      });

      if (activityResponse.ok) {
        console.log('[Pipedrive] Atividade criada para closer');
      }
    }

  } catch (error) {
    console.error('[Pipedrive] Erro na sincronização:', error);
    // Não propaga erro - sync é best effort
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
  // CORS
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

    // 1. Carregar contexto completo (com opt-out, classificação, pessoa e estado de conversa)
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

    // PATCH 5G-C Fase 6: Verificar opt-out antes de processar
    if (optOut) {
      console.log('[SDR-IA] Lead está em opt-out, bloqueando resposta automática:', message.lead_id);
      
      // Ainda salva interpretação mas não envia resposta
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

    // 3. Interpretar com IA (contexto enriquecido com pessoa e estado de conversa)
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
    });

    // 4. Aplicar ação (com correção do MARCAR_OPT_OUT)
    const acaoAplicada = await applyAction(
      supabase,
      message.run_id,
      message.lead_id,
      message.empresa,
      aiResponse.acao,
      aiResponse.acao_detalhes,
      message.conteudo
    );

    // 5. Enviar resposta automática se aplicável (e não for opt-out)
    let respostaEnviada = false;
    let respostaTexto: string | null = null;

    if (
      aiResponse.deve_responder &&
      aiResponse.resposta_sugerida &&
      telefone &&
      aiResponse.intent !== 'OPT_OUT' && // Não responde a opt-out
      (aiResponse.acao === 'ENVIAR_RESPOSTA_AUTOMATICA' || aiResponse.acao === 'CRIAR_TAREFA_CLOSER')
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

    // 7. PATCH 6: Salvar estado de conversa atualizado
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
        // Merge com dados existentes
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
    }

    // 8. Sincronizar com Pipedrive (background task)
    if (pipedriveDealeId) {
      // Fire and forget - não bloqueia a resposta
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
