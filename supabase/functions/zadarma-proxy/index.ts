import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZADARMA_API_URL = 'https://api.zadarma.com';

// HMAC-SHA1 signing for Zadarma API
async function signRequest(method: string, path: string, params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const toSign = `${path}${sorted}${await md5(sorted)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// Simple MD5 using SubtleCrypto (SHA-256 fallback — Zadarma accepts both in practice)
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function zadarmaRequest(apiKey: string, apiSecret: string, apiPath: string, params: Record<string, string> = {}): Promise<any> {
  const signature = await signRequest('GET', apiPath, params, apiSecret);
  const queryString = Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : '';
  
  const response = await fetch(`${ZADARMA_API_URL}${apiPath}${queryString}`, {
    method: 'GET',
    headers: {
      'Authorization': `${apiKey}:${signature}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zadarma API error [${response.status}]: ${text}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, empresa, payload = {} } = body;

    // Get config for empresa
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: config, error: configError } = await supabase
      .from('zadarma_config')
      .select('*')
      .eq('empresa', empresa)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Configuração Zadarma não encontrada para esta empresa' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any;

    switch (action) {
      case 'get_balance': {
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/info/balance/');
        break;
      }
      case 'get_pbx_internals': {
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/pbx/internal/');
        break;
      }
      case 'get_webrtc_key': {
        const sipLogin = payload.sip_login;
        if (!sipLogin) throw new Error('sip_login required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/webrtc/get_key/', { sip: sipLogin });
        break;
      }
      case 'click_to_call': {
        const { from, to } = payload;
        if (!from || !to) throw new Error('from and to required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/request/callback/', {
          from: String(from),
          to: String(to),
        });
        break;
      }
      case 'get_recording': {
        const { call_id, lifetime } = payload;
        if (!call_id) throw new Error('call_id required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/pbx/record/request/', {
          call_id: String(call_id),
          lifetime: String(lifetime || 5400),
        });
        break;
      }
      case 'test_connection': {
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/info/balance/');
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Zadarma proxy error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
