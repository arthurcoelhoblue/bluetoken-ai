// ========================================
// sgt-sync/index.ts — Função consolidada de sincronização SGT
// Substitui: sgt-full-import, sgt-sync-clientes, sgt-import-clientes, sgt-backfill-investimentos
//
// Aceita no body:
//   { empresa: "BLUE"|"TOKENIZA", fase?: "BULK"|"DETALHE", reset_offset?: boolean }
//
// Fase BULK: usa listar-clientes-api (até 500/chamada) para import em massa
// Fase DETALHE: usa buscar-lead-api para investimentos individuais (só Tokeniza)
// Sem fase: executa BULK (1 batch)
// ========================================

import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  findOrCreateContact,
  enrichContact,
  isClienteElegivel,
  upsertCsCustomer,
  upsertTokenizaContracts,
} from '../_shared/contact-dedup.ts';

const log = createLogger('sgt-sync');

const SGT_LIST_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/listar-clientes-api';
const SGT_DETAIL_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 50;
const SETTINGS_CATEGORY = 'sgt-sync';

type Empresa = 'BLUE' | 'TOKENIZA';
type Fase = 'BULK' | 'DETALHE';

// ========================================
// Offset helpers
// ========================================
async function loadOffset(supabase: any, key: string): Promise<number> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', SETTINGS_CATEGORY)
    .eq('key', key)
    .maybeSingle();
  return data?.value?.offset ?? 0;
}

async function saveOffset(supabase: any, key: string, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key,
      value: { offset, updated_at: new Date().toISOString() },
      description: `Offset sgt-sync ${key}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}

// ========================================
// Fase BULK — listar-clientes-api
// ========================================
async function faseBulk(
  supabase: any,
  empresa: Empresa,
  sgtApiKey: string,
  resetOffset: boolean
): Promise<{
  processados: number;
  novos_contatos: number;
  novos_cs_customers: number;
  novos_contratos: number;
  ignorados: number;
  erros: number;
  offset_atual: number;
  proximo_offset: number;
  ciclo_completo: boolean;
  total_sgt: number | null;
}> {
  const offsetKey = `bulk-${empresa.toLowerCase()}`;
  let offset = resetOffset ? 0 : await loadOffset(supabase, offsetKey);

  log.info(`BULK ${empresa} — offset ${offset}, batch ${BATCH_SIZE}`);

  // Call SGT with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  let sgtResponse: Response;
  try {
    sgtResponse = await fetch(SGT_LIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': sgtApiKey },
      body: JSON.stringify({ empresa, limit: BATCH_SIZE, offset }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`SGT fetch error: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!sgtResponse.ok) {
    const details = await sgtResponse.text();
    throw new Error(`SGT error ${sgtResponse.status}: ${details}`);
  }

  const sgtData = await sgtResponse.json();
  const clientes: any[] = sgtData.clientes || sgtData.data || sgtData.leads || [];
  const total: number = sgtData.total ?? clientes.length;
  const hasMore: boolean = sgtData.has_more ?? (clientes.length === BATCH_SIZE);

  log.info(`SGT retornou ${clientes.length} clientes (total: ${total})`);

  if (clientes.length === 0) {
    await saveOffset(supabase, offsetKey, 0);
    return {
      processados: 0, novos_contatos: 0, novos_cs_customers: 0, novos_contratos: 0,
      ignorados: 0, erros: 0, offset_atual: offset, proximo_offset: 0,
      ciclo_completo: true, total_sgt: total,
    };
  }

  let novosContatos = 0, novosCsCustomers = 0, novosContratos = 0, ignorados = 0, erros = 0;
  const now = new Date().toISOString();

  for (const cliente of clientes) {
    if (!isClienteElegivel(cliente, empresa)) {
      ignorados++;
      continue;
    }

    try {
      const leadId = cliente.lead_id || cliente.id;
      const email = cliente.email || null;
      const telefone = cliente.telefone || null;
      if (!leadId || (!email && !telefone)) { ignorados++; continue; }

      // Upsert lead_contacts
      await supabase.from('lead_contacts').upsert(
        { lead_id: leadId, empresa, nome: cliente.nome || `Lead ${leadId}`, email, telefone, updated_at: now },
        { onConflict: 'lead_id,empresa', ignoreDuplicates: false }
      );

      // Dedup + create/find contact
      const { contactId, isNew } = await findOrCreateContact(supabase, {
        leadId, empresa, nome: cliente.nome || `Lead ${leadId}`, email, telefone,
        linkedinCargo: cliente.linkedin_cargo,
        linkedinEmpresa: cliente.linkedin_empresa,
        linkedinSetor: cliente.linkedin_setor,
        linkedinSenioridade: cliente.linkedin_senioridade,
        linkedinUrl: cliente.linkedin_url,
        scoreMarketing: cliente.score_temperatura,
      });

      if (isNew) novosContatos++;

      // Enrich existing contact
      await enrichContact(supabase, contactId, cliente);

      // Upsert cs_customer
      const { isNew: newCs } = await upsertCsCustomer(supabase, { contactId, empresa, lead: cliente });
      if (newCs) novosCsCustomers++;

      // Tokeniza: investimentos inline (se vieram no bulk — raro mas possível)
      const investimentos = cliente.dados_tokeniza?.investimentos || cliente.investimentos || [];
      if (empresa === 'TOKENIZA' && investimentos.length > 0) {
        const { data: cs } = await supabase.from('cs_customers').select('id').eq('contact_id', contactId).eq('empresa', 'TOKENIZA').maybeSingle();
        if (cs) {
          novosContratos += await upsertTokenizaContracts(supabase, cs.id, investimentos);
        }
      }
    } catch (err) {
      log.warn(`Erro processando cliente`, { error: String(err) });
      erros++;
    }
  }

  const cicloCompleto = !hasMore;
  const nextOffset = cicloCompleto ? 0 : offset + BATCH_SIZE;
  await saveOffset(supabase, offsetKey, nextOffset);

  return {
    processados: clientes.length, novos_contatos: novosContatos,
    novos_cs_customers: novosCsCustomers, novos_contratos: novosContratos,
    ignorados, erros, offset_atual: offset, proximo_offset: nextOffset,
    ciclo_completo: cicloCompleto, total_sgt: total,
  };
}

