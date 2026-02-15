import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { customer_id } = await req.json();
    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch customer + context in parallel
    const [customerRes, surveysRes, incidentsRes, healthRes] = await Promise.all([
      supabase.from('cs_customers').select('id, empresa, notas_csm, health_score, health_status, valor_mrr, risco_churn_pct, contact:contact_id(nome, email)').eq('id', customer_id).single(),
      supabase.from('cs_surveys').select('tipo, nota, feedback_texto, enviado_em').eq('customer_id', customer_id).order('enviado_em', { ascending: false }).limit(5),
      supabase.from('cs_incidents').select('titulo, descricao, gravidade, status, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(5),
      supabase.from('cs_health_log').select('score, status, motivo_mudanca, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(3),
    ]);

    const customer = customerRes.data;
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const surveys = surveysRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const healthLog = healthRes.data ?? [];

    // Build context
    const contextParts: string[] = [];
    contextParts.push(`Cliente: ${(customer.contact as any)?.nome || 'N/A'}, Health: ${customer.health_score} (${customer.health_status}), MRR: R$${customer.valor_mrr}, Churn: ${customer.risco_churn_pct}%`);

    if (customer.notas_csm) contextParts.push(`Notas atuais do CSM: ${customer.notas_csm}`);

    if (surveys.length > 0) {
      contextParts.push('Pesquisas recentes: ' + surveys.map((s: any) => `${s.tipo} nota=${s.nota ?? 'pendente'} ${s.feedback_texto ? `"${s.feedback_texto.slice(0, 100)}"` : ''}`).join(' | '));
    }

    if (incidents.length > 0) {
      contextParts.push('Incidências recentes: ' + incidents.map((i: any) => `[${i.gravidade}/${i.status}] ${i.titulo}`).join(' | '));
    }

    if (healthLog.length > 0) {
      contextParts.push('Health log: ' + healthLog.map((h: any) => `Score ${h.score} (${h.status}) - ${h.motivo_mudanca || 'recalculado'}`).join(' | '));
    }

    const prompt = `Baseado nos dados do cliente abaixo, sugira uma nota de acompanhamento em 2-3 frases que o CSM pode registrar. A nota deve ser prática, mencionar dados concretos e sugerir próximos passos.

${contextParts.join('\n')}

Responda APENAS com a sugestão de nota, sem prefixos ou explicações.`;

    // Try Claude first, then Gemini fallback
    let sugestao = '';
    let model = '';
    let provider = '';
    let tokensInput = 0;
    let tokensOutput = 0;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

    if (ANTHROPIC_API_KEY) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, temperature: 0.3, messages: [{ role: 'user', content: prompt }] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          sugestao = data.content?.[0]?.text || '';
          model = 'claude-sonnet-4-20250514';
          provider = 'claude';
          tokensInput = data.usage?.input_tokens || 0;
          tokensOutput = data.usage?.output_tokens || 0;
        }
      } catch (e) { console.warn('[cs-suggest-note] Claude failed:', e); }
    }

    if (!sugestao && GOOGLE_API_KEY) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 300 } }),
        });
        if (resp.ok) {
          const data = await resp.json();
          sugestao = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          model = 'gemini-3-pro-preview';
          provider = 'gemini';
        }
      } catch (e) { console.warn('[cs-suggest-note] Gemini failed:', e); }
    }

    if (!sugestao) {
      sugestao = 'Não foi possível gerar sugestão no momento. Tente novamente.';
    }

    const latencyMs = Date.now() - startTime;

    // Log usage
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'cs-suggest-note',
        provider: provider || 'none',
        model: model || 'none',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        latency_ms: latencyMs,
        success: !!sugestao,
        empresa: customer.empresa || null,
      });
    } catch (logErr) { console.warn('[cs-suggest-note] log error:', logErr); }

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cs-suggest-note] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
