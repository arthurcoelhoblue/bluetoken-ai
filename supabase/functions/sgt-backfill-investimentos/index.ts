import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-backfill-investimentos');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 50;
const SETTINGS_CATEGORY = 'sgt-sync';
const SETTINGS_KEY = 'backfill-investimentos-offset';

async function saveOffset(supabase: any, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: SETTINGS_KEY,
      value: { offset, updated_at: new Date().toISOString() },
      description: 'Offset do backfill de investimentos Tokeniza',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}

/** Fetch all rows from a query, paginating to bypass 1000-row limit */
async function fetchAllRows(
  supabase: any,
  table: string,
  selectCols: string,
  filters: Record<string, any>,
  orderCol = 'created_at'
): Promise<any[]> {
  const PAGE = 1000;
  const all: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase.from(table).select(selectCols).order(orderCol, { ascending: true }).range(offset, offset + PAGE - 1);
    for (const [key, val] of Object.entries(filters)) {
      if (val === true || val === false) q = q.eq(key, val);
      else q = q.eq(key, val);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (data && data.length > 0) {
      all.push(...data);
      offset += PAGE;
      hasMore = data.length === PAGE;
    } else {
      hasMore = false;
    }
  }
  return all;
}

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
      return new Response(JSON.stringify({ error: 'SGT_WEBHOOK_SECRET missing' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load offset
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

    // Allow manual reset
    try {
      const body = await req.json();
      if (body?.reset_offset === true) {
        offset = 0;
        log.info('Offset resetado manualmente');
      }
    } catch { /* no body */ }

    // Fetch ALL Tokeniza customers (paginated to bypass 1000-row limit)
    const allCustomers = await fetchAllRows(
      supabase,
      'cs_customers',
      'id, contact_id',
      { empresa: 'TOKENIZA', is_active: true }
    );

    if (!allCustomers || allCustomers.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum customer Tokeniza encontrado', total: 0 }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Find customers that already have detailed contracts (paginated)
    const alreadyDoneRows = await fetchAllRows(
      supabase,
      'cs_contracts',
      'customer_id',
      { empresa: 'TOKENIZA' }
    );
    // Filter only those with oferta_id NOT NULL — fetchAllRows can't do .not() easily,
    // so we fetch all and filter in JS (oferta_id will be present in data)
    // Actually let's do a dedicated query for this
    const doneCustomerIds = new Set<string>();
    {
      let page = 0;
      const PAGE = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from('cs_contracts')
          .select('customer_id')
          .eq('empresa', 'TOKENIZA')
          .not('oferta_id', 'is', null)
          .range(page, page + PAGE - 1);
        if (data && data.length > 0) {
          data.forEach((r: any) => doneCustomerIds.add(r.customer_id));
          page += PAGE;
          hasMore = data.length === PAGE;
        } else {
          hasMore = false;
        }
      }
    }

    const pendingCustomers = allCustomers.filter((c: any) => !doneCustomerIds.has(c.id));

    const total = pendingCustomers.length;
    log.info(`Total customers: ${allCustomers.length}, já processados: ${doneCustomerIds.size}, pendentes: ${total}, offset: ${offset}`);

    if (offset >= total) {
      await saveOffset(supabase, 0);
      return new Response(JSON.stringify({
        message: 'Backfill completo! Todos os customers já foram processados.',
        total_customers: allCustomers.length,
        total_com_investimentos: doneCustomerIds.size,
        total,
        processados: 0,
        offset: 0,
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const batch = pendingCustomers.slice(offset, offset + BATCH_SIZE);
    let processados = 0;
    let investimentos_total = 0;
    let errors = 0;
    let sem_dados = 0;

    const statusMap: Record<string, string> = {
      FINISHED: 'ATIVO',
      PAID: 'ATIVO',
      PENDING: 'PENDENTE',
      CANCELLED: 'CANCELADO',
    };

    for (const customer of batch) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, email, telefone, nome')
          .eq('id', customer.contact_id)
          .maybeSingle();

        if (!contact) { errors++; continue; }

        const payload: Record<string, string> = {};
        if (contact.email) payload.email = contact.email;
        else if (contact.telefone) payload.telefone = contact.telefone;
        else { sem_dados++; continue; }

        const sgtResponse = await fetch(SGT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': sgtApiKey },
          body: JSON.stringify(payload),
        });

        if (!sgtResponse.ok) { errors++; continue; }

        const sgtData = await sgtResponse.json();

        // dados_tokeniza is at root level
        const investimentos = sgtData?.dados_tokeniza?.investimentos;
        if (!investimentos || !Array.isArray(investimentos) || investimentos.length === 0) {
          sem_dados++;
          continue;
        }

        // Delete old contracts without oferta_id
        await supabase
          .from('cs_contracts')
          .delete()
          .eq('customer_id', customer.id)
          .eq('empresa', 'TOKENIZA')
          .is('oferta_id', null);

        for (const inv of investimentos) {
          const invDate = new Date(inv.data);
          const anoFiscal = isNaN(invDate.getTime()) ? new Date().getFullYear() : invDate.getFullYear();

          await supabase.from('cs_contracts').upsert(
            {
              customer_id: customer.id,
              empresa: 'TOKENIZA',
              ano_fiscal: anoFiscal,
              plano: inv.oferta_nome || 'Investimento',
              oferta_id: inv.oferta_id,
              oferta_nome: inv.oferta_nome,
              tipo: inv.tipo || 'crowdfunding',
              valor: inv.valor || 0,
              data_contratacao: inv.data || null,
              status: statusMap[(inv.status || '').toUpperCase()] || 'ATIVO',
              notas: 'Backfill SGT',
            },
            { onConflict: 'customer_id,ano_fiscal,oferta_id' }
          );
        }

        investimentos_total += investimentos.length;
        processados++;
        log.info(`${investimentos.length} investimentos para ${contact.nome} (customer ${customer.id})`);
      } catch (err) {
        log.error(`Erro processando customer ${customer.id}`, { error: String(err) });
        errors++;
      }
    }

    const nextOffset = offset + batch.length;
    await saveOffset(supabase, nextOffset >= total ? 0 : nextOffset);

    const result = {
      processados,
      investimentos_total,
      errors,
      sem_dados,
      total_customers: allCustomers.length,
      total_pendentes: total,
      batch_size: batch.length,
      offset_atual: offset,
      proximo_offset: nextOffset >= total ? 0 : nextOffset,
      backfill_completo: nextOffset >= total,
      timestamp: new Date().toISOString(),
    };

    log.info('Batch de backfill concluído', result);

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
