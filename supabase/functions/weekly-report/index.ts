import { callAI } from "../_shared/ai-provider.ts";

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('weekly-report');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    const { data: configs } = await supabase.from('system_settings').select('empresa').limit(10);
    const empresas = [...new Set((configs ?? []).map((c: { empresa?: string }) => c.empresa).filter(Boolean))];
    if (empresas.length === 0) empresas.push('BLUE', 'TOKENIZA');

    const results: Record<string, Record<string, unknown>> = {};
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekAgoISO = weekAgo.toISOString();

    for (const empresa of empresas) {
      const [dealsGanhosRes, dealsPerdidosRes, dealsAbertosRes, csRiscosRes, atividadesRes, surveysRes] = await Promise.all([
        supabase.from('deals').select('id, titulo, valor, status, contacts!inner(empresa)').eq('contacts.empresa', empresa).eq('status', 'GANHO').gte('updated_at', weekAgoISO).limit(50),
        supabase.from('deals').select('id, titulo, valor, status, motivo_perda, contacts!inner(empresa)').eq('contacts.empresa', empresa).eq('status', 'PERDIDO').gte('updated_at', weekAgoISO).limit(50),
        supabase.from('deals').select('id, valor, contacts!inner(empresa)').eq('contacts.empresa', empresa).eq('status', 'ABERTO'),
        supabase.from('cs_customers').select('id, health_score, health_status, valor_mrr, contacts(nome)').eq('empresa', empresa).in('health_status', ['EM_RISCO', 'CRITICO']).limit(10),
        supabase.from('deal_activities').select('id, tipo').gte('created_at', weekAgoISO).limit(500),
        supabase.from('cs_surveys').select('tipo, nota').eq('empresa', empresa).gte('created_at', weekAgoISO).limit(100),
      ]);

      const dealsGanhos = dealsGanhosRes.data ?? [];
      const dealsPerdidos = dealsPerdidosRes.data ?? [];
      const dealsAbertos = dealsAbertosRes.data ?? [];
      const ganhoValor = dealsGanhos.reduce((s: number, d: { valor?: number }) => s + (d.valor || 0), 0);
      const perdidoValor = dealsPerdidos.reduce((s: number, d: { valor?: number }) => s + (d.valor || 0), 0);
      const pipelineValor = dealsAbertos.reduce((s: number, d: { valor?: number }) => s + (d.valor || 0), 0);
      const npsScores = (surveysRes.data ?? []).filter((s: { tipo: string }) => s.tipo === 'NPS').map((s: { nota: number }) => s.nota);
      const npsAvg = npsScores.length > 0 ? npsScores.reduce((a: number, b: number) => a + b, 0) / npsScores.length : null;

      const context = {
        empresa, periodo: `${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}`,
        deals_ganhos: dealsGanhos.length, valor_ganho: ganhoValor,
        deals_perdidos: dealsPerdidos.length, valor_perdido: perdidoValor,
        pipeline_aberto: dealsAbertos.length, pipeline_valor: pipelineValor,
        cs_em_risco: csRiscosRes.data?.length ?? 0, atividades_semana: atividadesRes.data?.length ?? 0,
        nps_medio: npsAvg, motivos_perda: dealsPerdidos.map((d: { motivo_perda?: string }) => d.motivo_perda).filter(Boolean).slice(0, 5),
      };

      const aiResult = await callAI({
        system: 'Gere relatórios semanais executivos concisos em português.',
        prompt: `Gere um relatório semanal (2-3 parágrafos) para ${empresa}:\n${JSON.stringify(context)}\nSeja direto, mencione números, destaque conquistas, riscos e recomendações. Texto corrido, sem markdown.`,
        functionName: 'weekly-report',
        empresa: empresa as string,
        temperature: 0.4,
        maxTokens: 600,
        supabase,
      });

      const narrative = aiResult.content || `Semana encerrada com ${context.deals_ganhos} deals ganhos (R$ ${(ganhoValor / 100).toFixed(0)}) e ${context.deals_perdidos} perdidos. Pipeline: ${context.pipeline_aberto} deals abertos (R$ ${(pipelineValor / 100).toFixed(0)}). ${context.cs_em_risco} clientes em risco CS. ${context.atividades_semana} atividades registradas.`;

      results[empresa as string] = { ...context, narrative };
      await supabase.from('system_settings').upsert({ category: 'reports', key: `weekly_report_${empresa}`, value: { ...context, narrative, generated_at: now.toISOString() } }, { onConflict: 'key' });

      // Notify admins
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'ADMIN').limit(20);
      const adminUserIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
      if (adminUserIds.length > 0) {
        const { data: adminProfiles } = await supabase.from('profiles').select('id, email, nome').in('id', adminUserIds);
        const { data: assignments } = await supabase.from('user_access_assignments').select('user_id').eq('empresa', empresa).in('user_id', adminUserIds);
        const notifyList = (assignments?.length ?? 0) > 0 ? assignments!.map((a: { user_id: string }) => a.user_id) : adminUserIds;

        for (const adminId of notifyList) {
          await supabase.from('notifications').insert({ user_id: adminId, empresa, tipo: 'INFO', titulo: `📊 Relatório Semanal — ${empresa}`, mensagem: narrative.slice(0, 200) + '...', link: '/relatorios/executivo' });

          const adminProfile = (adminProfiles ?? []).find((p: { id: string }) => p.id === adminId) as { id: string; email?: string; nome?: string } | undefined;
          if (adminProfile?.email) {
            try {
              await supabase.functions.invoke('email-send', {
                body: { to: adminProfile.email, subject: `📊 Relatório Semanal ${empresa} — ${now.toLocaleDateString('pt-BR')}`, html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2>📊 Relatório Semanal — ${empresa}</h2><p style="color:#666">${context.periodo}</p><hr/><div style="display:flex;gap:20px;margin-bottom:16px;"><div style="text-align:center"><strong style="font-size:24px;color:#22c55e">${context.deals_ganhos}</strong><br/><span style="font-size:12px;color:#666">Ganhos</span></div><div style="text-align:center"><strong style="font-size:24px;color:#ef4444">${context.deals_perdidos}</strong><br/><span style="font-size:12px;color:#666">Perdidos</span></div><div style="text-align:center"><strong style="font-size:24px;color:#3b82f6">${context.pipeline_aberto}</strong><br/><span style="font-size:12px;color:#666">Pipeline</span></div><div style="text-align:center"><strong style="font-size:24px;color:#f59e0b">${context.cs_em_risco}</strong><br/><span style="font-size:12px;color:#666">CS Risco</span></div></div><div style="background:#f8f9fa;padding:16px;border-radius:8px"><p style="font-size:14px;line-height:1.6;color:#333">${narrative}</p></div><p style="margin-top:20px;font-size:12px;color:#999">Gerado automaticamente pela Amélia</p></div>` },
              });
            } catch (emailErr) { log.warn('Email failed', { error: emailErr instanceof Error ? emailErr.message : String(emailErr) }); }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    log.error('Weekly report error', { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
