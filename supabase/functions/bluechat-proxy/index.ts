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
  const SETTINGS_KEY_MAP: Record<string, string> = {
    'BLUE': 'bluechat_blue',
    'TOKENIZA': 'bluechat_tokeniza',
    'MPUPPE': 'bluechat_mpuppe',
    'AXIA': 'bluechat_axia',
  };
  const settingsKey = SETTINGS_KEY_MAP[empresa] || "bluechat_tokeniza";
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

  // API key per empresa from settings, fallback to env
  let apiKey = (setting?.value as Record<string, unknown>)?.api_key as string | undefined;
  if (!apiKey) {
    apiKey = getOptionalEnv("BLUECHAT_API_KEY") || undefined;
  }
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

  // ── open-conversation ── (Amélia proactive outreach via Blue Chat)
  if (action === "open-conversation") {
    const { telefone, nome_lead } = body as { telefone?: string; nome_lead?: string };
    if (!telefone) {
      return jsonResponse({ error: "Missing telefone" }, 400);
    }

    try {
      const res = await fetch(`${config.baseUrl}/conversations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: telefone,
          contact_name: nome_lead || undefined,
          channel: "whatsapp",
          source: "AMELIA",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("open-conversation error:", res.status, text);
        return jsonResponse({ error: "Failed to open conversation", detail: text }, res.status);
      }

      const data = await res.json();
      return jsonResponse({
        success: true,
        conversation_id: data?.conversation_id || data?.id,
        ticket_id: data?.ticket_id,
      });
    } catch (err) {
      console.error("open-conversation fetch error:", err);
      return jsonResponse({ error: "Open conversation request failed" }, 500);
    }
  }

  // ── send-message ── (Send message via Blue Chat POST /messages)
  if (action === "send-message") {
    const { conversation_id, content, phone } = body as { conversation_id?: string; content?: string; phone?: string };
    if (!content || (!conversation_id && !phone)) {
      return jsonResponse({ error: "Missing content, and need conversation_id or phone" }, 400);
    }

    try {
      const res = await fetch(`${config.baseUrl}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content,
          type: "text",
          source: "AMELIA_SDR",
          ...(conversation_id ? { ticketId: conversation_id } : {}),
          ...(phone ? { phone } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("send-message error:", res.status, text);
        return jsonResponse({ error: "Failed to send message", detail: text }, res.status);
      }

      const data = await res.json().catch(() => ({}));
      return jsonResponse({
        success: true,
        message_id: data?.id || data?.message_id,
      });
    } catch (err) {
      console.error("send-message fetch error:", err);
      return jsonResponse({ error: "Send message request failed" }, 500);
    }
  }

  // ── get-frontend-url ── (Resolve Blue Chat frontend URL for deep links)
  if (action === "get-frontend-url") {
    const SETTINGS_KEY_MAP: Record<string, string> = {
      'BLUE': 'bluechat_blue',
      'TOKENIZA': 'bluechat_tokeniza',
      'MPUPPE': 'bluechat_mpuppe',
      'AXIA': 'bluechat_axia',
    };
    const settingsKey = SETTINGS_KEY_MAP[empresa as string] || "bluechat_tokeniza";
    const { data: frontendSetting } = await serviceClient
      .from("system_settings")
      .select("value")
      .eq("category", "integrations")
      .eq("key", settingsKey)
      .maybeSingle();

    const frontendUrl = (frontendSetting?.value as Record<string, unknown>)?.frontend_url as string | undefined;
    return jsonResponse({ frontend_url: frontendUrl || null });
  }

  return jsonResponse({ error: `Unknown action: ${action}` }, 400);
});
