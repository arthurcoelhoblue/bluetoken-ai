import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGeminiWithSystem(googleApiKey: string, systemPrompt: string, userContent: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const { temperature = 0.3, maxTokens = 2000 } = options;
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: 'deal_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!GOOGLE_API_KEY && !ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch deal with contact
    const { data: deal } = await supabase
      .from('deals')
      .select('id, titulo, valor, temperatura, status, contacts(id, nome, legacy_lead_id, email, telefone), pipeline_stages(nome)')
      .eq('id', deal_id)
      .single();

    if (!deal) {
      return new Response(JSON.stringify({ error: 'Deal not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contact = (deal as any).contacts;
    const legacyLeadId = contact?.legacy_lead_id;

    if (!legacyLeadId) {
      return new Response(JSON.stringify({ error: 'No lead associated with deal contact' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lead data in parallel
    const [messagesRes, convStateRes, classificationsRes, intentsRes] = await Promise.all([
      supabase.from('lead_messages').select('direcao, conteudo, canal, created_at')
        .eq('lead_id', legacyLeadId).order('created_at', { ascending: true }).limit(50),
      supabase.from('lead_conversation_state').select('estado_funil, framework_ativo, framework_data, perfil_disc, idioma_preferido')
        .eq('lead_id', legacyLeadId).limit(1).single(),
      supabase.from('lead_classifications').select('icp, temperatura, tags, created_at')
        .eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(1),
      supabase.from('lead_message_intents').select('intent, intent_summary, acao_recomendada, created_at')
        .eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(10),
    ]);

    const messages = messagesRes.data ?? [];
    const convState = convStateRes.data;
    const classification = classificationsRes.data?.[0];
    const intents = intentsRes.data ?? [];

    // Build conversation transcript
    const transcript = messages.map((m: any) =>
      `[${m.direcao === 'INBOUND' ? 'Lead' : 'SDR'}] ${m.conteudo}`
    ).join('\n');

    const systemPrompt = `Você é um analista de vendas especializado em gerar resumos de handoff SDR→Closer.
Analise a conversa e dados do lead e gere um JSON com a seguinte estrutura:

{
  "resumo_conversa": "3-5 parágrafos resumindo o que o lead quer, o que já foi discutido, e o contexto",
  "perfil_disc": "Descrição do perfil comportamental detectado + recomendação de approach",
  "objecoes": ["lista de objeções identificadas na conversa"],
  "frameworks": {
    "framework_ativo": "SPIN|GPCT|BANT|NONE",
    "perguntas_respondidas": ["lista"],
    "perguntas_pendentes": ["lista"]
  },
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

    let content = '';

    // Try Gemini first
    if (GOOGLE_API_KEY) {
      try {
        content = await callGeminiWithSystem(GOOGLE_API_KEY, systemPrompt, userContent, { temperature: 0.3, maxTokens: 2000 });
        console.log('[deal-context-summary] Gemini OK');
      } catch (e) {
        console.warn('[deal-context-summary] Gemini failed:', e);
      }
    }

    // Fallback to Claude
    if (!content && ANTHROPIC_API_KEY) {
      try {
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
        });

        if (!aiResponse.ok) throw new Error(`Claude error ${aiResponse.status}`);
        const aiData = await aiResponse.json();
        content = aiData.content?.[0]?.text ?? '';
        console.log('[deal-context-summary] Claude fallback OK');
      } catch (e) {
        console.error('[deal-context-summary] Claude fallback failed:', e);
      }
    }

    if (!content) {
      return new Response(JSON.stringify({ error: 'AI processing failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let contextSdr: any = null;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      contextSdr = JSON.parse(cleaned);
    } catch {
      console.error('[deal-context-summary] Failed to parse AI response');
      contextSdr = { resumo_conversa: content, objecoes: [], frameworks: {}, sugestao_closer: '' };
    }

    // Save to deal
    await supabase.from('deals').update({
      contexto_sdr: contextSdr,
    } as any).eq('id', deal_id);

    return new Response(JSON.stringify({ success: true, contexto_sdr: contextSdr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[deal-context-summary] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
