import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from "../_shared/ai-provider.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ─── MODE: PORTFOLIO ───────────────────────────────
    if (body.mode === 'portfolio') {
      const empresa = body.empresa;
      const dias = body.dias ?? 90;
      const cutoff = new Date(Date.now() - dias * 86400000).toISOString();

      const [wonsRes, lostsRes] = await Promise.all([
        supabase.from('deals').select('id, titulo, valor, categoria_perda_closer, motivo_perda_closer, owner_id, stage_id, created_at, fechado_em, pipeline_id, profiles:owner_id(nome), pipeline_stages:stage_id(nome)').eq('status', 'GANHO').gte('fechado_em', cutoff).order('fechado_em', { ascending: false }).limit(200),
        supabase.from('deals').select('id, titulo, valor, categoria_perda_closer, categoria_perda_ia, motivo_perda_closer, motivo_perda_ia, owner_id, stage_id, created_at, fechado_em, pipeline_id, profiles:owner_id(nome), pipeline_stages:stage_id(nome)').eq('status', 'PERDIDO').gte('fechado_em', cutoff).order('fechado_em', { ascending: false }).limit(200),
      ]);

      const wons = wonsRes.data ?? [];
      const losts = lostsRes.data ?? [];

      const summary = {
        periodo_dias: dias, total_ganhos: wons.length, total_perdidos: losts.length,
        win_rate: wons.length + losts.length > 0 ? ((wons.length / (wons.length + losts.length)) * 100).toFixed(1) + '%' : 'N/A',
        valor_ganho: wons.reduce((s: number, d: any) => s + (d.valor || 0), 0),
        valor_perdido: losts.reduce((s: number, d: any) => s + (d.valor || 0), 0),
        vendedores_ganhos: Object.entries(wons.reduce((acc: Record<string, any>, d: any) => { const k = d.owner_id || 'sem_owner'; if (!acc[k]) acc[k] = { nome: (d.profiles as any)?.nome || 'N/A', count: 0, valor: 0 }; acc[k].count++; acc[k].valor += d.valor || 0; return acc; }, {})).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.count - a.count).slice(0, 10),
        vendedores_perdidos: Object.entries(losts.reduce((acc: Record<string, any>, d: any) => { const k = d.owner_id || 'sem_owner'; if (!acc[k]) acc[k] = { nome: (d.profiles as any)?.nome || 'N/A', count: 0, valor: 0 }; acc[k].count++; acc[k].valor += d.valor || 0; return acc; }, {})).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.count - a.count).slice(0, 10),
        categorias_perda: Object.entries(losts.reduce((acc: Record<string, number>, d: any) => { const cat = d.categoria_perda_ia || d.categoria_perda_closer || 'NAO_INFORMADA'; acc[cat] = (acc[cat] || 0) + 1; return acc; }, {})).map(([cat, count]) => ({ categoria: cat, count })).sort((a: any, b: any) => b.count - a.count),
        stages_drop_off: Object.entries(losts.reduce((acc: Record<string, number>, d: any) => { const stage = (d.pipeline_stages as any)?.nome || 'N/A'; acc[stage] = (acc[stage] || 0) + 1; return acc; }, {})).map(([stage, count]) => ({ stage, count })).sort((a: any, b: any) => b.count - a.count),
        ticket_medio_ganho: wons.length > 0 ? Math.round(wons.reduce((s: number, d: any) => s + (d.valor || 0), 0) / wons.length) : 0,
        ticket_medio_perdido: losts.length > 0 ? Math.round(losts.reduce((s: number, d: any) => s + (d.valor || 0), 0) / losts.length) : 0,
      };

      const aiResult = await callAI({
        system: 'Você é um diretor comercial. Analise dados e retorne APENAS JSON válido sem markdown.',
        prompt: `Analise o portfólio dos últimos ${dias} dias:\n${JSON.stringify(summary, null, 2)}\n\nRetorne JSON: {"resumo_executivo":"...","padroes_sucesso":[...],"padroes_perda":[...],"drop_off_critico":"...","recomendacoes":[...],"vendedor_destaque":"...","vendedor_atencao":"..."}`,
        functionName: 'deal-loss-analysis',
        maxTokens: 2000,
        supabase,
      });

      let analysis: any = {};
      try { analysis = JSON.parse(aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { analysis = { resumo_executivo: aiResult.content }; }

      await supabase.from('system_settings').upsert({ category: 'analytics', key: 'win_loss_analysis', value: { ...analysis, summary, generated_at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'category,key' });

      return new Response(JSON.stringify({ success: true, analysis, summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── MODE: INDIVIDUAL ─────────────
    const { deal_id } = body;
    if (!deal_id) return new Response(JSON.stringify({ error: 'deal_id or mode=portfolio required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: deal, error: dealErr } = await supabase.from('deals').select('*, contacts:contact_id(id, nome, legacy_lead_id)').eq('id', deal_id).single();
    if (dealErr || !deal) return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const leadId = (deal as any).contacts?.legacy_lead_id;
    let messages: any[] = [];
    if (leadId) {
      const { data: msgs } = await supabase.from('lead_messages').select('direcao, conteudo, created_at').eq('lead_id', leadId).order('created_at', { ascending: true }).limit(50);
      messages = msgs ?? [];
    }

    if (messages.length === 0) {
      await supabase.from('deals').update({ motivo_perda_ia: 'Sem histórico de conversas para análise', categoria_perda_ia: deal.categoria_perda_closer, motivo_perda_final: deal.motivo_perda_closer, categoria_perda_final: deal.categoria_perda_closer, perda_resolvida: true }).eq('id', deal_id);
      return new Response(JSON.stringify({ success: true, auto_resolved: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const transcript = messages.map((m: any) => `[${m.direcao === 'INBOUND' ? 'LEAD' : 'SDR'}]: ${m.conteudo}`).join('\n');

    const aiResult = await callAI({
      system: 'Você é um analista comercial. Retorne APENAS JSON válido sem markdown.',
      prompt: `Analise o histórico abaixo de um deal perdido.\n\nHistórico:\n${transcript}\n\nMotivo informado: ${deal.motivo_perda_closer || 'Não informado'}\nCategoria informada: ${deal.categoria_perda_closer || 'Não informada'}\n\nIdentifique o motivo real. JSON: {"categoria":"PRECO|CONCORRENCIA|TIMING|SEM_NECESSIDADE|SEM_RESPOSTA|PRODUTO_INADEQUADO|OUTRO","explicacao":"2-3 frases"}`,
      functionName: 'deal-loss-analysis',
      maxTokens: 500,
      supabase,
    });

    let categoria_ia = 'OUTRO';
    let explicacao_ia = aiResult.content;
    try {
      const parsed = JSON.parse(aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      categoria_ia = parsed.categoria || 'OUTRO';
      explicacao_ia = parsed.explicacao || aiResult.content;
    } catch { /* use raw text */ }

    const match = categoria_ia === deal.categoria_perda_closer;
    const updates: Record<string, unknown> = { motivo_perda_ia: explicacao_ia, categoria_perda_ia: categoria_ia };
    if (match) { updates.motivo_perda_final = deal.motivo_perda_closer; updates.categoria_perda_final = deal.categoria_perda_closer; updates.motivo_perda = deal.motivo_perda_closer; updates.perda_resolvida = true; }
    await supabase.from('deals').update(updates).eq('id', deal_id);

    return new Response(JSON.stringify({ success: true, categoria_ia, match, auto_resolved: match }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