// ========================================
// Fase DETALHE — buscar-lead-api (só Tokeniza, só clientes sem contratos detalhados)
// ========================================
async function faseDetalhe(
  supabase: any,
  sgtApiKey: string,
  resetOffset: boolean
): Promise<{
  processados: number;
  novos_contratos: number;
  erros: number;
  offset_atual: number;
  proximo_offset: number;
  ciclo_completo: boolean;
}> {
  const offsetKey = 'detalhe-tokeniza';
  let offset = resetOffset ? 0 : await loadOffset(supabase, offsetKey);

  // Buscar cs_customers da Tokeniza que NÃO têm cs_contracts com oferta_id preenchido
  const { data: customers } = await supabase
    .from('cs_customers')
    .select(`
      id,
      contact_id,
      contacts!inner(email, telefone)
    `)
    .eq('empresa', 'TOKENIZA')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (!customers || customers.length === 0) {
    await saveOffset(supabase, offsetKey, 0);
    return { processados: 0, novos_contratos: 0, erros: 0, offset_atual: offset, proximo_offset: 0, ciclo_completo: true };
  }

  // Filtrar: só os que NÃO têm contratos com oferta_id
  const customerIds = customers.map((c: any) => c.id);
  const { data: withContracts } = await supabase
    .from('cs_contracts')
    .select('customer_id')
    .in('customer_id', customerIds)
    .not('oferta_id', 'is', null);

  const alreadyDetailed = new Set((withContracts || []).map((c: any) => c.customer_id));
  const needDetail = customers.filter((c: any) => !alreadyDetailed.has(c.id));

  log.info(`DETALHE: ${needDetail.length}/${customers.length} precisam de busca individual`);

  let novosContratos = 0, erros = 0;

  for (const customer of needDetail) {
    try {
      const contact = customer.contacts;
      const searchPayload: Record<string, string> = {};
      if (contact.email) searchPayload.email = contact.email;
      else if (contact.telefone) searchPayload.telefone = contact.telefone;
      else continue;

      const sgtResponse = await fetch(SGT_DETAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sgtApiKey },
        body: JSON.stringify(searchPayload),
      });

      if (!sgtResponse.ok) { erros++; continue; }

      const sgtData = await sgtResponse.json();
      if (!sgtData?.found) continue;

      // dados_tokeniza está na RAIZ da resposta, não dentro de lead
      const investimentos = sgtData.dados_tokeniza?.investimentos || [];
      if (investimentos.length > 0) {
        novosContratos += await upsertTokenizaContracts(supabase, customer.id, investimentos);
      }

      // Small delay para rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      log.warn(`Erro no detalhe do customer ${customer.id}`, { error: String(err) });
      erros++;
    }
  }

  const nextOffset = customers.length < BATCH_SIZE ? 0 : offset + BATCH_SIZE;
  await saveOffset(supabase, offsetKey, nextOffset);

  return {
    processados: needDetail.length, novos_contratos: novosContratos,
    erros, offset_atual: offset, proximo_offset: nextOffset,
    ciclo_completo: customers.length < BATCH_SIZE,
  };
}

// ========================================
// Main handler
// ========================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  const cors = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sgtApiKey = Deno.env.get('SGT_WEBHOOK_SECRET');

    if (!sgtApiKey) {
      return new Response(JSON.stringify({ error: 'SGT_WEBHOOK_SECRET missing' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse body
    let empresa: Empresa = 'BLUE';
    let fase: Fase | null = null;
    let resetOffset = false;

    try {
      const body = await req.json();
      if (body?.empresa) empresa = body.empresa.toUpperCase() as Empresa;
      if (body?.fase) fase = body.fase.toUpperCase() as Fase;
      if (body?.reset_offset === true) resetOffset = true;
    } catch { /* no body */ }

    if (empresa !== 'BLUE' && empresa !== 'TOKENIZA') {
      return new Response(JSON.stringify({ error: 'empresa deve ser BLUE ou TOKENIZA' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Route to the right phase
    if (fase === 'DETALHE') {
      if (empresa !== 'TOKENIZA') {
        return new Response(JSON.stringify({ error: 'Fase DETALHE só disponível para TOKENIZA' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      const result = await faseDetalhe(supabase, sgtApiKey, resetOffset);
      return new Response(JSON.stringify({ fase: 'DETALHE', empresa, ...result }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Default: BULK (1 batch per invocation, frontend loops)
    const result = await faseBulk(supabase, empresa, sgtApiKey, resetOffset);
    return new Response(JSON.stringify({ fase: 'BULK', empresa, ...result }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    log.error('Erro inesperado', { error: String(err) });
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
