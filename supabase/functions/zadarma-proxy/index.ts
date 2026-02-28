import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

import { getCorsHeaders } from "../_shared/cors.ts";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('zadarma-proxy');
const ZADARMA_API_URL = 'https://api.zadarma.com';

async function md5(input: string): Promise<string> {
  const { crypto: stdCrypto } = await import('https://deno.land/std@0.224.0/crypto/mod.ts');
  const data = new TextEncoder().encode(input);
  const hash = await stdCrypto.subtle.digest('MD5', data);
  return encodeHex(new Uint8Array(hash));
}

async function signRequest(apiPath: string, params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const md5Hash = await md5(sorted);
  const toSign = `${apiPath}${sorted}${md5Hash}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  const hexDigest = encodeHex(new Uint8Array(sig));
  return encodeBase64(new TextEncoder().encode(hexDigest));
}

async function zadarmaRequest(apiKey: string, apiSecret: string, apiPath: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const allParams = { ...params, format: 'json' };
  const signature = await signRequest(apiPath, allParams, apiSecret);
  const queryString = new URLSearchParams(
    Object.keys(allParams).sort().reduce((acc, k) => { acc[k] = allParams[k]; return acc; }, {} as Record<string, string>)
  ).toString();
  
  const response = await fetch(`${ZADARMA_API_URL}${apiPath}?${queryString}`, {
    method: 'GET',
    headers: { 'Authorization': `${apiKey}:${signature}` },
  });

  const text = await response.text();
  let parsed: Record<string, unknown>;
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
    // Validate user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAnon = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, empresa, payload = {} } = body;

    // Get global config (singleton)
    const supabase = createServiceClient();
    const { data: config, error: configError } = await supabase
      .from('zadarma_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Configuração Zadarma não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate empresa is active
    const empresasAtivas: string[] = config.empresas_ativas || [];
    if (empresa && !empresasAtivas.includes(empresa)) {
      return new Response(JSON.stringify({ error: 'Telefonia não habilitada para esta empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: Record<string, unknown>;

    switch (action) {
      case 'get_balance':
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/info/balance/');
        break;
      case 'get_pbx_internals':
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/pbx/internal/');
        break;
      case 'get_webrtc_key': {
        const sipLogin = payload.sip_login;
        if (!sipLogin) throw new Error('sip_login required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/webrtc/get_key/', { sip: sipLogin });
        break;
      }
      case 'click_to_call': {
        const { from, to } = payload;
        if (!from || !to) throw new Error('from and to required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/request/callback/', { from: String(from), to: String(to) });
        break;
      }
      case 'get_recording': {
        const { call_id, lifetime } = payload;
        if (!call_id) throw new Error('call_id required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/pbx/record/request/', { call_id: String(call_id), lifetime: String(lifetime || 5400) });
        break;
      }
      case 'get_transcript': {
        const { call_id } = payload;
        if (!call_id) throw new Error('call_id required');
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/pbx/record/transcript/', { call_id: String(call_id) });
        break;
      }
      case 'test_connection':
        result = await zadarmaRequest(config.api_key, config.api_secret, '/v1/info/balance/');
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Error', { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
