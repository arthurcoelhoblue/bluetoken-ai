import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id, transcription_chunk, call_context } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let dealContext = '';
    if (deal_id) {
      const { data: deal } = await supabase.from('deals').select('titulo, valor, temperatura, status, scoring_dimensoes, proxima_acao_sugerida').eq('id', deal_id).single();
      if (deal) {
        dealContext += `\nDEAL: ${deal.titulo} | Valor: R$${deal.valor || 0} | Temperatura: ${deal.temperatura || 'N/A'}`;
        if (deal.proxima_acao_sugerida) dealContext += `\nPróxima ação sugerida: ${deal.proxima_acao_sugerida}`;
      }
      const { data: dealFull } = await supabase.from('deals').select('contact_id').eq('id', deal_id).single();
      if (dealFull?.contact_id) {
        const { data: contact } = await supabase.from('contacts').select('nome, linkedin_cargo, linkedin_empresa, linkedin_setor').eq('id', dealFull.contact_id).single();
        if (contact) {
          dealContext += `\nCONTATO: ${contact.nome}`;
          if (contact.linkedin_cargo) dealContext += ` | Cargo: ${contact.linkedin_cargo}`;
          if (contact.linkedin_empresa) dealContext += ` | Empresa: ${contact.linkedin_empresa}`;
        }
        const { data: convState } = await supabase.from('lead_conversation_state').select('framework_progress, disc_profile, qualification_data').eq('contact_id', dealFull.contact_id).maybeSingle();
        if (convState) {
          if (convState.disc_profile) dealContext += `\nPerfil DISC: ${JSON.stringify(convState.disc_profile)}`;
          if (convState.framework_progress) dealContext += `\nFrameworks: ${JSON.stringify(convState.framework_progress)}`;
        }
      }
    }

    const { data: products } = await supabase.from('knowledge_products').select('nome, descricao, diferenciais, objecoes_comuns').limit(5);
    let productContext = '';
    if (products && products.length > 0) {
      productContext = '\n\nPRODUTOS/SERVIÇOS:\n' + products.map(p => `- ${p.nome}: ${p.descricao || ''}\n  Diferenciais: ${p.diferenciais || 'N/A'}\n  Objeções comuns: ${p.objecoes_comuns || 'N/A'}`).join('\n');
    }

    const prompt = `Você é um coach de vendas em tempo real. Analise o trecho da chamada e forneça coaching.
CONTEXTO:${dealContext}${productContext}
${call_context ? `CONTEXTO ADICIONAL: ${call_context}` : ''}
TRECHO DA CONVERSA:
${transcription_chunk || '(Chamada recém iniciada)'}
Retorne JSON: {"sentimento_atual":"POSITIVO|NEGATIVO|NEUTRO","sugestoes":["..."],"objecoes_detectadas":["..."],"framework_tips":["..."],"battlecard":"...","talk_ratio_hint":"..."}
Retorne APENAS o JSON, sem markdown.`;

    const aiResult = await callAI({
      system: 'Você é um coach de vendas em tempo real especialista em frameworks SPIN, BANT e DISC.',
      prompt,
      functionName: 'call-coach',
      maxTokens: 1024,
      supabase,
    });

    let coaching: Record<string, unknown>;
    try {
      coaching = JSON.parse((aiResult.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      coaching = { sentimento_atual: 'NEUTRO', sugestoes: ['Mantenha a escuta ativa', 'Faça perguntas abertas'], objecoes_detectadas: [], framework_tips: [], battlecard: '', talk_ratio_hint: 'equilíbrio bom' };
    }

    return new Response(JSON.stringify(coaching), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('call-coach error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
