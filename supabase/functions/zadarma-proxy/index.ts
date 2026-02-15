import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

import { getCorsHeaders } from "../_shared/cors.ts";

const ZADARMA_API_URL = 'https://api.zadarma.com';

// Real MD5 implementation for Zadarma signing (SubtleCrypto doesn't support MD5)
async function md5(input: string): Promise<string> {
  // Use a simple MD5 from Deno std
  const { crypto: stdCrypto } = await import('https://deno.land/std@0.224.0/crypto/mod.ts');
  const data = new TextEncoder().encode(input);
  const hash = await stdCrypto.subtle.digest('MD5', data);
  return encodeHex(new Uint8Array(hash));
}

// HMAC-SHA1 signing for Zadarma API (matches official Python SDK)
async function signRequest(apiPath: string, params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const md5Hash = await md5(sorted);
  const toSign = `${apiPath}${sorted}${md5Hash}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  // Zadarma expects: base64(hex_string_of_hmac), NOT base64(raw_bytes)
  const hexDigest = encodeHex(new Uint8Array(sig));
  return encodeBase64(new TextEncoder().encode(hexDigest));
}

async function zadarmaRequest(apiKey: string, apiSecret: string, apiPath: string, params: Record<string, string> = {}): Promise<any> {
  // Zadarma SDK always adds format param
  const allParams = { ...params, format: 'json' };
  const signature = await signRequest(apiPath, allParams, apiSecret);
  const queryString = new URLSearchParams(
    Object.keys(allParams).sort().reduce((acc, k) => { acc[k] = allParams[k]; return acc; }, {} as Record<string, string>)
  ).toString();
  
  const response = await fetch(`${ZADARMA_API_URL}${apiPath}?${queryString}`, {
    method: 'GET',
    headers: {
      'Authorization': `${apiKey}:${signature}`,
    },
  });

  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  
  if (parsed.status === 'error') {
    throw new Error(`Zadarma API error: ${parsed.message || text}`);
  }

  return parsed;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
