import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id } = await req.json();
    if (!deal_id) return new Response(JSON.stringify({ error: 'deal_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: deal } = await supabase.from('deals').select('id, titulo, valor, temperatura, status, contacts(id, nome, legacy_lead_id, email, telefone, empresa), pipeline_stages(nome)').eq('id', deal_id).single();
    if (!deal) return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const contact = (deal as any).contacts;
    const legacyLeadId = contact?.legacy_lead_id;
    if (!legacyLeadId) return new Response(JSON.stringify({ error: 'No lead associated with deal contact' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [messagesRes, convStateRes, classificationsRes, intentsRes] = await Promise.all([
      supabase.from('lead_messages').select('direcao, conteudo, canal, sender_type, created_at').eq('lead_id', legacyLeadId).order('created_at', { ascending: true }).limit(50),
      supabase.from('lead_conversation_state').select('estado_funil, framework_ativo, framework_data, perfil_disc, idioma_preferido').eq('lead_id', legacyLeadId).limit(1).single(),
      supabase.from('lead_classifications').select('icp, temperatura, tags, created_at').eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(1),
      supabase.from('lead_message_intents').select('intent, intent_summary, acao_recomendada, created_at').eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(10),
    ]);

    const messages = messagesRes.data ?? [];
    const convState = convStateRes.data;
    const classification = classificationsRes.data?.[0];
    const intents = intentsRes.data ?? [];

    const transcript = messages.map((m: any) => `[${m.direcao === 'INBOUND' ? 'Lead' : 'SDR'}] ${m.conteudo}`).join('\n');

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

    const userContent = `DEAL: ${(deal as any).titulo} (R$ ${(deal as any).valor || 0})
CONTATO: ${contact?.nome} — ${contact?.email || 'sem email'} — ${contact?.telefone || 'sem tel'}
STAGE: ${(deal as any).pipeline_stages?.nome}
TEMPERATURA: ${(deal as any).temperatura || 'N/A'}
ICP: ${classification?.icp || 'N/A'}
PERFIL DISC: ${convState?.perfil_disc || 'Não detectado'}
FRAMEWORK ATIVO: ${convState?.framework_ativo || 'NONE'}
FRAMEWORK DATA: ${JSON.stringify(convState?.framework_data || {})}
ESTADO FUNIL: ${convState?.estado_funil || 'N/A'}
INTENTS RECENTES:
${intents.map((i: any) => `- ${i.intent}: ${i.intent_summary || ''} (${i.acao_recomendada})`).join('\n')}
CONVERSA (${messages.length} mensagens):
${transcript.substring(0, 8000)}`;

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userContent,
      functionName: 'deal-context-summary',
      empresa: contact?.empresa || null,
      maxTokens: 2000,
      supabase,
    });

    if (!aiResult.content) return new Response(JSON.stringify({ error: 'AI processing failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let contextSdr: any = null;
    try {
      const cleaned = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      contextSdr = JSON.parse(cleaned);
    } catch {
      contextSdr = { resumo_conversa: aiResult.content, objecoes: [], frameworks: {}, sugestao_closer: '' };
    }

    await supabase.from('deals').update({ contexto_sdr: contextSdr } as any).eq('id', deal_id);

    return new Response(JSON.stringify({ success: true, contexto_sdr: contextSdr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[deal-context-summary] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
