// ========================================
// sdr-proactive-outreach — Amélia proactive SDR outreach via Blue Chat
// Opens a conversation, generates a personalized greeting, sends it, and records everything.
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, getOptionalEnv } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-provider.ts";

// ── helpers ──

function jsonResponse(body: unknown, req: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

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

  const apiKey = getOptionalEnv("BLUECHAT_API_KEY");
  if (!apiKey) return null;

  return { baseUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

// ── main ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);

  const serviceClient = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Auth — accept service_role or authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, req, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { lead_id, empresa, motivo } = body as {
      lead_id?: string;
      empresa?: string;
      motivo?: string;
    };

    if (!lead_id || !empresa) {
      return jsonResponse({ error: "Missing lead_id or empresa" }, req, 400);
    }

    // 1. Fetch lead data
    const { data: lead, error: leadErr } = await serviceClient
      .from("lead_contacts")
      .select("lead_id, empresa, nome, primeiro_nome, telefone, telefone_e164, email")
      .eq("lead_id", lead_id)
      .eq("empresa", empresa)
      .maybeSingle();

    if (leadErr || !lead) {
      return jsonResponse({ error: "Lead not found", detail: leadErr?.message }, req, 404);
    }

    const phone = lead.telefone_e164 || lead.telefone;
    if (!phone) {
      return jsonResponse({ error: "Lead has no phone number" }, req, 400);
    }

    // 2. Rate-limit: check last OUTBOUND message in 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOutbound } = await serviceClient
      .from("lead_messages")
      .select("id")
      .eq("lead_id", lead_id)
      .eq("empresa", empresa)
      .eq("direcao", "OUTBOUND")
      .gte("created_at", twentyFourHoursAgo)
      .limit(1);

    if (recentOutbound && recentOutbound.length > 0) {
      return jsonResponse(
        { error: "Lead already contacted in the last 24h", rate_limited: true },
        req,
        429
      );
    }

    // 3. Fetch classification context
    const { data: classification } = await serviceClient
      .from("lead_classifications")
      .select("temperatura, perfil_investidor")
      .eq("lead_id", lead_id)
      .eq("empresa", empresa)
      .maybeSingle();

    // 4. Generate greeting via AI
    const firstName = lead.primeiro_nome || lead.nome?.split(" ")[0] || "Lead";
    const empresaLabel = empresa === "BLUE" ? "Blue Consult" : "Tokeniza";
    const temp = classification?.temperatura || "MORNO";

    const systemPrompt = `Você é a Amélia, SDR da ${empresaLabel}. Personalidade: informal mas profissional, empática, objetiva. Use no máximo 1 emoji. Nunca use elogios genéricos como "prazer em conhecê-lo". Seja direta e humana.`;

    const userPrompt = `Gere UMA ÚNICA mensagem curta de primeiro contato para o lead "${firstName}".
Contexto: ${motivo || "MQL cadastrado"}.
Temperatura: ${temp}.
Objetivo: descobrir a necessidade do lead e iniciar qualificação.
Máximo 200 caracteres. Responda APENAS com o texto da mensagem, sem aspas.`;

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userPrompt,
      functionName: "sdr-proactive-outreach",
      empresa,
      temperature: 0.7,
      maxTokens: 200,
      supabase: serviceClient,
    });

    const greetingMessage = aiResult.content.trim();
    if (!greetingMessage) {
      return jsonResponse({ error: "AI failed to generate greeting", model: aiResult.model }, req, 500);
    }

    // 5. Resolve Blue Chat config
    const bcConfig = await resolveBlueChat(serviceClient, empresa);
    if (!bcConfig) {
      return jsonResponse({ error: "Blue Chat not configured for this empresa" }, req, 404);
    }

    const bcHeaders = {
      "Content-Type": "application/json",
      "X-API-Key": bcConfig.apiKey,
    };

    // 6. Open conversation in Blue Chat
    let conversationId: string | null = null;
    let ticketId: string | null = null;

    try {
      const openRes = await fetch(`${bcConfig.baseUrl}/conversations`, {
        method: "POST",
        headers: bcHeaders,
        body: JSON.stringify({
          phone,
          contact_name: lead.nome || firstName,
          channel: "whatsapp",
          source: "AMELIA",
        }),
      });

      if (!openRes.ok) {
        const errText = await openRes.text();
        console.error("Blue Chat open-conversation error:", openRes.status, errText);
        return jsonResponse(
          { error: "Failed to open Blue Chat conversation", detail: errText },
          req,
          openRes.status
        );
      }

      const openData = await openRes.json();
      conversationId = openData?.conversation_id || openData?.id || null;
      ticketId = openData?.ticket_id || null;
    } catch (err) {
      console.error("open-conversation fetch error:", err);
      return jsonResponse({ error: "Failed to connect to Blue Chat" }, req, 502);
    }

    if (!conversationId) {
      return jsonResponse({ error: "Blue Chat returned no conversation_id" }, req, 502);
    }

    // 7. Send message via Blue Chat
    let messageId: string | null = null;
    try {
      const sendRes = await fetch(
        `${bcConfig.baseUrl}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: bcHeaders,
          body: JSON.stringify({
            content: greetingMessage,
            type: "text",
            source: "AMELIA",
          }),
        }
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error("Blue Chat send-message error:", sendRes.status, errText);
        // Conversation opened but message failed — still record what we can
      } else {
        const sendData = await sendRes.json().catch(() => ({}));
        messageId = sendData?.id || sendData?.message_id || null;
      }
    } catch (err) {
      console.error("send-message fetch error:", err);
    }

    // 8. Record outbound message in lead_messages
    const { data: savedMsg } = await serviceClient.from("lead_messages").insert({
      lead_id,
      empresa,
      direcao: "OUTBOUND",
      canal: "WHATSAPP",
      conteudo: greetingMessage,
      remetente: "AMELIA",
      source: "BLUECHAT",
      metadata: {
        bluechat_conversation_id: conversationId,
        bluechat_message_id: messageId,
        bluechat_ticket_id: ticketId,
        proactive_outreach: true,
        motivo: motivo || "MQL cadastrado",
        ai_model: aiResult.model,
      },
    }).select("id").maybeSingle();

    // 9. Update conversation state
    await serviceClient.from("lead_conversation_state").upsert(
      {
        lead_id,
        empresa,
        canal: "WHATSAPP",
        estado_funil: "SAUDACAO",
        framework_ativo: "SPIN",
        modo: "SDR_IA",
        framework_data: { bluechat_conversation_id: conversationId },
        ultimo_contato_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,empresa" }
    );

    // 10. Update deal if exists (set owner to Amélia bot + etiqueta)
    let dealUpdated = false;
    const { data: contact } = await serviceClient
      .from("contacts")
      .select("id")
      .eq("legacy_lead_id", lead_id)
      .maybeSingle();

    if (contact?.id) {
      const { data: deal } = await serviceClient
        .from("deals")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("status", "ABERTO")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deal?.id) {
        await serviceClient
          .from("deals")
          .update({ etiqueta: "Atendimento IA", updated_at: new Date().toISOString() })
          .eq("id", deal.id);
        dealUpdated = true;
      }
    }

    console.log(
      `[sdr-proactive-outreach] ✅ ${empresa} lead=${lead_id} conv=${conversationId} msg="${greetingMessage.substring(0, 50)}..."`
    );

    return jsonResponse(
      {
        success: true,
        lead_id,
        conversation_id: conversationId,
        ticket_id: ticketId,
        message_sent: greetingMessage,
        message_id: savedMsg?.id || null,
        ai_model: aiResult.model,
        deal_updated: dealUpdated,
      },
      req
    );
  } catch (err) {
    console.error("[sdr-proactive-outreach] Unexpected error:", err);
    return jsonResponse(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      req,
      500
    );
  }
});
