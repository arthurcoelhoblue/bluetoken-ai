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
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!googleApiKey && !anthropicKey) throw new Error('No AI API key configured');

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

    const prompt = `Você é um coach de vendas em tempo real. Analise o trecho da chamada em andamento e forneça coaching ao vendedor.

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

Retorne APENAS o JSON, sem markdown.`;

    let coachingText = '';
    const startMs = Date.now();
    let aiProvider = '';
    let aiModel = '';

    // Try Claude first (Primary)
    if (anthropicKey) {
      try {
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
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!claudeResp.ok) throw new Error(`Claude ${claudeResp.status}`);
        const claudeData = await claudeResp.json();
        coachingText = claudeData.content?.[0]?.text || '';
        aiProvider = 'CLAUDE';
        aiModel = 'claude-sonnet-4-20250514';
        console.log('[call-coach] Claude OK');
      } catch (e) {
        console.warn('[call-coach] Claude failed:', e);
      }
    }

    // Fallback to Gemini
    if (!coachingText && googleApiKey) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
        const data = await resp.json();
        coachingText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        aiProvider = 'GEMINI';
        aiModel = 'gemini-3-pro-preview';
        console.log('[call-coach] Gemini fallback OK');
      } catch (e) {
        console.warn('[call-coach] Gemini failed:', e);
      }
    }

    // Fallback 2: OpenAI
    if (!coachingText) {
      try {
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
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!claudeResp.ok) throw new Error(`Claude ${claudeResp.status}`);
        const claudeData = await claudeResp.json();
        coachingText = claudeData.content?.[0]?.text || '{}';
        console.log('[call-coach] Claude fallback OK');
      } catch (e) {
        console.error('[call-coach] Claude fallback failed:', e);
      }
    }

    // Fallback 2: OpenAI GPT-4o via API direta
    if (!coachingText) {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (OPENAI_API_KEY) {
        console.log('[call-coach] Trying OpenAI GPT-4o fallback...');
        try {
          const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1024 }),
          });
          if (gptResp.ok) {
            const gptData = await gptResp.json();
            coachingText = gptData.choices?.[0]?.message?.content ?? '';
            console.log('[call-coach] OpenAI GPT-4o fallback OK');
          }
        } catch (gptErr) {
          console.error('[call-coach] OpenAI exception:', gptErr);
        }
      }
    }

    // Log AI usage
    if (coachingText) {
      try {
        await supabase.from('ai_usage_log').insert({
          function_name: 'call-coach', provider: aiProvider || 'OPENAI', model: aiModel || 'gpt-4o',
          tokens_input: null, tokens_output: null, success: true,
          latency_ms: Date.now() - startMs, custo_estimado: 0, empresa: null,
        });
      } catch (logErr) { console.warn('[call-coach] ai_usage_log error:', logErr); }
    }

    let coaching: Record<string, unknown>;
    try {
      const cleaned = (coachingText || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      coaching = JSON.parse(cleaned);
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
