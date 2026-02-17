// ========================================
// bluechat-proxy — Proxy para API do Blue Chat
// Ações: list-agents, transfer-ticket
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, getOptionalEnv } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resolve Blue Chat API URL + key for a given empresa */
async function resolveBlueChat(
  supabase: ReturnType<typeof createClient>,
  empresa: string
): Promise<{ baseUrl: string; apiKey: string } | null> {
  const settingsKey = empresa === "BLUE" ? "bluechat_blue" : "bluechat_tokeniza";
  const { data: setting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("category", "integrations")
    .eq("key", settingsKey)
    .maybeSingle();

  let apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
  if (!apiUrl) {
    const { data: legacy } = await supabase
      .from("system_settings")
      .select("value")
      .eq("category", "integrations")
      .eq("key", "bluechat")
      .maybeSingle();
    apiUrl = (legacy?.value as Record<string, unknown>)?.api_url as string | undefined;
  }
  if (!apiUrl) return null;

  const apiKey =
    empresa === "BLUE"
      ? getOptionalEnv("BLUECHAT_API_KEY_BLUE")
      : getOptionalEnv("BLUECHAT_API_KEY");
  if (!apiKey) return null;

  return { baseUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Parse body
  const body = await req.json().catch(() => ({}));
  const { action, empresa } = body as { action?: string; empresa?: string };

  if (!action || !empresa) {
    return jsonResponse({ error: "Missing action or empresa" }, 400);
  }

  // Service client for system_settings
  const serviceClient = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
  const config = await resolveBlueChat(serviceClient, empresa);

  if (!config) {
    return jsonResponse({ error: "Blue Chat not configured for this empresa" }, 404);
  }

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": config.apiKey,
  };

  // ── list-agents ──
  if (action === "list-agents") {
    try {
      const res = await fetch(`${config.baseUrl}/agents`, { method: "GET", headers });
      if (!res.ok) {
        const text = await res.text();
        console.error("Blue Chat /agents error:", res.status, text);
        return jsonResponse({ agents: [] });
      }
      const data = await res.json();
      // Normalize: accept array or { agents: [...] }
      const agents = Array.isArray(data) ? data : Array.isArray(data?.agents) ? data.agents : [];
      return jsonResponse({ agents });
    } catch (err) {
      console.error("list-agents fetch error:", err);
      return jsonResponse({ agents: [] });
    }
  }

  // ── transfer-ticket ──
  if (action === "transfer-ticket") {
    const { ticket_id, agent_id } = body as { ticket_id?: string; agent_id?: string };
    if (!ticket_id || !agent_id) {
      return jsonResponse({ error: "Missing ticket_id or agent_id" }, 400);
    }

    try {
      const transferUrl = `${config.baseUrl}/tickets/${ticket_id}/transfer`;
      const res = await fetch(transferUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          agent_id,
          reason: "Transferência manual pelo painel Amélia",
          source: "AMELIA_PANEL",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("transfer-ticket error:", res.status, text);
        return jsonResponse({ error: "Transfer failed", detail: text }, res.status);
      }

      const result = await res.json().catch(() => ({}));
      return jsonResponse({ success: true, ...result });
    } catch (err) {
      console.error("transfer-ticket fetch error:", err);
      return jsonResponse({ error: "Transfer request failed" }, 500);
    }
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});
