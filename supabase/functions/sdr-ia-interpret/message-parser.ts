// ========================================
// MESSAGE PARSER MODULE — Extracted from sdr-message-parser Edge Function
// Loads full context for a lead message and enriches with urgency/cross-company detection
// Also handles progressive summarization of long conversations
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('sdr-message-parser');

// ========================================
// TYPES
// ========================================

export type SinalUrgenciaTipo = 'DECISAO_TOMADA' | 'URGENCIA_TEMPORAL' | 'FRUSTRADO_ALTERNATIVA' | 'PEDIDO_REUNIAO_DIRETO' | 'PEDIDO_HUMANO' | 'NENHUM';

export interface UrgenciaResult {
  detectado: boolean;
  tipo: SinalUrgenciaTipo;
  frase_gatilho: string | null;
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface HistoricoMessage {
  id?: string;
  direcao: string;
  conteudo: string;
  canal?: string;
  sender_type?: string;
  created_at?: string;
}

interface FrameworkDataInput {
  spin?: { s?: boolean; p?: boolean };
}

export interface ParsedContext {
  message: Record<string, unknown>;
  historico: HistoricoMessage[];
  contato: Record<string, unknown> | null;
  classificacao: Record<string, unknown> | null;
  conversationState: Record<string, unknown> | null;
  conversation_state?: Record<string, unknown> | null;
  cadenciaNome: string | null;
  pessoaContext: Record<string, unknown> | null;
  deals: Record<string, unknown>[];
  leadNome: string | null;
  telefone: string | null;
  optOut: boolean;
  pipedriveDealeId: string | null;
  mensagem_normalizada: string;
  urgencia: UrgenciaResult;
  leadPronto: ReturnType<typeof detectarLeadProntoParaEscalar>;
  perfilInvestidor: string | null;
  crossInterest: { detected: boolean; targetCompany: string | null; reason: string };
  canal: string;
  empresa: string;
  lead_id: string;
}

// ========================================
// URGENCY DETECTION
// ========================================

const URGENCIA_PATTERNS: Record<Exclude<SinalUrgenciaTipo, 'NENHUM'>, string[]> = {
  DECISAO_TOMADA: [
    'quero contratar', 'quero fechar', 'vamos fechar', 'fechado',
    'como pago', 'como faço o pagamento', 'manda o pix', 'manda o contrato',
    'pode mandar', 'aceito', 'bora', 'vamos lá', 'to dentro',
    'quero esse plano', 'quero o gold', 'quero o diamond',
    'próximo passo', 'qual o próximo passo', 'como proceder',
    'me manda o link', 'onde pago', 'pode cobrar',
    'o que preciso enviar', 'o que eu preciso enviar', 'o que tenho que enviar',
    'quais documentos', 'que documentos preciso', 'documentos necessários',
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
  ],
  PEDIDO_REUNIAO_DIRETO: [
    'quero uma reunião', 'marcar reunião', 'agendar reunião',
    'podemos conversar', 'vamos conversar', 'me liga',
    'pode me ligar', 'quero falar por telefone',
  ],
  PEDIDO_HUMANO: [
    'falar com humano', 'falar com alguém', 'falar com uma pessoa',
    'atendente', 'atendimento humano', 'pessoa real',
    'especialista', 'falar com especialista', 'consultor',
    'vocês são robô', 'você é robô', 'isso é bot',
    'quero falar com gente', 'tem alguém aí',
  ],
};

export function detectarLeadQuenteImediato(mensagem: string): UrgenciaResult {
  const msgLower = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ordemPrioridade: Exclude<SinalUrgenciaTipo, 'NENHUM'>[] = ['PEDIDO_HUMANO', 'DECISAO_TOMADA', 'URGENCIA_TEMPORAL', 'FRUSTRADO_ALTERNATIVA', 'PEDIDO_REUNIAO_DIRETO'];

  for (const tipo of ordemPrioridade) {
    for (const pattern of URGENCIA_PATTERNS[tipo]) {
      const patternNorm = pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (msgLower.includes(patternNorm)) {
        let confianca: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA';
        if (['quero contratar', 'como pago', 'manda o pix', 'vamos fechar', 'falar com humano', 'preciso urgente', 'malha fina'].some(p => msgLower.includes(p))) confianca = 'ALTA';
        if (['podemos conversar', 'já tentei', 'prazo'].some(p => msgLower.includes(p) && msgLower.length < 20)) confianca = 'BAIXA';
        return { detectado: true, tipo, frase_gatilho: pattern, confianca };
      }
    }
  }
  return { detectado: false, tipo: 'NENHUM', frase_gatilho: null, confianca: 'BAIXA' };
}

// ========================================
// LEAD PRONTO DETECTION
// ========================================

export function detectarLeadProntoParaEscalar(mensagem: string, historico: HistoricoMessage[], frameworkData?: FrameworkDataInput) {
  const msgLower = mensagem.toLowerCase();
  const historicoText = historico.filter((h) => h.direcao === 'INBOUND').map((h) => h.conteudo.toLowerCase()).join(' ');
  const todoTexto = msgLower + ' ' + historicoText;

  const conscienciaPatterns = ['sei que preciso', 'tenho que declarar', 'preciso regularizar', 'quero resolver', 'preciso resolver', 'quero investir', 'estou pronto'];
  const aberturaPatterns = ['claro', 'com certeza', 'pode me ajudar', 'quero saber mais', 'me explica', 'como funciona', 'estou interessado', 'quero entender', 'bora', 'vamos lá'];
  const precoPatterns = ['quanto custa', 'qual o valor', 'qual o preço', 'preço', 'quanto fica', 'quanto é', 'valores'];
  const planoPatterns = ['gold', 'diamond', 'esse plano', 'quero o plano', 'prefiro', 'esse mesmo', 'é esse', 'vou querer'];

  const rawSpin = (frameworkData?.spin || {}) as Record<string, unknown>;
  const normalizeKey = (k: string) => k
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const spinAliases: Record<string, 's' | 'p'> = {
    s: 's', situacao: 's', contexto: 's',
    p: 'p', problema: 'p', dor: 'p', dificuldade: 'p',
  };
  const spin = Object.entries(rawSpin).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const normalized = normalizeKey(key);
    const canonical = spinAliases[normalized] || normalized;
    acc[canonical] = value;
    return acc;
  }, {});

  const conscienciaTotalPresente = conscienciaPatterns.some(p => todoTexto.includes(p));
  const aberturaExplicita = aberturaPatterns.some(p => msgLower.includes(p));
  const volumeTempoConhecido = !!(spin.s && spin.p);
  const perguntaPreco = precoPatterns.some(p => todoTexto.includes(p));
  const reconheceuPlano = planoPatterns.some(p => todoTexto.includes(p));

  return {
    conscienciaTotalPresente, aberturaExplicita, volumeTempoConhecido, perguntaPreco, reconheceuPlano,
    totalSinais: [conscienciaTotalPresente, aberturaExplicita, volumeTempoConhecido, perguntaPreco, reconheceuPlano].filter(Boolean).length,
  };
}

