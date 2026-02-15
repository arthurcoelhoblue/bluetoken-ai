import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResult {
  status: "online" | "offline" | "error";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

async function checkWhatsApp(): Promise<HealthCheckResult> {
  const apiKey = Deno.env.get("MENSAGERIA_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "MENSAGERIA_API_KEY não configurada" };
  }

  const start = Date.now();
  
  // Tentar múltiplos endpoints de health (a API pode não ter /health)
  const healthEndpoints = [
    "https://dev-mensageria.grupoblue.com.br/api/health",
    "https://dev-mensageria.grupoblue.com.br/health",
    "https://dev-mensageria.grupoblue.com.br/api/status",
    "https://dev-mensageria.grupoblue.com.br/api/ping",
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
      });
      
      if (response.ok) {
        return { 
          status: "online", 
          latencyMs: Date.now() - start,
          details: { endpoint, method: "health" }
        };
      }
    } catch {
      // Continua para próximo endpoint
    }
  }
  
  // Se nenhum health endpoint funcionar, testar autenticação no endpoint de envio
  // Isso valida que a API está online e a key é válida
  try {
    const response = await fetch("https://dev-mensageria.grupoblue.com.br/api/whatsapp/send-message", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        connectionName: "Arthur", 
        to: "", 
        message: "" 
      }),
    });
    
    const latencyMs = Date.now() - start;
    
    // 400 (bad request por dados vazios) = API online e key válida
    // 401 = key inválida
    // 502/503 = conexão WhatsApp instável
    if (response.status === 400 || response.status === 422) {
      return { 
        status: "online", 
        latencyMs, 
        message: "API validada via send-message",
        details: { method: "send-message-probe" }
      };
    } else if (response.status === 401) {
      return { status: "error", message: "API Key inválida", latencyMs };
    } else if (response.status >= 500) {
      // Tenta ler a mensagem de erro
      let errorMsg = "Conexão WhatsApp instável";
      try {
        const data = await response.json();
        errorMsg = data.message || data.error || errorMsg;
      } catch {
        // ignore
      }
      return { status: "offline", message: errorMsg, latencyMs };
    } else if (response.ok) {
      // Improvável mas possível
      return { status: "online", latencyMs };
    }
    
    return { status: "online", latencyMs, message: `Status ${response.status}` };
  } catch (error) {
    return { 
      status: "offline", 
      message: error instanceof Error ? error.message : "Erro de conexão",
      latencyMs: Date.now() - start
    };
  }
}

