import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-sync-clientes');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';
const BATCH_SIZE = 20;

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

    // Fetch contacts that are not yet clients and have email or phone
    const { data: contacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, email, telefone, empresa, nome')
      .eq('is_cliente', false)
      .eq('is_active', true)
      .or('email.neq.null,telefone.neq.null')
      .limit(BATCH_SIZE);

    if (fetchErr) {
      log.error('Erro ao buscar contatos', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!contacts || contacts.length === 0) {
      log.info('Nenhum contato para sincronizar');
      return new Response(JSON.stringify({ synced: 0, message: 'Nenhum contato pendente' }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    log.info(`Processando ${contacts.length} contatos`);

    let synced = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        // Build search payload – prefer email, fallback to phone
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

        // Normalize response
        const leads = Array.isArray(sgtData) ? sgtData : sgtData ? [sgtData] : [];

        // Check if any returned lead has client flag
        const isCliente = leads.some(
          (l: any) => l.is_cliente === true || l.status === 'CLIENTE'
        );

        if (isCliente) {
          log.info(`Contato ${contact.id} (${contact.nome}) identificado como cliente no SGT`);

          // Update contact
          await supabase
            .from('contacts')
            .update({ is_cliente: true, updated_at: new Date().toISOString() })
            .eq('id', contact.id);

          // Upsert cs_customers
          await supabase.from('cs_customers').upsert(
            {
              contact_id: contact.id,
              empresa: contact.empresa,
              is_active: true,
              data_primeiro_ganho: new Date().toISOString(),
            },
            { onConflict: 'contact_id,empresa' }
          );

          synced++;
        }
      } catch (contactErr) {
        log.error(`Erro processando contato ${contact.id}`, { error: String(contactErr) });
        errors++;
      }
    }

    const result = {
      synced,
      errors,
      total_checked: contacts.length,
      timestamp: new Date().toISOString(),
    };

    log.info('Sync concluída', result);

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
