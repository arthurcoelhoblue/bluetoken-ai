import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-buscar-lead');

const SGT_API_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  const cors = getCorsHeaders(req);

  try {
    // Validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { email, telefone } = body;

    if (!email && !telefone) {
      return new Response(JSON.stringify({ error: 'Informe email ou telefone' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Call SGT API
    const apiKey = Deno.env.get('SGT_WEBHOOK_SECRET');
    if (!apiKey) {
      log.error('SGT_WEBHOOK_SECRET não configurado');
      return new Response(JSON.stringify({ error: 'Configuração interna ausente' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const payload: Record<string, string> = {};
    if (email) payload.email = email;
    if (telefone) payload.telefone = telefone;

    log.info(`Buscando lead no SGT por ${email ? 'email' : 'telefone'}`, { user_id: user.id });

    const sgtResponse = await fetch(SGT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const sgtData = await sgtResponse.json();

    if (!sgtResponse.ok) {
      log.error('Erro na API do SGT', { status: sgtResponse.status, data: sgtData });
      return new Response(JSON.stringify({ error: 'Erro ao consultar SGT', details: sgtData }), {
        status: sgtResponse.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(sgtData), {
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
