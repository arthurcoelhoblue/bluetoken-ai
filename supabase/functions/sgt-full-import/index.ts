import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { cleanContactName } from '../_shared/name-sanitizer.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-full-import');

// SGT endpoint that lists all clients paginated by company
const SGT_LIST_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/listar-clientes-api';
const BATCH_SIZE = 200;
const SETTINGS_CATEGORY = 'sgt-full-import';

// ========================================
// Client qualification logic
// ========================================
function isClienteElegivel(lead: any, empresa: string): boolean {
  if (empresa === 'BLUE') {
    if (lead.plano_ativo === true) return true;
    if (lead.venda_realizada === true) return true;
    const stage = (lead.stage_atual || '').toLowerCase();
    if (stage === 'vendido' || stage === 'cliente') return true;
    const status = (lead.cliente_status || '').toLowerCase();
    if (status.includes('ativo')) return true;
    return false;
  }
  if (empresa === 'TOKENIZA') {
    if (lead.tokeniza_investidor === true) return true;
    // Must have at least one PAID or FINISHED investment
    const investimentos = lead.dados_tokeniza?.investimentos || lead.investimentos || [];
    if (Array.isArray(investimentos)) {
      const temInvestimentoRealizado = investimentos.some((inv: any) => {
        const s = (inv.status || '').toUpperCase();
        return s === 'PAID' || s === 'FINISHED';
      });
      if (temInvestimentoRealizado) return true;
    }
    return false;
  }
  return false;
}

// ========================================
// Build SGT extras payload
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
  if (lead.plano_ativo != null) extras.plano_ativo = lead.plano_ativo;
  if (lead.stage_atual) extras.stage_atual = lead.stage_atual;
  return extras;
}

// ========================================
// Build customer tags
// ========================================
function buildClienteTags(lead: any, empresa: string): string[] {
  const tags: string[] = ['sgt-cliente', 'sgt-full-import'];
  if (empresa === 'TOKENIZA') {
    tags.push('tokeniza-investidor');
    if (lead.tokeniza_projetos && Array.isArray(lead.tokeniza_projetos)) {
      lead.tokeniza_projetos.forEach((p: string) => tags.push(`projeto:${p}`));
    }
    if (lead.tokeniza_qtd_investimentos) tags.push(`investimentos:${lead.tokeniza_qtd_investimentos}`);
  }
  if (empresa === 'BLUE') {
    tags.push('blue-cliente');
    if (lead.plano_ativo) tags.push('plano-ativo');
    if (lead.irpf_perfil_investidor) tags.push(`perfil:${lead.irpf_perfil_investidor}`);
  }
  return tags;
}

