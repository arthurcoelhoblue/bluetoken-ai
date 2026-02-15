import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// SDR Message Parser — Full context loader + urgency detection + investor profile inference
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

// ========================================
// URGENCY DETECTION (from monolith PATCH 9)
// ========================================

type SinalUrgenciaTipo = 'DECISAO_TOMADA' | 'URGENCIA_TEMPORAL' | 'FRUSTRADO_ALTERNATIVA' | 'PEDIDO_REUNIAO_DIRETO' | 'PEDIDO_HUMANO' | 'NENHUM';

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

function detectarLeadQuenteImediato(mensagem: string) {
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
  return { detectado: false, tipo: 'NENHUM' as const, frase_gatilho: null, confianca: 'BAIXA' as const };
}

// ========================================
// LEAD PRONTO DETECTION (from monolith PATCH 10)
// ========================================

function detectarLeadProntoParaEscalar(mensagem: string, historico: any[], frameworkData?: any) {
  const msgLower = mensagem.toLowerCase();
  const historicoText = historico.filter((h: any) => h.direcao === 'INBOUND').map((h: any) => h.conteudo.toLowerCase()).join(' ');
  const todoTexto = msgLower + ' ' + historicoText;

  const conscienciaPatterns = ['sei que preciso', 'tenho que declarar', 'preciso regularizar', 'quero resolver', 'preciso resolver', 'quero investir', 'estou pronto'];
  const aberturaPatterns = ['claro', 'com certeza', 'pode me ajudar', 'quero saber mais', 'me explica', 'como funciona', 'estou interessado', 'quero entender', 'bora', 'vamos lá'];
  const precoPatterns = ['quanto custa', 'qual o valor', 'qual o preço', 'preço', 'quanto fica', 'quanto é', 'valores'];
  const planoPatterns = ['gold', 'diamond', 'esse plano', 'quero o plano', 'prefiro', 'esse mesmo', 'é esse', 'vou querer'];

  const spin = frameworkData?.spin || {};
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
// INVESTOR PROFILE INFERENCE (from monolith PATCH 6+)
// ========================================

function inferirPerfilInvestidor(disc: string | null | undefined, mensagem?: string): string | null {
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
// CROSS-COMPANY DETECTION (from monolith PATCH 8)
// ========================================

function detectCrossCompanyInterest(mensagem: string, empresaAtual: string) {
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
// CONTEXT LOADING (loadMessageContext from monolith)
// ========================================

async function loadFullContext(supabase: SupabaseClient, messageId: string) {
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

  const historico = (histRes.data || []).filter((h: any) => h.id !== messageId);
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

  // Load cadence name if run_id exists
  let cadenciaNome: string | null = null;
  if (message.run_id) {
    const { data: run } = await supabase
      .from('lead_cadence_runs')
      .select('cadence_id, cadences(nome)')
      .eq('id', message.run_id).maybeSingle();
    cadenciaNome = (run?.cadences as any)?.nome || null;
  }

  // Load pessoa context if available
  let pessoaContext = null;
  if (contato?.pessoa_id) {
    try {
      const { data: pessoa } = await supabase.from('pessoas').select('*').eq('id', contato.pessoa_id).single();
      if (pessoa) {
        const { data: contacts } = await supabase.from('lead_contacts').select('lead_id, empresa, tokeniza_investor_id, blue_client_id').eq('pessoa_id', contato.pessoa_id);
        const relacionamentos: any[] = [];
        const empresas = [...new Set(contacts?.map((c: any) => c.empresa) || [])];
        for (const emp of empresas) {
          const empContacts = contacts?.filter((c: any) => c.empresa === emp) || [];
          let tipo_relacao = 'DESCONHECIDO';
          if (emp === 'BLUE') tipo_relacao = empContacts.some((c: any) => c.blue_client_id) ? 'CLIENTE_IR' : 'LEAD_IR';
          else if (emp === 'TOKENIZA') tipo_relacao = empContacts.some((c: any) => c.tokeniza_investor_id) ? 'INVESTIDOR' : 'LEAD_INVESTIDOR';
          relacionamentos.push({ empresa: emp, tipo_relacao });
        }
        pessoaContext = {
          pessoa: { id: pessoa.id, nome: pessoa.nome, telefone_e164: pessoa.telefone_e164, email_principal: pessoa.email_principal, idioma_preferido: pessoa.idioma_preferido || 'PT', perfil_disc: pessoa.perfil_disc },
          relacionamentos,
        };
      }
    } catch { /* ignore */ }
  }

  return {
    message, historico, contato, classificacao, conversationState, cadenciaNome, pessoaContext,
    deals: dealsRes.data || [],
    leadNome: contato?.nome || contato?.primeiro_nome || null,
    telefone: contato?.telefone_e164 || contato?.telefone || null,
    optOut: contato?.opt_out === true,
    pipedriveDealeId: contato?.pipedrive_deal_id || null,
  };
}

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();

    // Support both messageId-based and lead_id-based calls
    if (body.messageId) {
      // Full context load from messageId (used by orchestrator)
      const ctx = await loadFullContext(supabase, body.messageId);
      const mensagem = ctx.message.conteudo;

      // Enrich with urgency + lead pronto + investor profile + cross-company
      const urgencia = detectarLeadQuenteImediato(mensagem);
      const leadPronto = detectarLeadProntoParaEscalar(mensagem, ctx.historico, ctx.conversationState?.framework_data);
      const perfilInvestidor = inferirPerfilInvestidor(ctx.conversationState?.perfil_disc || ctx.pessoaContext?.pessoa?.perfil_disc, mensagem);
      const crossInterest = detectCrossCompanyInterest(mensagem, ctx.message.empresa);

      return new Response(JSON.stringify({
        ...ctx,
        mensagem_normalizada: mensagem.trim(),
        urgencia,
        leadPronto,
        perfilInvestidor,
        crossInterest,
        canal: ctx.conversationState?.canal || ctx.message.canal || 'WHATSAPP',
        empresa: ctx.message.empresa,
        lead_id: ctx.message.lead_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Legacy simple mode (lead_id based)
    const { lead_id, empresa, mensagem, canal } = body;
    if (!lead_id || !empresa || !mensagem) {
      return new Response(JSON.stringify({ error: 'lead_id, empresa, mensagem obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const urgencia = detectarLeadQuenteImediato(mensagem);
    const [classRes, stateRes, msgsRes, dealsRes, contactRes] = await Promise.all([
      supabase.from('lead_classifications').select('*').eq('lead_id', lead_id).eq('empresa', empresa).order('classificado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('lead_conversation_state').select('*').eq('lead_id', lead_id).eq('empresa', empresa).maybeSingle(),
      supabase.from('lead_messages').select('direcao, conteudo, canal, sender_type, created_at').eq('lead_id', lead_id).eq('empresa', empresa).order('created_at', { ascending: false }).limit(20),
      supabase.from('deals').select('id, titulo, valor, status, stage_id').eq('lead_id', lead_id).limit(5),
      supabase.from('lead_contacts').select('nome, primeiro_nome, email, telefone').eq('lead_id', lead_id).eq('empresa', empresa).maybeSingle(),
    ]);

    return new Response(JSON.stringify({
      lead_id, empresa, canal: canal || 'WHATSAPP', mensagem_normalizada: mensagem.trim(), urgencia,
      classificacao: classRes.data || null, conversation_state: stateRes.data || null,
      historico: msgsRes.data || [], deals: dealsRes.data || [], contato: contactRes.data || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[sdr-message-parser] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
