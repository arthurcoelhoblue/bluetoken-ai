import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: configs } = await supabase.from('system_settings').select('empresa').limit(10);
    const empresas = [...new Set((configs ?? []).map((c: any) => c.empresa).filter(Boolean))];
    if (empresas.length === 0) empresas.push('BLUE', 'TOKENIZA');

    const results: Record<string, any> = {};
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekAgoISO = weekAgo.toISOString();

    for (const empresa of empresas) {
      // 1. Deals closed this week
      const { data: dealsGanhos } = await supabase
        .from('deals')
        .select('id, titulo, valor, status')
        .eq('empresa', empresa)
        .eq('status', 'GANHO')
        .gte('updated_at', weekAgoISO)
        .limit(50);

      const { data: dealsPerdidos } = await supabase
        .from('deals')
        .select('id, titulo, valor, status, motivo_perda')
        .eq('empresa', empresa)
        .eq('status', 'PERDIDO')
        .gte('updated_at', weekAgoISO)
        .limit(50);

      // 2. Pipeline open
      const { data: dealsAbertos } = await supabase
        .from('deals')
        .select('id, valor')
        .eq('empresa', empresa)
        .eq('status', 'ABERTO');

      // 3. CS risks
      const { data: csRiscos } = await supabase
        .from('cs_customers')
        .select('id, health_score, health_status, valor_mrr, contacts(nome)')
        .eq('empresa', empresa)
        .in('health_status', ['EM_RISCO', 'CRITICO'])
        .limit(10);

      // 4. Activities this week
      const { data: atividades } = await supabase
        .from('deal_activities')
        .select('id, tipo')
        .gte('created_at', weekAgoISO)
        .limit(500);

      // 5. NPS/CSAT recent
      const { data: surveys } = await supabase
        .from('cs_surveys')
        .select('tipo, nota')
        .eq('empresa', empresa)
        .gte('created_at', weekAgoISO)
        .limit(100);

      const ganhoValor = (dealsGanhos ?? []).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const perdidoValor = (dealsPerdidos ?? []).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const pipelineValor = (dealsAbertos ?? []).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const atividadeCount = atividades?.length ?? 0;
      const npsScores = (surveys ?? []).filter((s: any) => s.tipo === 'NPS').map((s: any) => s.nota);
      const npsAvg = npsScores.length > 0 ? npsScores.reduce((a: number, b: number) => a + b, 0) / npsScores.length : null;

      const context = {
        empresa,
        periodo: `${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}`,
        deals_ganhos: dealsGanhos?.length ?? 0,
        valor_ganho: ganhoValor,
        deals_perdidos: dealsPerdidos?.length ?? 0,
        valor_perdido: perdidoValor,
        pipeline_aberto: dealsAbertos?.length ?? 0,
        pipeline_valor: pipelineValor,
        cs_em_risco: csRiscos?.length ?? 0,
        atividades_semana: atividadeCount,
        nps_medio: npsAvg,
        motivos_perda: (dealsPerdidos ?? []).map((d: any) => d.motivo_perda).filter(Boolean).slice(0, 5),
      };

      let narrative = '';
      const prompt = `Gere um relatório semanal executivo em português (2-3 parágrafos) para a empresa ${empresa}, baseado nestes dados:\n${JSON.stringify(context)}\n\nSeja direto, mencione números, destaque conquistas, riscos e recomendações para a próxima semana. Formato: texto corrido, sem markdown.`;

      // Try Gemini first
      if (googleApiKey) {
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
            }),
          });
          if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
          const data = await resp.json();
          narrative = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (e) {
          console.warn('[weekly-report] Gemini failed:', e);
        }
      }

      // Fallback to Claude
      if (!narrative && anthropicKey) {
        try {
          const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 600,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const aiData = await aiResp.json();
          narrative = aiData.content?.[0]?.text || '';
        } catch (e) {
          console.error('[weekly-report] Claude fallback failed:', e);
        }
      }

      // Deterministic fallback
      if (!narrative) {
        narrative = `Semana encerrada com ${context.deals_ganhos} deals ganhos (R$ ${(ganhoValor / 100).toFixed(0)}) e ${context.deals_perdidos} perdidos. Pipeline: ${context.pipeline_aberto} deals abertos (R$ ${(pipelineValor / 100).toFixed(0)}). ${context.cs_em_risco} clientes em risco CS. ${atividadeCount} atividades registradas.`;
      }

      results[empresa] = { ...context, narrative };

      // Save to system_settings
      await supabase.from('system_settings').upsert({
        category: 'reports',
        key: `weekly_report_${empresa}`,
        value: { ...context, narrative, generated_at: now.toISOString() },
      }, { onConflict: 'key' });

      // Notify ADMINs
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('empresa', empresa)
        .eq('role', 'ADMIN')
        .limit(20);

      for (const admin of (admins ?? [])) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          empresa,
          tipo: 'INFO',
          titulo: `📊 Relatório Semanal — ${empresa}`,
          mensagem: narrative.slice(0, 200) + '...',
          link: '/relatorios/executivo',
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