// ========================================
// INVESTOR PROFILE INFERENCE
// ========================================

export function inferirPerfilInvestidor(disc: string | null | undefined, mensagem?: string): string | null {
  const conservadorKeywords = ['segurança', 'seguro', 'garantia', 'risco', 'proteção', 'tranquilidade', 'certeza', 'estabilidade', 'conservador', 'medo', 'preocupado'];
  const arrojadoKeywords = ['rentabilidade', 'retorno', 'lucro', 'ganho', 'resultado', 'crescimento', 'oportunidade', 'arrojado', 'agressivo', 'quanto rende'];

  if (mensagem) {
    const msgLower = mensagem.toLowerCase();
    const conservadorMatch = conservadorKeywords.some(k => msgLower.includes(k));
    const arrojadoMatch = arrojadoKeywords.some(k => msgLower.includes(k));
    if (conservadorMatch && !arrojadoMatch) return 'CONSERVADOR';
    if (arrojadoMatch && !conservadorMatch) return 'ARROJADO';
  }
  if (disc === 'D') return 'ARROJADO';
  if (disc === 'C') return 'CONSERVADOR';
  return null;
}

// ========================================
// CROSS-COMPANY DETECTION
// ========================================

export function detectCrossCompanyInterest(mensagem: string, empresaAtual: string) {
  const msgLower = mensagem.toLowerCase();
  const tokenizaKeywords = ['investimento', 'investir', 'tokenizado', 'tokenização', 'ofertas', 'rentabilidade', 'rendimento', 'retorno', 'aplicar dinheiro', 'renda passiva'];
  const blueKeywords = ['imposto de renda', 'ir de cripto', 'declarar cripto', 'declaração', 'receita federal', 'exchange', 'bitcoin', 'cripto', 'ganho de capital'];

  if (empresaAtual === 'BLUE') {
    for (const keyword of tokenizaKeywords) {
      if (msgLower.includes(keyword)) return { detected: true, targetCompany: 'TOKENIZA', reason: `Lead mencionou "${keyword}"` };
    }
  }
  if (empresaAtual === 'TOKENIZA') {
    for (const keyword of blueKeywords) {
      if (msgLower.includes(keyword)) return { detected: true, targetCompany: 'BLUE', reason: `Lead mencionou "${keyword}"` };
    }
  }
  return { detected: false, targetCompany: null, reason: '' };
}

