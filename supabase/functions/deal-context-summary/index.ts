import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { assertEmpresa } from "../_shared/tenant.ts";

const log = createLogger('deal-context-summary');

interface DealContact {
  id: string;
  nome: string;
  legacy_lead_id: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id } = await req.json();
    if (!deal_id) return new Response(JSON.stringify({ error: 'deal_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createServiceClient();

    const { data: deal } = await supabase.from('deals').select('id, titulo, valor, temperatura, status, contacts(id, nome, legacy_lead_id, email, telefone, empresa), pipeline_stages(nome)').eq('id', deal_id).single();
    if (!deal) return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const contact = (deal as Record<string, unknown>).contacts as DealContact | null;
    
    // Validate tenant from contact
    const contactEmpresa = contact?.empresa;
    assertEmpresa(contactEmpresa);

    const legacyLeadId = contact?.legacy_lead_id;
    if (!legacyLeadId) return new Response(JSON.stringify({ error: 'No lead associated with deal contact' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [messagesRes, convStateRes, classificationsRes, intentsRes] = await Promise.all([
      supabase.from('lead_messages').select('direcao, conteudo, canal, sender_type, created_at')
        .eq('lead_id', legacyLeadId).eq('empresa', contactEmpresa)
        .order('created_at', { ascending: true }).limit(50),
      supabase.from('lead_conversation_state').select('estado_funil, framework_ativo, framework_data, perfil_disc, idioma_preferido')
        .eq('lead_id', legacyLeadId).limit(1).single(),
      supabase.from('lead_classifications').select('icp, temperatura, tags, created_at')
        .eq('lead_id', legacyLeadId).eq('empresa', contactEmpresa)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('lead_message_intents').select('intent, intent_summary, acao_recomendada, created_at')
        .eq('lead_id', legacyLeadId).eq('empresa', contactEmpresa)
        .order('created_at', { ascending: false }).limit(10),
    ]);

    const messages = messagesRes.data ?? [];
    const convState = convStateRes.data;
    const classification = classificationsRes.data?.[0];
    const intents = intentsRes.data ?? [];

    const transcript = messages.map((m) => `[${m.direcao === 'INBOUND' ? 'Lead' : 'SDR'}] ${m.conteudo}`).join('\n');

    const systemPrompt = `Você é um analista de vendas especializado em gerar resumos de handoff SDR→Closer.
Analise a conversa e dados do lead e gere um JSON com a seguinte estrutura:
{
  "resumo_conversa": "3-5 parágrafos resumindo o que o lead quer, o que já foi discutido, e o contexto",
  "perfil_disc": "Descrição do perfil comportamental detectado + recomendação de approach",
  "objecoes": ["lista de objeções identificadas na conversa"],
  "frameworks": { "framework_ativo": "SPIN|GPCT|BANT|NONE", "perguntas_respondidas": ["lista"], "perguntas_pendentes": ["lista"] },
  "sugestao_closer": "1 parágrafo com sugestão de approach para o closer"
}
Responda APENAS com JSON válido, sem markdown.`;

    const pipelineStages = (deal as Record<string, unknown>).pipeline_stages as { nome: string } | null;

    const userContent = `DEAL: ${deal.titulo} (R$ ${deal.valor || 0})
CONTATO: ${contact?.nome} — ${contact?.email || 'sem email'} — ${contact?.telefone || 'sem tel'}
STAGE: ${pipelineStages?.nome}
TEMPERATURA: ${deal.temperatura || 'N/A'}
ICP: ${classification?.icp || 'N/A'}
PERFIL DISC: ${convState?.perfil_disc || 'Não detectado'}
FRAMEWORK ATIVO: ${convState?.framework_ativo || 'NONE'}
FRAMEWORK DATA: ${JSON.stringify(convState?.framework_data || {})}
ESTADO FUNIL: ${convState?.estado_funil || 'N/A'}
INTENTS RECENTES:
${intents.map((i) => `- ${i.intent}: ${i.intent_summary || ''} (${i.acao_recomendada})`).join('\n')}
CONVERSA (${messages.length} mensagens):
${transcript.substring(0, 8000)}`;

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userContent,
      functionName: 'deal-context-summary',
      empresa: contactEmpresa,
      maxTokens: 2000,
      supabase,
    });

    if (!aiResult.content) return new Response(JSON.stringify({ error: 'AI processing failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let contextSdr: Record<string, unknown> | null = null;
    try {
      const cleaned = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      contextSdr = JSON.parse(cleaned);
    } catch {
      contextSdr = { resumo_conversa: aiResult.content, objecoes: [], frameworks: {}, sugestao_closer: '' };
    }

    await supabase.from('deals').update({ contexto_sdr: contextSdr } as Record<string, unknown>).eq('id', deal_id);

    return new Response(JSON.stringify({ success: true, contexto_sdr: contextSdr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
