import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient, getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('integration-health-check');

interface HealthCheckResult {
  status: "online" | "offline" | "error";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

async function checkWhatsApp(): Promise<HealthCheckResult> {
  const apiKey = getOptionalEnv("MENSAGERIA_API_KEY");
  if (!apiKey) return { status: "error", message: "MENSAGERIA_API_KEY não configurada" };

  const start = Date.now();
  const healthEndpoints = [
    "https://dev-mensageria.grupoblue.com.br/api/health",
    "https://dev-mensageria.grupoblue.com.br/health",
    "https://dev-mensageria.grupoblue.com.br/api/status",
    "https://dev-mensageria.grupoblue.com.br/api/ping",
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      const response = await fetch(endpoint, { method: "GET", headers: { "X-API-Key": apiKey, "Content-Type": "application/json" } });
      if (response.ok) return { status: "online", latencyMs: Date.now() - start, details: { endpoint, method: "health" } };
    } catch { /* next */ }
  }
  
  try {
    const response = await fetch("https://dev-mensageria.grupoblue.com.br/api/whatsapp/send-message", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ connectionName: "Arthur", to: "", message: "" }),
    });
    const latencyMs = Date.now() - start;
    if (response.status === 400 || response.status === 422) return { status: "online", latencyMs, message: "API validada via send-message", details: { method: "send-message-probe" } };
    if (response.status === 401) return { status: "error", message: "API Key inválida", latencyMs };
    if (response.status >= 500) {
      let errorMsg = "Conexão WhatsApp instável";
      try { const data = await response.json(); errorMsg = data.message || data.error || errorMsg; } catch { /* ignore */ }
      return { status: "offline", message: errorMsg, latencyMs };
    }
    if (response.ok) return { status: "online", latencyMs };
    return { status: "online", latencyMs, message: `Status ${response.status}` };
  } catch (error) {
    return { status: "offline", message: error instanceof Error ? error.message : "Erro de conexão", latencyMs: Date.now() - start };
  }
}