// ========================================
// CONTEXT LOADING
// ========================================

export async function loadFullContext(supabase: SupabaseClient, messageId: string): Promise<ParsedContext> {
  // 1. Load message
  const { data: message, error: msgErr } = await supabase
    .from('lead_messages')
    .select('id, lead_id, run_id, empresa, conteudo, direcao, canal, sender_type, created_at')
    .eq('id', messageId)
    .single();

  if (msgErr || !message) throw new Error('Mensagem não encontrada: ' + messageId);

  const leadId = message.lead_id;
  const empresa = message.empresa;

  // 2. Load context in parallel
  const [histRes, contactRes, classRes, stateRes, dealsRes] = await Promise.all([
    supabase.from('lead_messages').select('id, lead_id, run_id, empresa, conteudo, direcao, canal, sender_type, created_at')
      .eq('lead_id', leadId).eq('empresa', empresa).order('created_at', { ascending: false }).limit(20),
    supabase.from('lead_contacts').select('nome, primeiro_nome, telefone, telefone_e164, pessoa_id, opt_out, opt_out_em, opt_out_motivo, pipedrive_deal_id, owner_id')
      .eq('lead_id', leadId).eq('empresa', empresa).maybeSingle(),
    supabase.from('lead_classifications').select('icp, persona, temperatura, prioridade, score_interno, origem')
      .eq('lead_id', leadId).eq('empresa', empresa).order('classificado_em', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('lead_conversation_state').select('*')
      .eq('lead_id', leadId).eq('empresa', empresa).maybeSingle(),
    supabase.from('deals').select('id, titulo, valor, status, stage_id')
      .eq('lead_id', leadId).limit(5),
  ]);

  const historico = (histRes.data || []).filter((h: HistoricoMessage) => h.id !== messageId);
  const contato = contactRes.data || null;
  const classificacao = classRes.data || null;
  let conversationState = stateRes.data || null;

  // Create initial conversation state if missing
  if (!conversationState && leadId) {
    const frameworkAtivo = empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
    const { data: newState } = await supabase
      .from('lead_conversation_state')
      .insert({ lead_id: leadId, empresa, canal: 'WHATSAPP', estado_funil: 'SAUDACAO', framework_ativo: frameworkAtivo, framework_data: {}, idioma_preferido: 'PT' })
      .select().single();
    conversationState = newState;
  }

  // Progressive summarization: if history is long and no summary exists, summarize old turns
  if (historico.length > 10 && conversationState && !conversationState.summary) {
    try {
      const oldTurns = historico.slice(5); // messages beyond the 5 most recent
      const turnsText = oldTurns.map((m: HistoricoMessage) => `[${m.direcao}] ${m.conteudo}`).join('\n');
      const summaryResult = await callAI({
        system: 'Você é um sumarizador. Resuma a conversa abaixo em 1 parágrafo curto (máx 150 palavras) mantendo: nome do lead, produto de interesse, dúvidas levantadas, objeções, dados SPIN/BANT/GPCT coletados. Responda APENAS com o resumo, sem prefixos.',
        prompt: turnsText,
        functionName: 'sdr-message-parser-summary',
        empresa: message.empresa,
        temperature: 0.2,
        maxTokens: 300,
        supabase,
      });
      if (summaryResult.content && summaryResult.content.length > 20) {
        await supabase
          .from('lead_conversation_state')
          .update({ summary: summaryResult.content, updated_at: new Date().toISOString() })
          .eq('lead_id', leadId)
          .eq('empresa', message.empresa);
        conversationState.summary = summaryResult.content;
        log.info('Progressive summary saved', { leadId, summaryLength: summaryResult.content.length });
      }
    } catch (e) {
      log.error('Summary generation failed', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Load cadence name if run_id exists
  let cadenciaNome: string | null = null;
  if (message.run_id) {
    const { data: run } = await supabase
      .from('lead_cadence_runs')
      .select('cadence_id, cadences(nome)')
      .eq('id', message.run_id).maybeSingle();
    cadenciaNome = (run?.cadences as { nome: string } | null)?.nome || null;
  }

  // Load pessoa context if available
  let pessoaContext = null;
  if (contato?.pessoa_id) {
    try {
      const { data: pessoa } = await supabase.from('pessoas').select('*').eq('id', contato.pessoa_id).single();
      if (pessoa) {
        const { data: contacts } = await supabase.from('lead_contacts').select('lead_id, empresa, tokeniza_investor_id, blue_client_id').eq('pessoa_id', contato.pessoa_id);
        interface LeadContactRow { lead_id: string; empresa: string; tokeniza_investor_id?: string; blue_client_id?: string }
        const relacionamentos: { empresa: string; tipo_relacao: string }[] = [];
        const empresas = [...new Set(contacts?.map((c: LeadContactRow) => c.empresa) || [])];
        for (const emp of empresas) {
          const empContacts = contacts?.filter((c: LeadContactRow) => c.empresa === emp) || [];
          let tipo_relacao = 'DESCONHECIDO';
          if (emp === 'BLUE') tipo_relacao = empContacts.some((c) => c.blue_client_id) ? 'CLIENTE_IR' : 'LEAD_IR';
          else if (emp === 'TOKENIZA') tipo_relacao = empContacts.some((c) => c.tokeniza_investor_id) ? 'INVESTIDOR' : 'LEAD_INVESTIDOR';
          relacionamentos.push({ empresa: emp, tipo_relacao });
        }
        pessoaContext = {
          pessoa: { id: pessoa.id, nome: pessoa.nome, telefone_e164: pessoa.telefone_e164, email_principal: pessoa.email_principal, idioma_preferido: pessoa.idioma_preferido || 'PT', perfil_disc: pessoa.perfil_disc },
          relacionamentos,
        };
      }
    } catch { /* ignore */ }
  }

  const mensagem = message.conteudo;
  const urgencia = detectarLeadQuenteImediato(mensagem);
  const leadPronto = detectarLeadProntoParaEscalar(mensagem, historico, conversationState?.framework_data);
  const perfilInvestidor = inferirPerfilInvestidor(conversationState?.perfil_disc || pessoaContext?.pessoa?.perfil_disc, mensagem);
  const crossInterest = detectCrossCompanyInterest(mensagem, message.empresa);

  return {
    message, historico, contato, classificacao, conversationState,
    conversation_state: conversationState,
    cadenciaNome, pessoaContext,
    deals: dealsRes.data || [],
    leadNome: contato?.nome || contato?.primeiro_nome || null,
    telefone: contato?.telefone_e164 || contato?.telefone || null,
    optOut: contato?.opt_out === true,
    pipedriveDealeId: contato?.pipedrive_deal_id || null,
    mensagem_normalizada: mensagem.trim(),
    urgencia,
    leadPronto,
    perfilInvestidor,
    crossInterest,
    canal: conversationState?.canal || message.canal || 'WHATSAPP',
    empresa: message.empresa,
    lead_id: message.lead_id,
  };
}
