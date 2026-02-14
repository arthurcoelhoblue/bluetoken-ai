import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* cron call without body */ }

    const { trigger_type, customer_id } = body;

    // If called with specific trigger+customer, create a run for matching playbooks
    if (trigger_type && customer_id) {
      const result = await createRunsForTrigger(supabase, trigger_type, customer_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRON mode: Phase 1 (auto-detect) + Phase 2 (execute pending steps)
    console.log('[PlaybookRunner] CRON mode — detecting triggers + executing pending steps');

    const phase1 = await autoDetectTriggers(supabase);
    const phase2 = await executePendingSteps(supabase);

    return new Response(JSON.stringify({
      phase1_runs_created: phase1.created,
      phase2_steps_executed: phase2.executed,
      phase2_errors: phase2.errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PlaybookRunner] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Phase 1: Auto-detect triggers ───

async function autoDetectTriggers(supabase: any) {
  let created = 0;

  // 1. NPS Detrator: cs_surveys with nota <= 6 in last 24h without a run
  const { data: detractors } = await supabase
    .from('cs_surveys')
    .select('customer_id, empresa')
    .lte('nota', 6)
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const d of detractors ?? []) {
    created += await createRunIfNew(supabase, 'NPS_DETRACTOR', d.customer_id, d.empresa);
  }

  // 2. Health degraded: cs_health_log where new status is EM_RISCO or CRITICO in last 24h
  const { data: healthDrops } = await supabase
    .from('cs_health_log')
    .select('customer_id, empresa')
    .in('new_status', ['EM_RISCO', 'CRITICO'])
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const h of healthDrops ?? []) {
    created += await createRunIfNew(supabase, 'HEALTH_DEGRADED', h.customer_id, h.empresa);
  }

  // 3. Renewal near: cs_customers with proxima_renovacao <= 60 days
  const sixtyDays = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const { data: renewals } = await supabase
    .from('cs_customers')
    .select('id, empresa')
    .eq('is_active', true)
    .lte('proxima_renovacao', sixtyDays)
    .gt('proxima_renovacao', new Date().toISOString().split('T')[0]);

  for (const r of renewals ?? []) {
    created += await createRunIfNew(supabase, 'RENEWAL_NEAR', r.id, r.empresa);
  }

  // 4. Incident critical: cs_incidents with severidade ALTA or CRITICA in last 24h
  const { data: incidents } = await supabase
    .from('cs_incidents')
    .select('customer_id, empresa')
    .in('severidade', ['ALTA', 'CRITICA'])
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const inc of incidents ?? []) {
    created += await createRunIfNew(supabase, 'INCIDENT_CRITICAL', inc.customer_id, inc.empresa);
  }

  console.log(`[PlaybookRunner] Phase 1: ${created} new runs created`);
  return { created };
}

async function createRunIfNew(supabase: any, triggerType: string, customerId: string, empresa: string): Promise<number> {
  // Check for existing active run of this trigger type for this customer
  const { data: existing } = await supabase
    .from('cs_playbook_runs')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'ATIVA')
    .limit(1);

  if (existing && existing.length > 0) return 0;

  // Find matching active playbook
  const { data: playbooks } = await supabase
    .from('cs_playbooks')
    .select('id, steps')
    .eq('is_active', true)
    .eq('trigger_type', triggerType)
    .eq('empresa', empresa);

  if (!playbooks || playbooks.length === 0) return 0;

  let count = 0;
  for (const pb of playbooks) {
    const { error } = await supabase.from('cs_playbook_runs').insert({
      playbook_id: pb.id,
      customer_id: customerId,
      empresa,
      status: 'ATIVA',
      current_step: 0,
      step_results: [],
      started_at: new Date().toISOString(),
      next_step_at: new Date().toISOString(),
    } as any);
    if (!error) count++;
  }
  return count;
}

async function createRunsForTrigger(supabase: any, triggerType: string, customerId: string) {
  const { data: customer } = await supabase
    .from('cs_customers')
    .select('id, empresa')
    .eq('id', customerId)
    .single();

  if (!customer) return { error: 'Customer not found', created: 0 };

  const created = await createRunIfNew(supabase, triggerType, customerId, customer.empresa);
  // Also execute immediately
  const phase2 = await executePendingSteps(supabase);
  return { created, steps_executed: phase2.executed };
}

// ─── Phase 2: Execute pending steps ───

async function executePendingSteps(supabase: any) {
  const now = new Date().toISOString();

  const { data: runs } = await supabase
    .from('cs_playbook_runs')
    .select('*, cs_playbooks(nome, steps, empresa)')
    .eq('status', 'ATIVA')
    .lte('next_step_at', now)
    .limit(50);

  let executed = 0;
  let errors = 0;

  for (const run of runs ?? []) {
    const playbook = (run as any).cs_playbooks;
    const steps = (playbook?.steps || []) as any[];
    const currentIdx = run.current_step ?? 0;

    if (currentIdx >= steps.length) {
      // All steps done
      await supabase.from('cs_playbook_runs').update({
        status: 'CONCLUIDA',
        completed_at: now,
      } as any).eq('id', run.id);
      continue;
    }

    const step = steps[currentIdx];
    const stepResults = (run.step_results || []) as any[];

    try {
      await executeStep(supabase, step, run.customer_id, playbook?.empresa);
      stepResults.push({ step: currentIdx, type: step.type, status: 'ok', at: now });
      executed++;
    } catch (err) {
      console.error(`[PlaybookRunner] Step error run=${run.id}:`, err);
      stepResults.push({ step: currentIdx, type: step.type, status: 'error', error: String(err), at: now });
      errors++;
    }

    const nextIdx = currentIdx + 1;
    const delayDays = step.delay_days ?? 0;
    const nextAt = new Date(Date.now() + delayDays * 86400000).toISOString();

    if (nextIdx >= steps.length) {
      await supabase.from('cs_playbook_runs').update({
        current_step: nextIdx,
        step_results: stepResults,
        status: 'CONCLUIDA',
        completed_at: now,
      } as any).eq('id', run.id);
    } else {
      await supabase.from('cs_playbook_runs').update({
        current_step: nextIdx,
        step_results: stepResults,
        next_step_at: nextAt,
      } as any).eq('id', run.id);
    }
  }

  console.log(`[PlaybookRunner] Phase 2: ${executed} steps executed, ${errors} errors`);
  return { executed, errors };
}