// ========================================
// Save offset for this empresa
// ========================================
async function saveOffset(supabase: any, empresa: string, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: empresa.toLowerCase(),
      value: { offset, updated_at: new Date().toISOString() },
      description: `Offset de importação completa SGT para ${empresa}`,
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

    // ---- Parse request body ----
    let empresa: 'BLUE' | 'TOKENIZA' = 'BLUE';
    let resetOffset = false;
    let manualOffset: number | null = null;

    try {
      const body = await req.json();
      if (body?.empresa) empresa = body.empresa.toUpperCase() as 'BLUE' | 'TOKENIZA';
      if (body?.reset_offset === true) resetOffset = true;
      if (body?.offset != null) manualOffset = Number(body.offset);
    } catch { /* no body */ }

    if (empresa !== 'BLUE' && empresa !== 'TOKENIZA') {
      return new Response(JSON.stringify({ error: 'empresa deve ser BLUE ou TOKENIZA' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ---- Load offset ----
    let offset = 0;
    if (!resetOffset) {
      const { data: offsetRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', SETTINGS_CATEGORY)
        .eq('key', empresa.toLowerCase())
        .maybeSingle();

      if (offsetRow?.value?.offset != null) {
        offset = offsetRow.value.offset;
      }
    }

    if (manualOffset !== null) {
      offset = manualOffset;
    }

    log.info(`Iniciando import ${empresa} — offset ${offset}, batch ${BATCH_SIZE}`);

    // ---- Call SGT listar-clientes-api ----
    const sgtUrl = `${SGT_LIST_API_URL}?empresa=${empresa}&limit=${BATCH_SIZE}&offset=${offset}`;
    const sgtResponse = await fetch(sgtUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': sgtApiKey,
      },
    });

    if (!sgtResponse.ok) {
      const errText = await sgtResponse.text();
      log.error(`SGT retornou ${sgtResponse.status}`, { body: errText });
      return new Response(JSON.stringify({ error: `SGT error ${sgtResponse.status}`, details: errText }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const sgtData = await sgtResponse.json();

    // SGT may return { clientes: [...], total: N } or directly an array
    let clientes: any[] = [];
    let totalSgt: number | null = null;

    if (Array.isArray(sgtData)) {
      clientes = sgtData;
    } else if (Array.isArray(sgtData?.clientes)) {
      clientes = sgtData.clientes;
      totalSgt = sgtData.total ?? null;
    } else if (Array.isArray(sgtData?.data)) {
      clientes = sgtData.data;
      totalSgt = sgtData.total ?? null;
    }

    log.info(`SGT retornou ${clientes.length} clientes (offset ${offset})`);

    // ---- Cycle complete? ----
    if (clientes.length === 0) {
      await saveOffset(supabase, empresa, 0);
      return new Response(JSON.stringify({
        processados: 0,
        novos_contatos: 0,
        novos_cs_customers: 0,
        novos_contratos: 0,
        ignorados: 0,
        erros: 0,
        proximo_offset: 0,
        ciclo_completo: true,
        total_sgt: totalSgt,
        empresa,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ---- Process each client ----
    let novosContatos = 0;
    let novosCsCustomers = 0;
    let novosContratos = 0;
    let ignorados = 0;
    let erros = 0;
    const now = new Date().toISOString();

    for (const clienteRaw of clientes) {
      try {
        // SGT may nest the lead under a "lead" key or return flat
        const lead = clienteRaw?.lead ?? clienteRaw;

        if (!lead || (!lead.email && !lead.telefone && !lead.lead_id)) {
          ignorados++;
          continue;
        }

        // ---- Qualification check ----
        if (!isClienteElegivel(lead, empresa)) {
          ignorados++;
          continue;
        }

        const leadId = lead.lead_id || lead.id;
        const email = lead.email || null;
        const telefone = lead.telefone || null;
        const { name: nomeLimpo } = cleanContactName(lead.nome || lead.name || `Lead ${leadId}`);

        // ---- 1. Upsert lead_contacts (bridge table) ----
        if (leadId) {
          await supabase.from('lead_contacts').upsert(
            {
              lead_id: leadId,
              empresa: empresa,
              nome: nomeLimpo,
              email,
              telefone,
              updated_at: now,
            },
            { onConflict: 'lead_id,empresa', ignoreDuplicates: false }
          );
        }

        // ---- 2. Upsert contacts (keyed by legacy_lead_id) ----
        let contactId: string | null = null;

        if (leadId) {
          // Try to find existing contact by legacy_lead_id first
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id, is_cliente, tags')
            .eq('legacy_lead_id', leadId)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            // Try by email
            if (email) {
              const { data: emailContact } = await supabase
                .from('contacts')
                .select('id, is_cliente, tags')
                .eq('email', email)
                .eq('empresa', empresa)
                .maybeSingle();
              if (emailContact) {
                contactId = emailContact.id;
                // Link legacy_lead_id
                await supabase.from('contacts').update({ legacy_lead_id: leadId, updated_at: now }).eq('id', contactId);
              }
            }

            if (!contactId) {
              // Create new contact
              const { data: newContact, error: insertErr } = await supabase
                .from('contacts')
                .insert({
                  legacy_lead_id: leadId,
                  empresa: empresa,
                  nome: nomeLimpo,
                  email,
                  telefone,
                  is_active: true,
                  is_cliente: true,
                  canal_origem: 'SGT',
                  tipo: 'CLIENTE',
                  linkedin_cargo: lead.linkedin_cargo || null,
                  linkedin_empresa: lead.linkedin_empresa || null,
                  linkedin_setor: lead.linkedin_setor || null,
                  linkedin_senioridade: lead.linkedin_senioridade || null,
                  linkedin_url: lead.linkedin_url || null,
                  score_marketing: lead.score_temperatura || null,
                })
                .select('id')
                .single();

              if (insertErr) {
                log.warn(`Erro ao inserir contato para lead ${leadId}`, { error: insertErr.message });
                erros++;
                continue;
              }

              contactId = newContact.id;
              novosContatos++;
            }
          }
        } else if (email) {
          // No leadId — try by email
          const { data: emailContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', email)
            .eq('empresa', empresa)
            .maybeSingle();

          if (emailContact) {
            contactId = emailContact.id;
          } else {
            const { data: newContact } = await supabase
              .from('contacts')
              .insert({
                empresa,
                nome: nomeLimpo,
                email,
                telefone,
                is_active: true,
                is_cliente: true,
                canal_origem: 'SGT',
                tipo: 'CLIENTE',
              })
              .select('id')
              .single();
            contactId = newContact?.id ?? null;
            if (contactId) novosContatos++;
          }
        }

        if (!contactId) {
          ignorados++;
          continue;
        }

        // ---- Update contact enrichment data ----
        const contactEnrich: Record<string, any> = {
          is_cliente: true,
          updated_at: now,
        };
        if (lead.linkedin_cargo) contactEnrich.linkedin_cargo = lead.linkedin_cargo;
        if (lead.linkedin_empresa) contactEnrich.linkedin_empresa = lead.linkedin_empresa;
        if (lead.linkedin_setor) contactEnrich.linkedin_setor = lead.linkedin_setor;
        if (lead.linkedin_senioridade) contactEnrich.linkedin_senioridade = lead.linkedin_senioridade;
        if (lead.linkedin_url) contactEnrich.linkedin_url = lead.linkedin_url;
        if (lead.score_temperatura != null) contactEnrich.score_marketing = lead.score_temperatura;

        await supabase.from('contacts').update(contactEnrich).eq('id', contactId);

        // ---- 3. Upsert cs_customers ----
        const sgtExtras = buildSgtExtras(lead);
        const tags = buildClienteTags(lead, empresa);

        const investimentos = lead.dados_tokeniza?.investimentos || lead.investimentos || [];
        const valorMrr = lead.valor_venda
          || (empresa === 'TOKENIZA' && lead.tokeniza_valor_investido ? lead.tokeniza_valor_investido : null)
          || 0;
        const dataPrimeiroGanho = lead.data_venda || lead.data_primeiro_investimento || now;

        // Check if cs_customer already existed
        const { data: existingCs } = await supabase
          .from('cs_customers')
          .select('id')
          .eq('contact_id', contactId)
          .eq('empresa', empresa)
          .maybeSingle();

        const isNewCs = !existingCs;

        const { data: csCustomer } = await supabase.from('cs_customers').upsert(
          {
            contact_id: contactId,
            empresa,
            is_active: true,
            valor_mrr: valorMrr,
            data_primeiro_ganho: dataPrimeiroGanho,
            tags,
            sgt_dados_extras: sgtExtras,
            sgt_last_sync_at: now,
          },
          { onConflict: 'contact_id,empresa' }
        ).select('id').single();

        if (isNewCs) novosCsCustomers++;

        // ---- 4. Tokeniza: upsert cs_contracts for each investment ----
        if (empresa === 'TOKENIZA' && csCustomer && Array.isArray(investimentos) && investimentos.length > 0) {
          const statusMap: Record<string, string> = {
            FINISHED: 'ATIVO',
            PAID: 'ATIVO',
            PENDING: 'PENDENTE',
            CANCELLED: 'CANCELADO',
          };

          for (const inv of investimentos) {
            const invStatus = (inv.status || '').toUpperCase();
            // Only import real investments
            if (invStatus !== 'PAID' && invStatus !== 'FINISHED') continue;

            const invDate = new Date(inv.data || inv.data_investimento || '');
            const anoFiscal = isNaN(invDate.getTime()) ? new Date().getFullYear() : invDate.getFullYear();

            const { error: contractErr } = await supabase.from('cs_contracts').upsert(
              {
                customer_id: csCustomer.id,
                empresa: 'TOKENIZA',
                ano_fiscal: anoFiscal,
                plano: inv.oferta_nome || 'Investimento',
                oferta_id: inv.oferta_id || inv.id || null,
                oferta_nome: inv.oferta_nome || null,
                tipo: (inv.tipo && inv.tipo.trim()) ? inv.tipo.trim().toLowerCase() : 'crowdfunding',
                valor: inv.valor || 0,
                data_contratacao: inv.data || inv.data_investimento || null,
                status: statusMap[invStatus] || 'ATIVO',
                notas: 'Importado via sgt-full-import',
              },
              { onConflict: 'customer_id,ano_fiscal,oferta_id' }
            );

            if (!contractErr) novosContratos++;
          }
        }
      } catch (itemErr) {
        log.error(`Erro processando cliente`, { error: String(itemErr) });
        erros++;
      }
    }

    // ---- Save next offset ----
    const cicloCompleto = clientes.length < BATCH_SIZE;
    const nextOffset = cicloCompleto ? 0 : offset + BATCH_SIZE;
    await saveOffset(supabase, empresa, nextOffset);

    const result = {
      processados: clientes.length,
      novos_contatos: novosContatos,
      novos_cs_customers: novosCsCustomers,
      novos_contratos: novosContratos,
      ignorados,
      erros,
      offset_atual: offset,
      proximo_offset: nextOffset,
      ciclo_completo: cicloCompleto,
      total_sgt: totalSgt,
      empresa,
      timestamp: now,
    };

    log.info(`Import ${empresa} concluído`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Erro inesperado', { error: String(err) });
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
