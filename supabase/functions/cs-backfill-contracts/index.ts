import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('cs-backfill-contracts');

const BATCH_SIZE = 100;
const SETTINGS_CATEGORY = 'cs-backfill';
const SETTINGS_KEY = 'contracts-offset';

async function saveOffset(supabase: any, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: SETTINGS_KEY,
      value: { offset, updated_at: new Date().toISOString() },
      description: 'Offset de paginação do backfill de contratos CS',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const cors = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    // Allow manual reset/set via body
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
    } catch { /* no body */ }

    // Fetch cs_customers with data_primeiro_ganho
    const { data: customers, error: fetchErr } = await supabase
      .from('cs_customers')
      .select('id, empresa, data_primeiro_ganho, valor_mrr')
      .not('data_primeiro_ganho', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchErr) {
      log.error('Erro ao buscar cs_customers', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!customers || customers.length === 0) {
      await saveOffset(supabase, 0);
      log.info('Backfill completo – offset resetado');
      return new Response(JSON.stringify({
        processed: 0, created: 0, skipped: 0,
        message: 'Backfill completo, offset resetado',
        next_offset: 0, ciclo_completo: true,
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    log.info(`Processando batch de ${customers.length} clientes (offset ${offset})`);

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const now = new Date();

    for (const customer of customers) {
      try {
        // Check if contract already exists for this customer
        const { data: existing } = await supabase
          .from('cs_contracts')
          .select('id')
          .eq('customer_id', customer.id)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const dataPrimeiro = new Date(customer.data_primeiro_ganho);
        const anoFiscal = dataPrimeiro.getFullYear();
        const valor = customer.valor_mrr || 0;

        // data_vencimento = data_primeiro_ganho + 12 months
        const dataVencimento = new Date(dataPrimeiro);
        dataVencimento.setMonth(dataVencimento.getMonth() + 12);

        // status: VENCIDO if vencimento < now, else ATIVO
        const status = dataVencimento < now ? 'VENCIDO' : 'ATIVO';

        // proxima_renovacao = data_primeiro_ganho + 9 months
        const proximaRenovacao = new Date(dataPrimeiro);
        proximaRenovacao.setMonth(proximaRenovacao.getMonth() + 9);

        // Insert contract
        const { error: insertErr } = await supabase.from('cs_contracts').insert({
          customer_id: customer.id,
          empresa: customer.empresa,
          ano_fiscal: anoFiscal,
          plano: 'Padrão',
          valor: valor,
          data_contratacao: dataPrimeiro.toISOString().split('T')[0],
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: status,
          notas: 'Contrato criado via backfill retroativo',
        });

        if (insertErr) {
          // Likely duplicate (unique constraint on customer_id, ano_fiscal)
          if (insertErr.message?.includes('duplicate') || insertErr.message?.includes('unique')) {
            skipped++;
          } else {
            log.warn(`Erro ao inserir contrato para ${customer.id}`, { error: insertErr.message });
            errors++;
          }
          continue;
        }

        // Update proxima_renovacao on cs_customers
        await supabase.from('cs_customers').update({
          proxima_renovacao: proximaRenovacao.toISOString().split('T')[0],
          updated_at: now.toISOString(),
        }).eq('id', customer.id);

        created++;
      } catch (err) {
        log.error(`Erro processando customer ${customer.id}`, { error: String(err) });
        errors++;
      }
    }

    const nextOffset = customers.length < BATCH_SIZE ? 0 : offset + BATCH_SIZE;
    await saveOffset(supabase, nextOffset);

    const result = {
      processed: customers.length,
      created,
      skipped,
      errors,
      offset_atual: offset,
      next_offset: nextOffset,
      ciclo_completo: customers.length < BATCH_SIZE,
      timestamp: now.toISOString(),
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
