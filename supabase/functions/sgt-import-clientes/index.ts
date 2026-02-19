import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { cleanContactName } from '../_shared/name-sanitizer.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-import-clientes');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 200;
const SETTINGS_CATEGORY = 'sgt-sync';
const SETTINGS_KEY = 'import-clientes-offset';

// ========================================
// Client detection logic (same as sync)
// ========================================
function isCliente(lead: any, empresa: string): boolean {
  if (lead.venda_realizada === true) return true;
  if (lead.stage_atual === 'Cliente') return true;
  if (empresa === 'TOKENIZA' && lead.tokeniza_investidor === true) return true;
  const status = (lead.cliente_status || '').toLowerCase();
  if (status.includes('ativo') || status.includes('cliente')) return true;
  return false;
}

// ========================================
// Build SGT extras for cs_customers
// ========================================
function buildSgtExtras(lead: any): Record<string, any> {
  const extras: Record<string, any> = {};
  if (lead.tokeniza_valor_investido != null) extras.tokeniza_valor_investido = lead.tokeniza_valor_investido;
  if (lead.tokeniza_qtd_investimentos != null) extras.tokeniza_qtd_investimentos = lead.tokeniza_qtd_investimentos;
  if (lead.tokeniza_projetos) extras.tokeniza_projetos = lead.tokeniza_projetos;
  if (lead.irpf_renda_anual != null) extras.irpf_renda_anual = lead.irpf_renda_anual;
  if (lead.irpf_patrimonio_liquido != null) extras.irpf_patrimonio_liquido = lead.irpf_patrimonio_liquido;
  if (lead.irpf_perfil_investidor) extras.irpf_perfil_investidor = lead.irpf_perfil_investidor;
  if (lead.ga4_engajamento_score != null) extras.ga4_engajamento_score = lead.ga4_engajamento_score;
  if (lead.stape_paginas_visitadas != null) extras.stape_paginas_visitadas = lead.stape_paginas_visitadas;
  if (lead.mautic_score != null) extras.mautic_score = lead.mautic_score;
  if (lead.mautic_tags) extras.mautic_tags = lead.mautic_tags;
  if (lead.cliente_status) extras.cliente_status = lead.cliente_status;
  if (lead.plano_atual) extras.plano_atual = lead.plano_atual;
  return extras;
}

// ========================================
// Build tags for cs_customers
// ========================================
function buildClienteTags(lead: any, empresa: string): string[] {
  const tags: string[] = ['sgt-cliente'];
  if (empresa === 'TOKENIZA') {
    if (lead.tokeniza_investidor) tags.push('tokeniza-investidor');
    if (lead.tokeniza_projetos && Array.isArray(lead.tokeniza_projetos)) {
      lead.tokeniza_projetos.forEach((p: string) => tags.push(`projeto:${p}`));
    }
    if (lead.tokeniza_qtd_investimentos) tags.push(`investimentos:${lead.tokeniza_qtd_investimentos}`);
  }
  if (empresa === 'BLUE') {
    tags.push('blue-cliente');
    if (lead.irpf_perfil_investidor) tags.push(`perfil:${lead.irpf_perfil_investidor}`);
  }
  return tags;
}

// ========================================
// Extract enrichment data
// ========================================
function extractContactEnrichment(lead: any): Record<string, any> {
  const update: Record<string, any> = {};
  if (lead.score_temperatura != null) update.score_marketing = lead.score_temperatura;
  if (lead.linkedin_cargo) update.linkedin_cargo = lead.linkedin_cargo;
  if (lead.linkedin_empresa) update.linkedin_empresa = lead.linkedin_empresa;
  if (lead.linkedin_setor) update.linkedin_setor = lead.linkedin_setor;
  if (lead.linkedin_senioridade) update.linkedin_senioridade = lead.linkedin_senioridade;
  if (lead.linkedin_url) update.linkedin_url = lead.linkedin_url;
  return update;
}