async function checkPipedrive(): Promise<HealthCheckResult> {
  const apiToken = getOptionalEnv("PIPEDRIVE_API_TOKEN");
  if (!apiToken) return { status: "error", message: "PIPEDRIVE_API_TOKEN não configurado" };

  const start = Date.now();
  try {
    const response = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${apiToken}`, { method: "GET" });
    const latencyMs = Date.now() - start;
    if (response.ok) { const data = await response.json(); return { status: "online", latencyMs, details: { user: data.data?.name || "Conectado" } }; }
    if (response.status === 401) return { status: "error", message: "API Token inválido", latencyMs };
    return { status: "offline", message: `Status: ${response.status}`, latencyMs };
  } catch (error) {
    return { status: "offline", message: error instanceof Error ? error.message : "Erro de conexão", latencyMs: Date.now() - start };
  }
}

async function checkAnthropic(): Promise<HealthCheckResult> {
  const apiKey = getOptionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return { status: "error", message: "ANTHROPIC_API_KEY não configurada" };

  const start = Date.now();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    });
    const latencyMs = Date.now() - start;
    if (response.ok) return { status: "online", latencyMs };
    if (response.status === 401) return { status: "error", message: "API Key inválida", latencyMs };
    if (response.status === 429) return { status: "online", message: "Rate limit atingido", latencyMs };
    return { status: "offline", message: `Status: ${response.status}`, latencyMs };
  } catch (error) {
    return { status: "offline", message: error instanceof Error ? error.message : "Erro de conexão", latencyMs: Date.now() - start };
  }
}

async function checkSMTP(): Promise<HealthCheckResult> {
  const host = getOptionalEnv("SMTP_HOST");
  const user = getOptionalEnv("SMTP_USER");
  if (!host || !user) return { status: "error", message: "Configurações SMTP incompletas" };
  return { status: "online", message: "Configurado", details: { host, user } };
}

function checkSGT(): HealthCheckResult {
  const secret = getOptionalEnv("SGT_WEBHOOK_SECRET");
  if (!secret) return { status: "error", message: "SGT_WEBHOOK_SECRET não configurado" };
  return { status: "online", message: "Secret configurado" };
}

async function checkBlueChat(): Promise<HealthCheckResult> {
  try {
    const supabase = createServiceClient();
    
    // Check all companies for configured keys
    const empresas = ['TOKENIZA', 'BLUE', 'MPUPPE', 'AXIA'];
    const keyMap: Record<string, string> = { TOKENIZA: 'bluechat_tokeniza', BLUE: 'bluechat_blue', MPUPPE: 'bluechat_mpuppe', AXIA: 'bluechat_axia' };
    
    let anyConfigured = false;
    let testedUrl: string | undefined;
    let testedKey: string | undefined;
    
    for (const emp of empresas) {
      const { data: setting } = await supabase.from("system_settings").select("value").eq("category", "integrations").eq("key", keyMap[emp]).maybeSingle();
      const val = setting?.value as Record<string, unknown> | undefined;
      if (val?.api_url && val?.api_key) {
        anyConfigured = true;
        testedUrl = val.api_url as string;
        testedKey = val.api_key as string;
        break;
      }
    }
    
    // Fallback to env key + legacy config
    if (!anyConfigured) {
      const envKey = getOptionalEnv("BLUECHAT_API_KEY");
      if (!envKey) return { status: "error", message: "Nenhuma API Key configurada (nem por empresa, nem no env)" };
      testedKey = envKey;
      const { data: setting } = await supabase.from("system_settings").select("value").eq("category", "integrations").eq("key", "bluechat").maybeSingle();
      testedUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
    }
    
    if (!testedUrl) return { status: "error", message: "URL da API não configurada. Configure em Integrações → Blue Chat." };

    const start = Date.now();
    const healthEndpoints = [`${testedUrl.replace(/\/$/, "")}/health`, `${testedUrl.replace(/\/$/, "")}/api/health`, testedUrl];

    for (const endpoint of healthEndpoints) {
      try {
        const response = await fetch(endpoint, { method: "GET", headers: { "X-API-Key": testedKey!, "Content-Type": "application/json" } });
        if (response.ok || response.status === 401 || response.status === 403) {
          return { status: "online", latencyMs: Date.now() - start, message: response.ok ? undefined : "API acessível (auth pode precisar revisão)", details: { endpoint, statusCode: response.status } };
        }
      } catch { /* next */ }
    }

    return { status: "offline", message: "Não foi possível conectar à API do Blue Chat", latencyMs: Date.now() - start, details: { apiUrl: testedUrl } };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Erro ao verificar Blue Chat" };
  }
}

async function checkIntegration(integration: string): Promise<HealthCheckResult> {
  switch (integration) {
    case "whatsapp": case "mensageria": return await checkWhatsApp();
    case "pipedrive": return await checkPipedrive();
    case "anthropic": case "claude": case "lovable_ai": case "gemini": case "gpt": return await checkAnthropic();
    case "email": case "smtp": return await checkSMTP();
    case "zadarma": {
      const zadarmaKey = getOptionalEnv("ZADARMA_API_KEY");
      if (!zadarmaKey) return { status: "error", message: "ZADARMA_API_KEY não configurada" };
      return { status: "online", message: "API Key configurada" };
    }
    case "sgt": return checkSGT();
    case "bluechat": return await checkBlueChat();
    default: return { status: "error", message: `Integração desconhecida: ${integration}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { integration } = body;

    const isCron = req.headers.get("x-cron-secret") === getOptionalEnv("CRON_SECRET") || !integration;

    if (isCron) {
      const integrations = ["whatsapp", "pipedrive", "anthropic", "email", "sgt", "bluechat"];
      const results: Record<string, HealthCheckResult> = {};
      const alerts: string[] = [];

      for (const intg of integrations) {
        const result = await checkIntegration(intg);
        results[intg] = result;
        if (result.status === "offline" || result.status === "error") {
          alerts.push(`⚠️ ${intg}: ${result.status} - ${result.message || "indisponível"}`);
        }
      }

      const supabase = createServiceClient();

      const { data: prevState } = await supabase.from("system_settings").select("value").eq("category", "health_check").eq("key", "consecutive_failures").maybeSingle();
      const prevFailures: Record<string, number> = (prevState?.value as Record<string, number>) || {};
      const newFailures: Record<string, number> = {};
      const shouldAlert: string[] = [];

      for (const [intg, result] of Object.entries(results)) {
        if (result.status === "offline" || result.status === "error") {
          newFailures[intg] = (prevFailures[intg] || 0) + 1;
          if (newFailures[intg] === 3) shouldAlert.push(intg);
        } else {
          newFailures[intg] = 0;
        }
      }

      await supabase.from("system_settings").upsert({ category: "health_check", key: "consecutive_failures", value: newFailures, updated_at: new Date().toISOString() }, { onConflict: "category,key" });

      if (shouldAlert.length > 0 || alerts.length > 0) {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "ADMIN");
        if (admins && admins.length > 0) {
          const alertMsg = shouldAlert.length > 0 ? `🚨 CRÍTICO: ${shouldAlert.join(', ')} falharam 3x consecutivas!\n${alerts.join("\n")}` : alerts.join("\n");
          const notifications = admins.map((a: { user_id: string }) => ({
            user_id: a.user_id, empresa: "BLUE" as const,
            titulo: shouldAlert.length > 0 ? `🚨 ${shouldAlert.length} integração(ões) em falha crítica` : `🔴 ${alerts.length} integração(ões) com problema`,
            mensagem: alertMsg, tipo: shouldAlert.length > 0 ? "SYSTEM_ALERT" as const : "ALERTA" as const, referencia_tipo: "SISTEMA", link: "/admin/settings",
          }));
          await supabase.from("notifications").insert(notifications);
        }
      }

      return new Response(JSON.stringify({ mode: "cron", results, alerts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await checkIntegration(integration);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    log.error('Health check error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