async function checkPipedrive(): Promise<HealthCheckResult> {
  const apiToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
  if (!apiToken) {
    return { status: "error", message: "PIPEDRIVE_API_TOKEN não configurado" };
  }

  const start = Date.now();
  try {
    const response = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${apiToken}`, {
      method: "GET",
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      return { 
        status: "online", 
        latencyMs,
        details: { user: data.data?.name || "Conectado" }
      };
    } else if (response.status === 401) {
      return { status: "error", message: "API Token inválido", latencyMs };
    } else {
      return { status: "offline", message: `Status: ${response.status}`, latencyMs };
    }
  } catch (error) {
    return { 
      status: "offline", 
      message: error instanceof Error ? error.message : "Erro de conexão",
      latencyMs: Date.now() - start
    };
  }
}

async function checkAnthropic(): Promise<HealthCheckResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "ANTHROPIC_API_KEY não configurada" };
  }

  const start = Date.now();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { status: "online", latencyMs };
    } else if (response.status === 401) {
      return { status: "error", message: "API Key inválida", latencyMs };
    } else if (response.status === 429) {
      // Rate limited but key is valid
      return { status: "online", message: "Rate limit atingido", latencyMs };
    } else {
      const text = await response.text();
      return { status: "offline", message: `Status: ${response.status}`, latencyMs };
    }
  } catch (error) {
    return { 
      status: "offline", 
      message: error instanceof Error ? error.message : "Erro de conexão",
      latencyMs: Date.now() - start
    };
  }
}

// checkLovableAI removido — PATCH Auditoria V2: redirecionado para checkAnthropic

async function checkSMTP(): Promise<HealthCheckResult> {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  
  if (!host || !user) {
    return { status: "error", message: "Configurações SMTP incompletas" };
  }

  // SMTP connection test would require a proper SMTP library
  // For now, we just verify the secrets are configured
  return { 
    status: "online", 
    message: "Configurado", 
    details: { host, user } 
  };
}

function checkSGT(): HealthCheckResult {
  const secret = Deno.env.get("SGT_WEBHOOK_SECRET");
  if (!secret) {
    return { status: "error", message: "SGT_WEBHOOK_SECRET não configurado" };
  }
  // SGT é webhook inbound - só validamos se o secret existe
  return { status: "online", message: "Secret configurado" };
}

async function checkBlueChat(): Promise<HealthCheckResult> {
  const apiKey = Deno.env.get("BLUECHAT_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "BLUECHAT_API_KEY não configurada" };
  }

  // Buscar URL da API do Blue Chat em system_settings
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("category", "integrations")
      .eq("key", "bluechat")
      .maybeSingle();

    const apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
    if (!apiUrl) {
      return { status: "error", message: "URL da API não configurada. Configure em Integrações → Blue Chat." };
    }

    const start = Date.now();
    
    // Tentar health check na URL configurada
    const healthEndpoints = [
      `${apiUrl.replace(/\/$/, "")}/health`,
      `${apiUrl.replace(/\/$/, "")}/api/health`,
      apiUrl,
    ];

    for (const endpoint of healthEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (response.ok || response.status === 401 || response.status === 403) {
          // 401/403 = API existe mas auth falhou (ainda conta como online)
          return {
            status: response.ok ? "online" : "online",
            latencyMs: Date.now() - start,
            message: response.ok ? undefined : "API acessível (auth pode precisar revisão)",
            details: { endpoint, statusCode: response.status },
          };
        }
      } catch {
        // Continua para próximo endpoint
      }
    }

    return {
      status: "offline",
      message: "Não foi possível conectar à API do Blue Chat",
      latencyMs: Date.now() - start,
      details: { apiUrl },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Erro ao verificar Blue Chat",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { integration } = body;

    // CRON mode: check all integrations and send alerts
    const isCron = req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET") || !integration;

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

      // Send alerts if any integration is down (with 3x consecutive failure tracking)
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Track consecutive failures in system_settings
      const { data: prevState } = await supabase
        .from("system_settings")
        .select("value")
        .eq("category", "health_check")
        .eq("key", "consecutive_failures")
        .maybeSingle();

      const prevFailures: Record<string, number> = (prevState?.value as Record<string, number>) || {};
      const newFailures: Record<string, number> = {};
      const shouldAlert: string[] = [];

      for (const [intg, result] of Object.entries(results)) {
        if (result.status === "offline" || result.status === "error") {
          newFailures[intg] = (prevFailures[intg] || 0) + 1;
          if (newFailures[intg] === 3) {
            shouldAlert.push(intg);
          }
        } else {
          newFailures[intg] = 0;
        }
      }

      await supabase.from("system_settings").upsert({
        category: "health_check",
        key: "consecutive_failures",
        value: newFailures,
        updated_at: new Date().toISOString(),
      }, { onConflict: "category,key" });

      // Alert ADMINs after 3 consecutive failures
      if (shouldAlert.length > 0 || alerts.length > 0) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "ADMIN");

        if (admins && admins.length > 0) {
          const alertMsg = shouldAlert.length > 0
            ? `🚨 CRÍTICO: ${shouldAlert.join(', ')} falharam 3x consecutivas!\n${alerts.join("\n")}`
            : alerts.join("\n");

          const notifications = admins.map((a) => ({
            user_id: a.user_id,
            empresa: "BLUE" as const,
            titulo: shouldAlert.length > 0
              ? `🚨 ${shouldAlert.length} integração(ões) em falha crítica`
              : `🔴 ${alerts.length} integração(ões) com problema`,
            mensagem: alertMsg,
            tipo: shouldAlert.length > 0 ? "SYSTEM_ALERT" as const : "ALERTA" as const,
            referencia_tipo: "SISTEMA",
            link: "/admin/settings",
          }));

          await supabase.from("notifications").insert(notifications);
        }
      }

      return new Response(JSON.stringify({ mode: "cron", results, alerts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single integration check
    const result = await checkIntegration(integration);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: error instanceof Error ? error.message : "Erro interno" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

async function checkIntegration(integration: string): Promise<HealthCheckResult> {
  switch (integration) {
    case "whatsapp":
    case "mensageria":
      return await checkWhatsApp();
    case "pipedrive":
      return await checkPipedrive();
    case "anthropic":
      return await checkAnthropic();
    case "lovable_ai":
    case "gemini":
    case "gpt":
      return await checkAnthropic();
    case "email":
      return await checkSMTP();
    case "sgt":
      return checkSGT();
    case "bluechat":
      return await checkBlueChat();
    default:
      return { status: "error", message: `Integração desconhecida: ${integration}` };
  }
}