function extractLeadContactEnrichment(lead: any): Record<string, any> {
  const update: Record<string, any> = {};
  if (lead.score_temperatura != null) update.score_marketing = lead.score_temperatura;
  if (lead.linkedin_cargo) update.linkedin_cargo = lead.linkedin_cargo;
  if (lead.linkedin_empresa) update.linkedin_empresa = lead.linkedin_empresa;
  if (lead.linkedin_setor) update.linkedin_setor = lead.linkedin_setor;
  if (lead.linkedin_senioridade) update.linkedin_senioridade = lead.linkedin_senioridade;
  if (lead.linkedin_url) update.linkedin_url = lead.linkedin_url;
  if (lead.mautic_score != null) update.score_mautic = lead.mautic_score;
  if (lead.mautic_page_hits != null) update.mautic_page_hits = lead.mautic_page_hits;
  if (lead.mautic_tags) {
    update.mautic_tags = Array.isArray(lead.mautic_tags) ? lead.mautic_tags : [lead.mautic_tags];
  }
  if (lead.utm_source) update.utm_source = lead.utm_source;
  if (lead.utm_medium) update.utm_medium = lead.utm_medium;
  if (lead.utm_campaign) update.utm_campaign = lead.utm_campaign;
  if (lead.utm_term) update.utm_term = lead.utm_term;
  if (lead.utm_content) update.utm_content = lead.utm_content;

  const extras: Record<string, any> = {};
  if (lead.ga4_engajamento_score != null) extras.ga4_engajamento_score = lead.ga4_engajamento_score;
  if (lead.stape_paginas_visitadas != null) extras.stape_paginas_visitadas = lead.stape_paginas_visitadas;
  if (lead.irpf_renda_anual != null) extras.irpf_renda_anual = lead.irpf_renda_anual;
  if (lead.irpf_patrimonio_liquido != null) extras.irpf_patrimonio_liquido = lead.irpf_patrimonio_liquido;
  if (lead.irpf_perfil_investidor) extras.irpf_perfil_investidor = lead.irpf_perfil_investidor;
  if (lead.tokeniza_valor_investido != null) extras.tokeniza_valor_investido = lead.tokeniza_valor_investido;
  if (lead.tokeniza_qtd_investimentos != null) extras.tokeniza_qtd_investimentos = lead.tokeniza_qtd_investimentos;
  if (lead.tokeniza_projetos) extras.tokeniza_projetos = lead.tokeniza_projetos;
  if (Object.keys(extras).length > 0) update.sgt_dados_extras = extras;

  return update;
}

// ========================================
// Persist offset
// ========================================
async function saveOffset(supabase: any, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: SETTINGS_KEY,
      value: { offset, updated_at: new Date().toISOString() },
      description: 'Offset de paginação do import em massa de clientes SGT',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}

