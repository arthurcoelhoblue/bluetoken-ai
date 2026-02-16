import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-playbook-runner');
const corsHeaders = getWebhookCorsHeaders();

interface PlaybookStep {
  type: string;
  title?: string;
  message?: string;
  template?: string;
  subject?: string;
  body?: string;
  user_id?: string;
  survey_type?: string;
  delay_days?: number;
}

interface StepResult {
  step: number;
  type: string;
  status: string;
  error?: string;
  at: string;
}

interface PipelineStageRow {
  id: string;
  posicao: number;
  is_won: boolean;
  is_lost: boolean;
}

interface ContactRow {
  nome: string | null;
  primeiro_nome: string | null;
  telefone: string | null;
  email: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* cron call without body */ }

    const { trigger_type, customer_id } = body as { trigger_type?: string; customer_id?: string };

    if (trigger_type && customer_id) {
      const result = await createRunsForTrigger(supabase, trigger_type, customer_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Phase 1: Auto-detect triggers ───

async function autoDetectTriggers(supabase: SupabaseClient) {
  let created = 0;

  const { data: detractors } = await supabase
    .from('cs_surveys')
    .select('customer_id, empresa')
    .lte('nota', 6)
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const d of detractors ?? []) {
    created += await createRunIfNew(supabase, 'NPS_DETRACTOR', d.customer_id, d.empresa);
  }

  const { data: healthDrops } = await supabase
    .from('cs_health_log')
    .select('customer_id, empresa')
    .in('new_status', ['EM_RISCO', 'CRITICO'])
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const h of healthDrops ?? []) {
    created += await createRunIfNew(supabase, 'HEALTH_DEGRADED', h.customer_id, h.empresa);
  }

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

  const { data: incidents } = await supabase
    .from('cs_incidents')
    .select('customer_id, empresa')
    .in('gravidade', ['ALTA', 'CRITICA'])
    .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

  for (const inc of incidents ?? []) {
    created += await createRunIfNew(supabase, 'INCIDENT_CRITICAL', inc.customer_id, inc.empresa);
  }

  console.log(`[PlaybookRunner] Phase 1: ${created} new runs created`);
  return { created };
}

async function createRunIfNew(supabase: SupabaseClient, triggerType: string, customerId: string, empresa: string): Promise<number> {
  const { data: existing } = await supabase
    .from('cs_playbook_runs')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'ATIVA')
    .limit(1);

  if (existing && existing.length > 0) return 0;

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
    } as Record<string, unknown>);
    if (!error) count++;
  }
  return count;
}

async function createRunsForTrigger(supabase: SupabaseClient, triggerType: string, customerId: string) {
  const { data: customer } = await supabase
    .from('cs_customers')
    .select('id, empresa')
    .eq('id', customerId)
    .single();

  if (!customer) return { error: 'Customer not found', created: 0 };

  const created = await createRunIfNew(supabase, triggerType, customerId, customer.empresa);
  const phase2 = await executePendingSteps(supabase);
  return { created, steps_executed: phase2.executed };
}

// ─── Phase 2: Execute pending steps ───

async function executePendingSteps(supabase: SupabaseClient) {
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
    const playbook = run.cs_playbooks as { nome: string; steps: PlaybookStep[]; empresa: string } | null;
    const steps = (playbook?.steps || []) as PlaybookStep[];
    const currentIdx = run.current_step ?? 0;

    if (currentIdx >= steps.length) {
      await supabase.from('cs_playbook_runs').update({
        status: 'CONCLUIDA',
        completed_at: now,
      } as Record<string, unknown>).eq('id', run.id);
      continue;
    }

    const step = steps[currentIdx];
    const stepResults = (run.step_results || []) as StepResult[];

    try {
      await executeStep(supabase, step, run.customer_id, playbook?.empresa ?? '');
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
      } as Record<string, unknown>).eq('id', run.id);
    } else {
      await supabase.from('cs_playbook_runs').update({
        current_step: nextIdx,
        step_results: stepResults,
        next_step_at: nextAt,
      } as Record<string, unknown>).eq('id', run.id);
    }
  }

  console.log(`[PlaybookRunner] Phase 2: ${executed} steps executed, ${errors} errors`);
  return { executed, errors };
}

async function executeStep(supabase: SupabaseClient, step: PlaybookStep, customerId: string, empresa: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
  };

  const { data: customer } = await supabase
    .from('cs_customers')
    .select('id, empresa, contact_id, csm_id, valor_mrr, health_score, contacts(nome, primeiro_nome, telefone, email)')
    .eq('id', customerId)
    .single();

  const contact = (customer?.contacts ?? null) as ContactRow | null;

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
      if (!customer) break;

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

      const stages = (pipeline.pipeline_stages || []) as PipelineStageRow[];
      const firstStage = stages
        .filter((s) => !s.is_won && !s.is_lost)
        .sort((a, b) => a.posicao - b.posicao)[0];

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

        if ((customer.health_score ?? 100) < 50) {
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'ADMIN')
            .limit(3);
          for (const admin of admins ?? []) {
            await supabase.from('notifications').insert({
              user_id: admin.user_id,
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