async function executeStep(supabase: any, step: any, customerId: string, empresa: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
  };

  // Get customer + contact info
  const { data: customer } = await supabase
    .from('cs_customers')
    .select('id, empresa, contact_id, csm_id, valor_mrr, health_score, contacts(nome, primeiro_nome, telefone, email)')
    .eq('id', customerId)
    .single();

  const contact = (customer as any)?.contacts;

  switch (step.type) {
    case 'notification': {
      const targetUserId = step.user_id || customer?.csm_id;
      if (targetUserId) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          empresa,
          tipo: 'CS_PLAYBOOK',
          titulo: step.title || 'Ação de Playbook CS',
          mensagem: step.message || `Ação necessária para ${contact?.nome || customerId}`,
          link: `/cs/clientes/${customerId}`,
        });
      }
      break;
    }

    case 'whatsapp': {
      if (contact?.telefone) {
        const message = (step.template || step.message || '')
          .replace('{{nome}}', contact.primeiro_nome || contact.nome || 'Cliente')
          .replace('{{empresa}}', empresa);
        await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: 'POST', headers,
          body: JSON.stringify({ telefone: contact.telefone, mensagem: message, empresa }),
        });
      }
      break;
    }

    case 'email': {
      if (contact?.email) {
        await fetch(`${supabaseUrl}/functions/v1/email-send`, {
          method: 'POST', headers,
          body: JSON.stringify({
            to: contact.email,
            subject: step.subject || 'Ação CS',
            body: (step.body || step.message || '')
              .replace('{{nome}}', contact.primeiro_nome || contact.nome || 'Cliente'),
            empresa,
          }),
        });
      }
      break;
    }

    case 'survey': {
      await fetch(`${supabaseUrl}/functions/v1/cs-nps-auto`, {
        method: 'POST', headers,
        body: JSON.stringify({ customer_id: customerId, tipo: step.survey_type || 'CSAT' }),
      });
      break;
    }

    case 'health_recalc': {
      await fetch(`${supabaseUrl}/functions/v1/cs-health-calculator`, {
        method: 'POST', headers,
        body: JSON.stringify({ customer_id: customerId }),
      });
      break;
    }

    case 'CRIAR_DEAL_RENOVACAO': {
      // CS-Renovation Bridge (Patch 7 T4)
      if (!customer) break;

      // Find renovation pipeline by tipo (not name) per architecture convention
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id, pipeline_stages(id, posicao, is_won, is_lost)')
        .eq('empresa', empresa)
        .eq('ativo', true)
        .eq('tipo', 'RENOVACAO')
        .limit(1);

      const pipeline = pipelines?.[0];
      if (!pipeline) {
        console.warn('[PlaybookRunner] No renovation pipeline found');
        break;
      }

      const firstStage = ((pipeline as any).pipeline_stages || [])
        .filter((s: any) => !s.is_won && !s.is_lost)
        .sort((a: any, b: any) => a.posicao - b.posicao)[0];

      if (!firstStage) break;

      const dealTitulo = `Renovação: ${contact?.nome || 'Cliente'}`;
      const dealValor = (customer.valor_mrr || 0) * 12;
      const temperatura = (customer.health_score ?? 100) < 50 ? 'FRIO' : 'MORNO';

      const { data: newDeal } = await supabase.from('deals').insert({
        titulo: dealTitulo,
        contact_id: customer.contact_id,
        pipeline_id: pipeline.id,
        stage_id: firstStage.id,
        valor: dealValor,
        temperatura,
        posicao_kanban: 0,
        stage_origem_id: firstStage.id,
        status: 'ABERTO',
        origem: 'AUTO_RENOVACAO',
      }).select('id').single();

      if (newDeal) {
        await supabase.from('deal_stage_history').insert({
          deal_id: newDeal.id,
          to_stage_id: firstStage.id,
        });

        // If health is bad, notify manager
        if ((customer.health_score ?? 100) < 50) {
          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'ADMIN')
            .limit(3);
          for (const admin of admins ?? []) {
            await supabase.from('notifications').insert({
              user_id: admin.id,
              empresa,
              tipo: 'CS_RISCO_RENOVACAO',
              titulo: `⚠️ Renovação em risco: ${contact?.nome}`,
              mensagem: `Health Score ${customer.health_score}%. Deal criado automaticamente.`,
              link: `/pipeline?deal=${newDeal.id}`,
            });
          }
        }
      }
      break;
    }

    default:
      console.warn(`[PlaybookRunner] Unknown step type: ${step.type}`);
  }
}