// ========================================
// Main handler
// ========================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const cors = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sgtApiKey = Deno.env.get('SGT_WEBHOOK_SECRET');

    if (!sgtApiKey) {
      log.error('SGT_WEBHOOK_SECRET não configurado');
      return new Response(JSON.stringify({ error: 'SGT_WEBHOOK_SECRET missing' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- Load offset ----
    let offset = 0;
    const { data: offsetRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', SETTINGS_CATEGORY)
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (offsetRow?.value?.offset != null) {
      offset = offsetRow.value.offset;
    }

    // Allow manual reset via body
    try {
      const body = await req.json();
      if (body?.reset_offset === true) {
        offset = 0;
        log.info('Offset resetado manualmente');
      }
      if (body?.offset != null) {
        offset = body.offset;
        log.info(`Offset definido manualmente: ${offset}`);
      }
    } catch { /* no body or invalid json, continue */ }

    // ---- Fetch ALL active contacts (no is_cliente filter) ----
    const { data: contacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, email, telefone, empresa, nome, legacy_lead_id, tags, is_cliente')
      .eq('is_active', true)
      .or('email.neq.null,telefone.neq.null')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchErr) {
      log.error('Erro ao buscar contatos', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!contacts || contacts.length === 0) {
      await saveOffset(supabase, 0);
      log.info('Import completo – todos os contatos processados, offset resetado');
      return new Response(JSON.stringify({
        synced: 0, enriched: 0, message: 'Import completo, offset resetado', offset: 0,
        ciclo_completo: true,
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    log.info(`Processando batch de ${contacts.length} contatos (offset ${offset})`);

    let synced = 0;
    let enriched = 0;
    let errors = 0;
    let skipped = 0;
    const details: any[] = [];
    const now = new Date().toISOString();

    for (const contact of contacts) {
      try {
        const payload: Record<string, string> = {};
        if (contact.email) {
          payload.email = contact.email;
        } else if (contact.telefone) {
          payload.telefone = contact.telefone;
        } else {
          skipped++;
          continue;
        }

        const sgtResponse = await fetch(SGT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': sgtApiKey,
          },
          body: JSON.stringify(payload),
        });

        if (!sgtResponse.ok) {
          log.warn(`SGT retornou ${sgtResponse.status} para contato ${contact.id}`);
          errors++;
          continue;
        }

        const sgtData = await sgtResponse.json();
        // Unwrap: API retorna { found, lead } ou array
        let rawLead: any = null;
        if (sgtData?.found && sgtData?.lead) {
          rawLead = sgtData.lead;
        } else if (Array.isArray(sgtData) && sgtData.length > 0) {
          rawLead = sgtData[0]?.lead ?? sgtData[0];
        } else if (sgtData && !sgtData.found) {
          skipped++;
          continue;
        }
        if (!rawLead) { skipped++; continue; }
        const lead = rawLead;

        // ---- NAME SANITIZATION ----
        const { name: nomeLimpo } = cleanContactName(contact.nome || '');
        if (nomeLimpo && nomeLimpo !== contact.nome) {
          await supabase.from('contacts').update({ nome: nomeLimpo, updated_at: now }).eq('id', contact.id);
        }

        // ---- ENRICHMENT: contacts ----
        const contactUpdate = extractContactEnrichment(lead);
        if (Object.keys(contactUpdate).length > 0) {
          contactUpdate.updated_at = now;
          await supabase.from('contacts').update(contactUpdate).eq('id', contact.id);
          enriched++;
        }

        // ---- ENRICHMENT: lead_contacts ----
        if (contact.legacy_lead_id) {
          const lcUpdate = extractLeadContactEnrichment(lead);
          if (Object.keys(lcUpdate).length > 0) {
            lcUpdate.updated_at = now;
            await supabase
              .from('lead_contacts')
              .update(lcUpdate)
              .eq('lead_id', contact.legacy_lead_id)
              .eq('empresa', contact.empresa);
          }
        }

        // ---- CLIENT DETECTION & CS_CUSTOMER UPSERT ----
        const empresa = contact.empresa as string;
        if (isCliente(lead, empresa)) {
          const existingTags: string[] = contact.tags || [];
          const newTags = buildClienteTags(lead, empresa);
          const mergedTags = [...new Set([...existingTags, ...newTags])];

          // Mark contact as cliente
          if (!contact.is_cliente) {
            await supabase.from('contacts').update({
              is_cliente: true,
              tags: mergedTags,
              updated_at: now,
            }).eq('id', contact.id);
          }

          const valorMrr = lead.valor_venda
            || (empresa === 'TOKENIZA' ? lead.tokeniza_valor_investido : null)
            || 0;
          const dataPrimeiroGanho = lead.data_venda || now;
          const sgtExtras = buildSgtExtras(lead);

          await supabase.from('cs_customers').upsert(
            {
              contact_id: contact.id,
              empresa: empresa,
              is_active: true,
              valor_mrr: valorMrr,
              data_primeiro_ganho: dataPrimeiroGanho,
              tags: newTags,
              sgt_dados_extras: sgtExtras,
              sgt_last_sync_at: now,
            },
            { onConflict: 'contact_id,empresa' }
          );

          synced++;
          details.push({
            contact_id: contact.id,
            nome: contact.nome,
            empresa,
            valor_mrr: valorMrr,
            tags: newTags,
          });
        }
      } catch (contactErr) {
        log.error(`Erro processando contato ${contact.id}`, { error: String(contactErr) });
        errors++;
      }
    }

    // ---- Save offset ----
    const nextOffset = contacts.length < BATCH_SIZE ? 0 : offset + BATCH_SIZE;
    await saveOffset(supabase, nextOffset);

    const result = {
      synced,
      enriched,
      errors,
      skipped,
      total_checked: contacts.length,
      offset_atual: offset,
      proximo_offset: nextOffset,
      ciclo_completo: contacts.length < BATCH_SIZE,
      clientes_encontrados: details,
      timestamp: now,
    };

    log.info('Batch de import concluído', { synced, enriched, errors, skipped, total: contacts.length });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Erro inesperado', { error: String(err) });
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
