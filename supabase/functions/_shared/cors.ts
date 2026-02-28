// _shared/cors.ts — Centralised CORS configuration
// Webhooks externos (SGT, WhatsApp, Zadarma) continuam com '*'
// porque são chamados por servidores de terceiros que não enviam Origin.
// Funções chamadas pelo frontend usam whitelist restritiva.

const FALLBACK_ORIGIN = "https://sdrgrupobue.lovable.app";

const BASE_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** Check if origin belongs to a Lovable domain (production or preview). */
function isAllowedOrigin(origin: string): boolean {
  return origin.endsWith('.lovable.app') || origin.endsWith('.lovableproject.com');
}

/**
 * Returns CORS headers scoped to the project's own domains.
 * Use for every Edge Function called by the frontend (browser).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : FALLBACK_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": BASE_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

/**
 * Returns open CORS headers for webhook endpoints called by external servers.
 * Pass extraHeaders to add webhook-specific headers (e.g. x-sgt-signature).
 */
export function getWebhookCorsHeaders(extraHeaders?: string): Record<string, string> {
  const headers = extraHeaders ? `${BASE_HEADERS}, ${extraHeaders}` : BASE_HEADERS;
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": headers,
  };
}

/** Shortcut: respond to OPTIONS preflight using restricted CORS. */
export function handleCorsOptions(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}

/** Shortcut: respond to OPTIONS preflight for webhooks. */
export function handleWebhookCorsOptions(extraHeaders?: string): Response {
  return new Response("ok", { headers: getWebhookCorsHeaders(extraHeaders) });
}
