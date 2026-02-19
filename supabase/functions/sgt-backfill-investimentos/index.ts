import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-backfill-investimentos');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 10;
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

    // Fetch Tokeniza customers that have NO detailed contracts (oferta_id IS NOT NULL)
    // We get all active Tokeniza customers and filter out those that already have detailed contracts
    const { data: allCustomers, error: fetchErr } = await supabase
      .from('cs_customers')
      .select('id, contact_id')
      .eq('empresa', 'TOKENIZA')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      log.error('Erro ao buscar customers', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!allCustomers || allCustomers.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum customer Tokeniza encontrado', total: 0 }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Find customers that have at least one contract with oferta_id NOT NULL (already backfilled)
    const { data: alreadyDone } = await supabase
      .from('cs_contracts')
      .select('customer_id')
      .eq('empresa', 'TOKENIZA')
      .not('oferta_id', 'is', null);

    const doneSet = new Set((alreadyDone || []).map((r: any) => r.customer_id));
    const pendingCustomers = allCustomers.filter((c: any) => !doneSet.has(c.id));

    const total = pendingCustomers.length;
    log.info(`Total pendentes: ${total}, offset: ${offset}`);

    if (offset >= total) {
      await saveOffset(supabase, 0);
      return new Response(JSON.stringify({
        message: 'Backfill completo! Todos os customers já foram processados.',
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
    const detalhes: any[] = [];

    for (const customer of batch) {
      try {
        // Get contact info
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, email, telefone, nome')
          .eq('id', customer.contact_id)
          .maybeSingle();

        if (!contact) {
          log.warn(`Contact não encontrado para customer ${customer.id}`);
          errors++;
          continue;
        }

        // Build search payload
        const payload: Record<string, string> = {};
        if (contact.email) {
          payload.email = contact.email;
        } else if (contact.telefone) {
          payload.telefone = contact.telefone;
        } else {
          log.warn(`Contact ${contact.id} sem email/telefone`);
          sem_dados++;
          continue;
        }

        // Call SGT API
        const sgtResponse = await fetch(SGT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': sgtApiKey,
          },
          body: JSON.stringify(payload),
        });

        if (!sgtResponse.ok) {
          log.warn(`SGT retornou ${sgtResponse.status} para contact ${contact.id}`);
          errors++;
          continue;
        }

        const sgtData = await sgtResponse.json();

        // Unwrap lead
        let lead: any = null;
        if (sgtData?.found && sgtData?.lead) {
          lead = sgtData.lead;
        } else if (Array.isArray(sgtData) && sgtData.length > 0) {
          lead = sgtData[0]?.lead ?? sgtData[0];
        }

        if (!lead) {
          sem_dados++;
          continue;
        }

        // dados_tokeniza is at root level of sgtData, NOT inside lead
        const dadosTokeniza = sgtData.dados_tokeniza;

        // Extract investimentos from dados_tokeniza (root level)
        const investimentos = dadosTokeniza?.investimentos;
        if (!investimentos || !Array.isArray(investimentos) || investimentos.length === 0) {
          sem_dados++;
          detalhes.push({ contact_id: contact.id, nome: contact.nome, status: 'sem_investimentos' });
          continue;
        }

        // Delete old contracts without oferta_id for this customer
        await supabase
          .from('cs_contracts')
          .delete()
          .eq('customer_id', customer.id)
          .eq('empresa', 'TOKENIZA')
          .is('oferta_id', null);

        // Upsert each investment
        const statusMap: Record<string, string> = {
          FINISHED: 'ATIVO',
          PAID: 'ATIVO',
          PENDING: 'PENDENTE',
          CANCELLED: 'CANCELADO',
        };

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
        detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          investimentos: investimentos.length,
        });

        log.info(`${investimentos.length} investimentos para ${contact.nome} (customer ${customer.id})`);
      } catch (err) {
        log.error(`Erro processando customer ${customer.id}`, { error: String(err) });
        errors++;
      }
    }

    // Save next offset
    const nextOffset = offset + batch.length;
    await saveOffset(supabase, nextOffset >= total ? 0 : nextOffset);

    const result = {
      processados,
      investimentos_total,
      errors,
      sem_dados,
      total_pendentes: total,
      batch_size: batch.length,
      offset_atual: offset,
      proximo_offset: nextOffset >= total ? 0 : nextOffset,
      backfill_completo: nextOffset >= total,
      detalhes,
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
