import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SDR Action Executor — executes side-effects: pause cadence, create closer task, escalate, etc.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { lead_id, empresa, acao_recomendada, intent, temperatura, confidence, contato, deals, urgencia } = body;

    const actionsExecuted: string[] = [];

    // 1. PAUSAR/CANCELAR CADÊNCIA
    if (acao_recomendada === 'PAUSAR_CADENCIA' || acao_recomendada === 'CANCELAR_CADENCIA') {
      const status = acao_recomendada === 'PAUSAR_CADENCIA' ? 'PAUSADA' : 'CANCELADA';
      const { data: activeRuns } = await supabase.from('cadence_runs')
        .select('id').eq('lead_id', lead_id).eq('status', 'ATIVA').limit(5);
      
      if (activeRuns && activeRuns.length > 0) {
        for (const run of activeRuns) {
          await supabase.from('cadence_runs').update({ status }).eq('id', run.id);
        }
        actionsExecuted.push(`Cadência ${status.toLowerCase()} (${activeRuns.length} runs)`);
      }
    }

    // 2. CRIAR TAREFA CLOSER
    if (acao_recomendada === 'CRIAR_TAREFA_CLOSER' || (urgencia?.detectado && urgencia.confianca === 'ALTA')) {
      const dealId = deals?.[0]?.id;
      if (dealId) {
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          tipo: 'TAREFA',
          descricao: `⚡ Lead quente — ${intent} (confiança: ${Math.round(confidence * 100)}%). ${urgencia?.frase_gatilho ? `Gatilho: "${urgencia.frase_gatilho}"` : ''} Contatar imediatamente.`,
          tarefa_concluida: false,
          metadata: { source: 'sdr-action-executor', intent, urgencia },
        });
        actionsExecuted.push('Tarefa closer criada');
      }

      // Notify closer
      try {
        await supabase.from('closer_notifications').insert({
          lead_id,
          empresa,
          motivo: `Lead quente: ${intent} — ${contato?.nome || 'Lead'}`,
          contexto: { intent, confidence, temperatura, urgencia },
        });
        actionsExecuted.push('Closer notificado');
      } catch { /* ignore */ }
    }

    // 3. ESCALAR HUMANO
    if (acao_recomendada === 'ESCALAR_HUMANO' || urgencia?.tipo === 'PEDIDO_HUMANO') {
      await supabase.from('lead_conversation_state')
        .update({ modo: 'MANUAL' })
        .eq('lead_id', lead_id)
        .eq('empresa', empresa);
      actionsExecuted.push('Modo manual ativado (escalado para humano)');
    }

    // 4. MARCAR OPT-OUT
    if (acao_recomendada === 'MARCAR_OPT_OUT' || intent === 'OPT_OUT') {
      // Pause all cadences
      const { data: activeRuns } = await supabase.from('cadence_runs')
        .select('id').eq('lead_id', lead_id).eq('status', 'ATIVA');
      if (activeRuns) {
        for (const run of activeRuns) {
          await supabase.from('cadence_runs').update({ status: 'CANCELADA' }).eq('id', run.id);
        }
      }

      // Mark contact opt-out if exists
      if (contato?.telefone) {
        await supabase.from('contacts')
          .update({ opt_out: true, opt_out_em: new Date().toISOString(), opt_out_motivo: 'SDR IA - Lead solicitou' })
          .eq('telefone', contato.telefone).eq('empresa', empresa);
      }
      actionsExecuted.push('Opt-out registrado, cadências canceladas');
    }

    // 5. AJUSTAR TEMPERATURA
    if (acao_recomendada === 'AJUSTAR_TEMPERATURA' && temperatura) {
      await supabase.from('lead_classifications')
        .update({ temperatura })
        .eq('lead_id', lead_id).eq('empresa', empresa);
      actionsExecuted.push(`Temperatura ajustada para ${temperatura}`);
    }

    console.log(`[sdr-action-executor] Lead ${lead_id}: ${actionsExecuted.join(', ') || 'nenhuma ação'}`);

    return new Response(JSON.stringify({ success: true, actions_executed: actionsExecuted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sdr-action-executor] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
