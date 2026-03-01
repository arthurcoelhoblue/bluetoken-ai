import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('deal-reconciler');
const corsHeaders = getWebhookCorsHeaders();
const MAX_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createServiceClient();

  try {
    // Buscar falhas pendentes (resolvido = false, tentativas < MAX_ATTEMPTS)
    const { data: failures, error: fetchErr } = await supabase
      .from('deal_creation_failures')
      .select('*')
      .eq('resolvido', false)
      .lt('tentativas', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchErr) {
      log.error('Erro ao buscar falhas pendentes', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!failures || failures.length === 0) {
      log.info('Nenhuma falha pendente para reconciliar');
      return new Response(JSON.stringify({ reconciled: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log.info('Falhas pendentes encontradas', { count: failures.length });

    let reconciled = 0;
    let failed = 0;

    for (const failure of failures) {
      try {
        const result = await tryCreateDeal(supabase, failure);

        if (result.success) {
          await supabase
            .from('deal_creation_failures')
            .update({ resolvido: true, resolved_at: new Date().toISOString() })
            .eq('id', failure.id);
          reconciled++;
          log.info('Falha reconciliada com sucesso', { failureId: failure.id, leadId: failure.lead_id });
        } else {
          const newAttempts = failure.tentativas + 1;
          await supabase
            .from('deal_creation_failures')
            .update({ tentativas: newAttempts, motivo: result.motivo || failure.motivo })
            .eq('id', failure.id);
          failed++;

          // Se atingiu MAX_ATTEMPTS, notificar admins
          if (newAttempts >= MAX_ATTEMPTS) {
            await notifyAdmins(supabase, failure);
          }
        }
      } catch (err) {
        log.error('Erro ao reconciliar falha', { failureId: failure.id, error: String(err) });
        await supabase
          .from('deal_creation_failures')
          .update({ tentativas: failure.tentativas + 1 })
          .eq('id', failure.id);
        failed++;
      }
    }

    log.info('Reconciliação concluída', { reconciled, failed });

    return new Response(JSON.stringify({ reconciled, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Erro inesperado no reconciler', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface FailureRecord {
  id: string;
  lead_id: string;
  empresa: string;
  phone_e164: string | null;
  motivo: string;
  tentativas: number;
}

async function tryCreateDeal(
  supabase: ReturnType<typeof createServiceClient>,
  failure: FailureRecord
): Promise<{ success: boolean; motivo?: string }> {
  const { lead_id, empresa, phone_e164 } = failure;

  // 1. Buscar contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('legacy_lead_id', lead_id)
    .eq('empresa', empresa)
    .maybeSingle();

  if (!contact) {
    return { success: false, motivo: 'CONTACT_NOT_FOUND' };
  }

  const contactId = (contact as { id: string }).id;

  // 2. Verificar se já existe deal ABERTO
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('contact_id', contactId)
    .eq('status', 'ABERTO')
    .limit(1)
    .maybeSingle();

  if (existingDeal) {
    // Deal já existe — marcar como resolvido
    return { success: true };
  }

  // 3. Pipeline default
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('empresa', empresa)
    .eq('is_default', true)
    .maybeSingle();

  if (!pipeline) {
    return { success: false, motivo: 'NO_PIPELINE' };
  }

  const pipelineId = (pipeline as { id: string }).id;

  // 4. Primeiro estágio aberto
  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .eq('is_won', false)
    .eq('is_lost', false)
    .order('posicao', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStage) {
    return { success: false, motivo: 'NO_STAGE' };
  }

  const stageId = (firstStage as { id: string }).id;

  // 5. Título
  const { data: leadInfo } = await supabase
    .from('lead_contacts')
    .select('nome, utm_campaign')
    .eq('lead_id', lead_id)
    .eq('empresa', empresa)
    .maybeSingle();

  const nome = (leadInfo as { nome: string | null; utm_campaign: string | null } | null)?.nome || null;
  const campaign = (leadInfo as { nome: string | null; utm_campaign: string | null } | null)?.utm_campaign || null;

  let titulo: string;
  if (nome && campaign) {
    titulo = `${nome} [${campaign}]`;
  } else if (nome) {
    titulo = nome;
  } else if (campaign) {
    titulo = `Lead WhatsApp [${campaign}]`;
  } else {
    titulo = `Lead WhatsApp ${phone_e164 || 'desconhecido'}`;
  }

  // 6. Round-robin owner
  const { data: sellers } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
    .in('role', ['VENDEDOR', 'ADMIN']);

  let ownerId: string | null = null;

  if (sellers && sellers.length > 0) {
    const sellerIds = (sellers as { id: string }[]).map(s => s.id);

    const { data: accessData } = await supabase
      .from('user_access_assignments')
      .select('user_id')
      .eq('empresa', empresa)
      .in('user_id', sellerIds);

    const validSellerIds = (accessData as { user_id: string }[] | null)?.map(a => a.user_id) ?? [];

    if (validSellerIds.length > 0) {
      const { data: dealCounts } = await supabase
        .from('deals')
        .select('owner_id')
        .eq('status', 'ABERTO')
        .eq('pipeline_id', pipelineId)
        .in('owner_id', validSellerIds);

      const countMap = new Map<string, number>();
      for (const sid of validSellerIds) countMap.set(sid, 0);
      for (const d of (dealCounts as { owner_id: string }[] | null) ?? []) {
        countMap.set(d.owner_id, (countMap.get(d.owner_id) ?? 0) + 1);
      }

      let minCount = Infinity;
      for (const [sid, count] of countMap) {
        if (count < minCount) {
          minCount = count;
          ownerId = sid;
        }
      }
    }
  }

  if (!ownerId) {
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'ADMIN')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    ownerId = (admin as { id: string } | null)?.id ?? null;
  }

  if (!ownerId) {
    return { success: false, motivo: 'NO_OWNER' };
  }

  // 7. Criar deal
  const { error: dealErr } = await supabase
    .from('deals')
    .insert({
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      titulo,
      owner_id: ownerId,
      status: 'ABERTO',
      temperatura: 'FRIO',
    });

  if (dealErr) {
    log.error('Reconciler: erro ao criar deal', { error: dealErr.message, leadId: lead_id });
    return { success: false, motivo: 'INSERT_ERROR' };
  }

  return { success: true };
}

async function notifyAdmins(
  supabase: ReturnType<typeof createServiceClient>,
  failure: FailureRecord
): Promise<void> {
  try {
    // Buscar admins da empresa
    const { data: admins } = await supabase
      .from('user_access_assignments')
      .select('user_id')
      .eq('empresa', failure.empresa);

    if (!admins || admins.length === 0) return;

    const adminUserIds = (admins as { user_id: string }[]).map(a => a.user_id);

    // Filtrar por role ADMIN
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('id', adminUserIds)
      .eq('role', 'ADMIN')
      .eq('is_active', true);

    if (!adminProfiles || adminProfiles.length === 0) return;

    const notifications = (adminProfiles as { id: string }[]).map(admin => ({
      user_id: admin.id,
      empresa: failure.empresa,
      titulo: '⚠️ Lead sem deal vinculado',
      mensagem: `O lead ${failure.lead_id} (${failure.phone_e164 || 'telefone desconhecido'}) falhou na criação automática de deal após ${MAX_ATTEMPTS} tentativas. Motivo: ${failure.motivo}. Ação manual necessária.`,
      tipo: 'ALERTA',
      referencia_tipo: 'LEAD',
      referencia_id: failure.lead_id,
      link: '/conversas',
    }));

    await supabase.from('notifications').insert(notifications);
    log.warn('Notificação enviada para admins', { empresa: failure.empresa, leadId: failure.lead_id, adminCount: notifications.length });
  } catch (err) {
    log.error('Erro ao notificar admins', { error: String(err) });
  }
}
