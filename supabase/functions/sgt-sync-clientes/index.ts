import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { cleanContactName } from '../_shared/name-sanitizer.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-sync-clientes');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 100;
const SETTINGS_CATEGORY = 'sgt-sync';
const SETTINGS_KEY = 'sync-clientes-offset';

// ========================================
// Client detection logic
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
// Extract enrichment data from SGT lead
// ========================================
function extractContactEnrichment(lead: any): Record<string, any> {
  const update: Record<string, any> = {};

  // Score
  if (lead.score_temperatura != null) update.score_marketing = lead.score_temperatura;

  // LinkedIn
  if (lead.linkedin_cargo) update.linkedin_cargo = lead.linkedin_cargo;
  if (lead.linkedin_empresa) update.linkedin_empresa = lead.linkedin_empresa;
  if (lead.linkedin_setor) update.linkedin_setor = lead.linkedin_setor;
  if (lead.linkedin_senioridade) update.linkedin_senioridade = lead.linkedin_senioridade;
  if (lead.linkedin_url) update.linkedin_url = lead.linkedin_url;

  return update;
}

function extractLeadContactEnrichment(lead: any): Record<string, any> {
  const update: Record<string, any> = {};

  // Score & LinkedIn (mirror to lead_contacts too)
  if (lead.score_temperatura != null) update.score_marketing = lead.score_temperatura;
  if (lead.linkedin_cargo) update.linkedin_cargo = lead.linkedin_cargo;
  if (lead.linkedin_empresa) update.linkedin_empresa = lead.linkedin_empresa;
  if (lead.linkedin_setor) update.linkedin_setor = lead.linkedin_setor;
  if (lead.linkedin_senioridade) update.linkedin_senioridade = lead.linkedin_senioridade;
  if (lead.linkedin_url) update.linkedin_url = lead.linkedin_url;

  // Mautic
  if (lead.mautic_score != null) update.score_mautic = lead.mautic_score;
  if (lead.mautic_page_hits != null) update.mautic_page_hits = lead.mautic_page_hits;
  if (lead.mautic_tags) {
    const tags = Array.isArray(lead.mautic_tags) ? lead.mautic_tags : [lead.mautic_tags];
    update.mautic_tags = tags;
  }

  // UTMs
  if (lead.utm_source) update.utm_source = lead.utm_source;
  if (lead.utm_medium) update.utm_medium = lead.utm_medium;
  if (lead.utm_campaign) update.utm_campaign = lead.utm_campaign;
  if (lead.utm_term) update.utm_term = lead.utm_term;
  if (lead.utm_content) update.utm_content = lead.utm_content;

  // Extra data bucket (GA4, Stape, Blue IRPF, Tokeniza details)
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

    // ---- Load offset from system_settings ----
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

    // ---- Fetch contacts not yet marked as clients ----
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
      // Reset offset for next full cycle
      await saveOffset(supabase, 0);
      log.info('Ciclo completo – nenhum contato pendente, offset resetado');
      return new Response(JSON.stringify({ synced: 0, enriched: 0, message: 'Ciclo completo, offset resetado', offset: 0 }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    log.info(`Processando ${contacts.length} contatos (offset ${offset})`);

    let synced = 0;
    let enriched = 0;
    let errors = 0;
    const details: any[] = [];

    for (const contact of contacts) {
      try {
        // Build search payload
        const payload: Record<string, string> = {};
        if (contact.email) {
          payload.email = contact.email;
        } else if (contact.telefone) {
          payload.telefone = contact.telefone;
        } else {
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
          continue;
        }
        if (!rawLead) continue;
        const lead = rawLead;

        // ---- NAME SANITIZATION ----
        const { name: nomeLimpo } = cleanContactName(contact.nome || '');
        if (nomeLimpo && nomeLimpo !== contact.nome) {
          await supabase.from('contacts').update({ nome: nomeLimpo, updated_at: new Date().toISOString() }).eq('id', contact.id);
        }

        // ---- ENRICHMENT: contacts ----
        const contactUpdate = extractContactEnrichment(lead);
        if (Object.keys(contactUpdate).length > 0) {
          contactUpdate.updated_at = new Date().toISOString();
          await supabase.from('contacts').update(contactUpdate).eq('id', contact.id);
          enriched++;
        }

        // ---- ENRICHMENT: lead_contacts (if legacy_lead_id exists) ----
        if (contact.legacy_lead_id) {
          const lcUpdate = extractLeadContactEnrichment(lead);
          if (Object.keys(lcUpdate).length > 0) {
            lcUpdate.updated_at = new Date().toISOString();
            await supabase
              .from('lead_contacts')
              .update(lcUpdate)
              .eq('lead_id', contact.legacy_lead_id)
              .eq('empresa', contact.empresa);
          }
        }

        // ---- CLIENT DETECTION ----
        const empresa = contact.empresa as string;
        if (isCliente(lead, empresa)) {
          log.info(`Contato ${contact.id} (${contact.nome}) identificado como cliente no SGT`);

          // Merge tags
          const existingTags: string[] = contact.tags || [];
          const newTags = buildClienteTags(lead, empresa);
          const mergedTags = [...new Set([...existingTags, ...newTags])];

          // Update contact only if not already marked
          if (!contact.is_cliente) {
            await supabase
              .from('contacts')
              .update({
                is_cliente: true,
                tags: mergedTags,
                updated_at: new Date().toISOString(),
              })
              .eq('id', contact.id);
          }

          // Determine financial values
          const valorMrr = lead.valor_venda
            || (empresa === 'TOKENIZA' ? lead.tokeniza_valor_investido : null)
            || 0;
          const dataPrimeiroGanho = lead.data_venda || new Date().toISOString();

          // Build SGT extras
          const sgtExtras: Record<string, any> = {};
          if (lead.tokeniza_valor_investido != null) sgtExtras.tokeniza_valor_investido = lead.tokeniza_valor_investido;
          if (lead.tokeniza_qtd_investimentos != null) sgtExtras.tokeniza_qtd_investimentos = lead.tokeniza_qtd_investimentos;
          if (lead.tokeniza_projetos) sgtExtras.tokeniza_projetos = lead.tokeniza_projetos;
          if (lead.irpf_renda_anual != null) sgtExtras.irpf_renda_anual = lead.irpf_renda_anual;
          if (lead.irpf_patrimonio_liquido != null) sgtExtras.irpf_patrimonio_liquido = lead.irpf_patrimonio_liquido;
          if (lead.irpf_perfil_investidor) sgtExtras.irpf_perfil_investidor = lead.irpf_perfil_investidor;
          if (lead.ga4_engajamento_score != null) sgtExtras.ga4_engajamento_score = lead.ga4_engajamento_score;
          if (lead.stape_paginas_visitadas != null) sgtExtras.stape_paginas_visitadas = lead.stape_paginas_visitadas;
          if (lead.mautic_score != null) sgtExtras.mautic_score = lead.mautic_score;
          if (lead.mautic_tags) sgtExtras.mautic_tags = lead.mautic_tags;
          if (lead.cliente_status) sgtExtras.cliente_status = lead.cliente_status;
          if (lead.plano_atual) sgtExtras.plano_atual = lead.plano_atual;

          // Upsert cs_customers with SGT extras
          await supabase.from('cs_customers').upsert(
            {
              contact_id: contact.id,
              empresa: empresa,
              is_active: true,
              valor_mrr: valorMrr,
              data_primeiro_ganho: dataPrimeiroGanho,
              tags: newTags,
              sgt_dados_extras: sgtExtras,
              sgt_last_sync_at: new Date().toISOString(),
            },
            { onConflict: 'contact_id,empresa' }
          );

          // ---- UPSERT TOKENIZA INVESTMENTS AS CS_CONTRACTS ----
          if (empresa === 'TOKENIZA' && lead.tokeniza_investimentos && Array.isArray(lead.tokeniza_investimentos)) {
            const { data: csCustomer } = await supabase
              .from('cs_customers')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('empresa', 'TOKENIZA')
              .maybeSingle();

            if (csCustomer) {
              for (const inv of lead.tokeniza_investimentos) {
                const invDate = new Date(inv.data);
                const anoFiscal = isNaN(invDate.getTime()) ? new Date().getFullYear() : invDate.getFullYear();
                const statusMap: Record<string, string> = { FINISHED: 'ATIVO', PAID: 'ATIVO', PENDING: 'PENDENTE', CANCELLED: 'CANCELADO' };
                await supabase.from('cs_contracts').upsert(
                  {
                    customer_id: csCustomer.id,
                    empresa: 'TOKENIZA',
                    ano_fiscal: anoFiscal,
                    plano: inv.oferta_nome || 'Investimento',
                    oferta_id: inv.oferta_id,
                    oferta_nome: inv.oferta_nome,
                    tipo: inv.tipo || 'crowdfunding',
                    valor: inv.valor || 0,
                    data_contratacao: inv.data || null,
                    status: statusMap[(inv.status || '').toUpperCase()] || 'ATIVO',
                    notas: 'Importado do SGT',
                  },
                  { onConflict: 'customer_id,ano_fiscal,oferta_id' }
                );
              }
              log.info(`${lead.tokeniza_investimentos.length} investimentos upserted para contato ${contact.id}`);
            }
          }

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

    // ---- Save offset for next run ----
    const nextOffset = contacts.length < BATCH_SIZE ? 0 : offset + BATCH_SIZE;
    await saveOffset(supabase, nextOffset);

    const result = {
      synced,
      enriched,
      errors,
      total_checked: contacts.length,
      offset_atual: offset,
      proximo_offset: nextOffset,
      ciclo_completo: contacts.length < BATCH_SIZE,
      clientes_encontrados: details,
      timestamp: new Date().toISOString(),
    };

    log.info('Sync concluída', { synced, enriched, errors, total: contacts.length });

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

// ========================================
// Persist offset in system_settings
// ========================================
async function saveOffset(supabase: any, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: SETTINGS_KEY,
      value: { offset, updated_at: new Date().toISOString() },
      description: 'Offset de paginação do sync de clientes SGT',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}
