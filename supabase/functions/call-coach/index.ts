import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id, transcription_chunk, call_context } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

    // Gather deal context
    let dealContext = '';
    if (deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('titulo, valor, temperatura, status, scoring_dimensoes, proxima_acao_sugerida')
        .eq('id', deal_id)
        .single();

      if (deal) {
        dealContext += `\nDEAL: ${deal.titulo} | Valor: R$${deal.valor || 0} | Temperatura: ${deal.temperatura || 'N/A'}`;
        if (deal.proxima_acao_sugerida) dealContext += `\nPróxima ação sugerida: ${deal.proxima_acao_sugerida}`;
      }

      // Get contact info via deal
      const { data: dealFull } = await supabase
        .from('deals')
        .select('contact_id')
        .eq('id', deal_id)
        .single();

      if (dealFull?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('nome, linkedin_cargo, linkedin_empresa, linkedin_setor')
          .eq('id', dealFull.contact_id)
          .single();

        if (contact) {
          dealContext += `\nCONTATO: ${contact.nome}`;
          if (contact.linkedin_cargo) dealContext += ` | Cargo: ${contact.linkedin_cargo}`;
          if (contact.linkedin_empresa) dealContext += ` | Empresa: ${contact.linkedin_empresa}`;
          if (contact.linkedin_setor) dealContext += ` | Setor: ${contact.linkedin_setor}`;
        }

        // Get conversation state (frameworks)
        const { data: convState } = await supabase
          .from('lead_conversation_state')
          .select('framework_progress, disc_profile, qualification_data')
          .eq('contact_id', dealFull.contact_id)
          .maybeSingle();

        if (convState) {
          if (convState.disc_profile) dealContext += `\nPerfil DISC: ${JSON.stringify(convState.disc_profile)}`;
          if (convState.framework_progress) dealContext += `\nFrameworks: ${JSON.stringify(convState.framework_progress)}`;
          if (convState.qualification_data) dealContext += `\nQualificação: ${JSON.stringify(convState.qualification_data)}`;
        }
      }
    }

    // Get knowledge base products
    const { data: products } = await supabase
      .from('knowledge_products')
      .select('nome, descricao, diferenciais, objecoes_comuns')
      .limit(5);

    let productContext = '';
    if (products && products.length > 0) {
      productContext = '\n\nPRODUTOS/SERVIÇOS:\n' + products.map(p =>
        `- ${p.nome}: ${p.descricao || ''}\n  Diferenciais: ${p.diferenciais || 'N/A'}\n  Objeções comuns: ${p.objecoes_comuns || 'N/A'}`
      ).join('\n');
    }

    // Claude coaching prompt
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Você é um coach de vendas em tempo real. Analise o trecho da chamada em andamento e forneça coaching ao vendedor.

CONTEXTO DO DEAL:${dealContext}
${productContext}

${call_context ? `CONTEXTO ADICIONAL: ${call_context}` : ''}

TRECHO DA CONVERSA:
${transcription_chunk || '(Chamada recém iniciada, sem transcrição ainda)'}

Retorne um JSON com:
{
  "sentimento_atual": "POSITIVO" ou "NEGATIVO" ou "NEUTRO",
  "sugestoes": ["lista de 2-3 sugestões táticas para o vendedor neste momento"],
  "objecoes_detectadas": ["objeções que o prospect levantou ou pode levantar"],
  "framework_tips": ["dicas baseadas em SPIN/BANT/DISC se aplicável"],
  "battlecard": "argumento competitivo relevante, se houver",
  "talk_ratio_hint": "fala muito" ou "equilíbrio bom" ou "ouve bem"
}

Retorne APENAS o JSON, sem markdown.`,
        }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      throw new Error(`Claude error ${claudeResp.status}: ${errText}`);
    }

    const claudeData = await claudeResp.json();
    const coachingText = claudeData.content?.[0]?.text || '{}';
    let coaching: Record<string, unknown>;
    try {
      coaching = JSON.parse(coachingText);
    } catch {
      coaching = {
        sentimento_atual: 'NEUTRO',
        sugestoes: ['Mantenha a escuta ativa', 'Faça perguntas abertas'],
        objecoes_detectadas: [],
        framework_tips: [],
        battlecard: '',
        talk_ratio_hint: 'equilíbrio bom',
      };
    }

    return new Response(JSON.stringify(coaching), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('call-coach error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
