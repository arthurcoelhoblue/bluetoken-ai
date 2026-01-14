import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
        connectionName: "mensageria", 
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

async function checkLovableAI(): Promise<HealthCheckResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "LOVABLE_API_KEY não configurada" };
  }

  const start = Date.now();
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { status: "online", latencyMs, details: { provider: "Lovable AI Gateway" } };
    } else if (response.status === 401) {
      return { status: "error", message: "API Key inválida", latencyMs };
    } else if (response.status === 429) {
      return { status: "online", message: "Rate limit atingido", latencyMs };
    } else if (response.status === 402) {
      return { status: "error", message: "Créditos insuficientes", latencyMs };
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

function checkBlueChat(): HealthCheckResult {
  const apiKey = Deno.env.get("BLUECHAT_API_KEY");
  if (!apiKey) {
    return { status: "error", message: "BLUECHAT_API_KEY não configurada" };
  }
  // Blue Chat é webhook inbound - só validamos se o secret existe
  return { status: "online", message: "Secret configurado" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration } = await req.json();

    let result: HealthCheckResult;

    switch (integration) {
      case "whatsapp":
      case "mensageria":
        result = await checkWhatsApp();
        break;
      case "pipedrive":
        result = await checkPipedrive();
        break;
      case "anthropic":
        result = await checkAnthropic();
        break;
      case "lovable_ai":
      case "gemini":
      case "gpt":
        result = await checkLovableAI();
        break;
      case "email":
        result = await checkSMTP();
        break;
      case "sgt":
        result = checkSGT();
        break;
      case "bluechat":
        result = checkBlueChat();
        break;
      default:
        result = { status: "error", message: `Integração desconhecida: ${integration}` };
    }

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
