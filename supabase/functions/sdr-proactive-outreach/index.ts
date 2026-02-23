// ========================================
// sdr-proactive-outreach — Amélia proactive SDR outreach via Blue Chat
// Opens a conversation, generates a personalized greeting with deep context, sends it, and records everything.
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

  let apiKey = (setting?.value as Record<string, unknown>)?.api_key as string | undefined;
  if (!apiKey) {
    apiKey = getOptionalEnv("BLUECHAT_API_KEY") || undefined;
  }
  if (!apiKey) return null;

  return { baseUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

// ── context loading ──

interface DeepContext {
  messages: Array<{ direcao: string; conteudo: string; created_at: string }>;
  convState: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
  deal: Record<string, unknown> | null;
  sgtEvents: Array<Record<string, unknown>>;
  learnings: Array<Record<string, unknown>>;
}

async function loadDeepContext(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  empresa: string
): Promise<DeepContext> {
  // All queries in parallel
  const [msgRes, convRes, classRes, contactRes, sgtRes, learningsRes] = await Promise.all([
    // 1. Last 20 messages
    supabase
      .from("lead_messages")
      .select("direcao, conteudo, created_at")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .order("created_at", { ascending: false })
      .limit(20),
    // 2. Conversation state
    supabase
      .from("lead_conversation_state")
      .select("estado_funil, framework_ativo, framework_data, perfil_disc, modo")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .maybeSingle(),
    // 3. Classification
    supabase
      .from("lead_classifications")
      .select("temperatura, perfil_investidor, icp_score, tipo_lead")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .maybeSingle(),
    // 4. Contact (to find deal)
    supabase
      .from("contacts")
      .select("id")
      .eq("legacy_lead_id", leadId)
      .eq("empresa", empresa as "BLUE" | "TOKENIZA")
      .maybeSingle(),
    // 5. SGT events (last 5)
    supabase
      .from("sgt_events")
      .select("tipo, descricao, created_at")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .order("created_at", { ascending: false })
      .limit(5),
    // 6. Validated learnings
    supabase
      .from("amelia_learnings")
      .select("titulo, descricao, categoria")
      .eq("empresa", empresa)
      .eq("status", "VALIDADO")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Load deal if contact exists
  let deal: Record<string, unknown> | null = null;
  if (contactRes.data?.id) {
    const { data: dealData } = await supabase
      .from("deals")
      .select("titulo, valor, temperatura, status, stage_id, pipeline_stages(nome)")
      .eq("contact_id", contactRes.data.id)
      .eq("status", "ABERTO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dealData) {
      deal = dealData as Record<string, unknown>;
    }
  }

  return {
    messages: (msgRes.data ?? []).reverse() as DeepContext["messages"],
    convState: convRes.data as Record<string, unknown> | null,
    classification: classRes.data as Record<string, unknown> | null,
    deal,
    sgtEvents: (sgtRes.data ?? []) as Array<Record<string, unknown>>,
    learnings: (learningsRes.data ?? []) as Array<Record<string, unknown>>,
  };
}

// ── prompt builder ──

function buildContextualPrompt(
  lead: Record<string, unknown>,
  ctx: DeepContext,
  empresa: string,
  objetivo?: string
): { system: string; user: string } {
  const firstName = (lead.primeiro_nome || (lead.nome as string)?.split(" ")[0] || "Lead") as string;
  const empresaLabel = empresa === "BLUE" ? "Blue Consult" : empresa === "TOKENIZA" ? "Tokeniza" : empresa;

  // Extract framework data
  const fw = ctx.convState?.framework_data as Record<string, unknown> | undefined;
  const estadoFunil = (ctx.convState?.estado_funil as string) || "DESCONHECIDO";
  const frameworkAtivo = (ctx.convState?.framework_ativo as string) || "NONE";
  const perfilDisc = (ctx.convState?.perfil_disc as string) || "não identificado";
  const temp = (ctx.classification?.temperatura as string) || "MORNO";
  const perfilInvestidor = (ctx.classification?.perfil_investidor as string) || "";

  // Build message history snippet (last 5)
  const lastMessages = ctx.messages.slice(-5);
  const historyText = lastMessages.length > 0
    ? lastMessages.map(m => `[${m.direcao}] ${(m.conteudo || "").substring(0, 100)}`).join("\n")
    : "Nenhuma conversa anterior.";

  // Deal info
  let dealText = "Sem deal ativo.";
  if (ctx.deal) {
    const stageName = (ctx.deal.pipeline_stages as Record<string, unknown>)?.nome || "?";
    dealText = `${ctx.deal.titulo} — Estágio: ${stageName} — R$${ctx.deal.valor || 0}`;
  }

  // SGT events
  const sgtText = ctx.sgtEvents.length > 0
    ? ctx.sgtEvents.map(e => `${e.tipo}: ${(e.descricao as string || "").substring(0, 60)}`).join("; ")
    : "Sem eventos SGT recentes.";

  // Framework progress
  let frameworkText = "Nenhum framework iniciado.";
  if (fw && frameworkAtivo !== "NONE") {
    if (frameworkAtivo === "SPIN") {
      frameworkText = `SPIN — S:${fw.S ? "✓" : "?"} P:${fw.P ? "✓" : "?"} I:${fw.I ? "✓" : "?"} N:${fw.N ? "✓" : "?"}`;
    } else if (frameworkAtivo === "GPCT") {
      frameworkText = `GPCT — G:${fw.G ? "✓" : "?"} P:${fw.P ? "✓" : "?"} C:${fw.C ? "✓" : "?"} T:${fw.T ? "✓" : "?"}`;
    } else if (frameworkAtivo === "BANT") {
      frameworkText = `BANT — B:${fw.B ? "✓" : "?"} A:${fw.A ? "✓" : "?"} N:${fw.N ? "✓" : "?"} T:${fw.T ? "✓" : "?"}`;
    } else {
      frameworkText = `${frameworkAtivo}: ${JSON.stringify(fw).substring(0, 120)}`;
    }
  }

  // Learnings
  const learningsText = ctx.learnings.length > 0
    ? ctx.learnings.map(l => `- ${l.titulo}`).join("\n")
    : "";

  const system = `Você é a Amélia, SDR da ${empresaLabel}. Personalidade: informal mas profissional, empática, objetiva.
Analise TODO o contexto fornecido e gere UMA mensagem de abordagem.
Regras:
- Se já houve conversa anterior, retome naturalmente referenciando algo específico
- Se tem framework de qualificação incompleto, avance na qualificação com a próxima pergunta natural
- Adapte o tom ao perfil DISC do lead (${perfilDisc})
- Use no máximo 1 emoji
- Nunca use elogios genéricos como "prazer em conhecê-lo"
- Seja direta e humana
- Máximo 250 caracteres
- Objetivo: ${objetivo || "qualificar e avançar a conversa"}
${learningsText ? `\nAprendizados validados:\n${learningsText}` : ""}`;

  const user = `LEAD: ${firstName}
TEMPERATURA: ${temp}
PERFIL: ${perfilInvestidor || "não classificado"}
ESTADO_FUNIL: ${estadoFunil}
FRAMEWORK: ${frameworkText}
DEAL: ${dealText}
HISTORICO (últimas ${lastMessages.length} msgs):
${historyText}
SGT: ${sgtText}
OBJETIVO: ${objetivo || "qualificar e avançar conversa"}

Responda APENAS com o texto da mensagem, sem aspas.`;

  return { system, user };
}

// ── main ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);

  const serviceClient = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, req, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { lead_id, empresa, motivo, objetivo, bypass_rate_limit } = body as {
      lead_id?: string;
      empresa?: string;
      motivo?: string;
      objetivo?: string;
      bypass_rate_limit?: boolean;
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

    // 2. Rate-limit (skip if bypass_rate_limit=true — manual trigger by seller)
    if (!bypass_rate_limit) {
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
    }

    // 3. Load deep context in parallel
    const ctx = await loadDeepContext(serviceClient, lead_id, empresa);

    // 4. Generate contextual message via AI
    const { system: systemPrompt, user: userPrompt } = buildContextualPrompt(
      lead as unknown as Record<string, unknown>,
      ctx,
      empresa,
      objetivo || motivo
    );

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userPrompt,
      functionName: "sdr-proactive-outreach",
      empresa,
      temperature: 0.7,
      maxTokens: 300,
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

    // 6. Check if there's an existing conversation_id in framework_data
    let conversationId: string | null =
      (ctx.convState?.framework_data as Record<string, unknown>)?.bluechat_conversation_id as string | null ?? null;
    let messageId: string | null = null;
    let ticketId: string | null = null;

    // 6a. If no existing conversation, open one via POST /conversations
    if (!conversationId) {
      try {
        const openRes = await fetch(`${bcConfig.baseUrl}/conversations`, {
          method: "POST",
          headers: bcHeaders,
          body: JSON.stringify({
            phone,
            contact_name: lead.nome || lead.primeiro_nome,
            channel: "whatsapp",
            source: "AMELIA",
          }),
        });

        if (!openRes.ok) {
          const errText = await openRes.text();
          console.error("Blue Chat open-conversation error:", openRes.status, errText);
          return jsonResponse(
            { error: "Failed to open conversation in Blue Chat", detail: errText },
            req,
            openRes.status
          );
        }

        const openData = await openRes.json().catch(() => ({}));
        conversationId = openData?.conversation_id || openData?.id || null;
        ticketId = openData?.ticket_id || null;
      } catch (err) {
        console.error("open-conversation fetch error:", err);
        return jsonResponse({ error: "Failed to connect to Blue Chat" }, req, 502);
      }
    }

    if (!conversationId) {
      return jsonResponse({ error: "Could not obtain Blue Chat conversation ID" }, req, 500);
    }

    // 6b. Send message to the conversation via POST /conversations/{id}/messages
    try {
      const sendRes = await fetch(`${bcConfig.baseUrl}/messages`, {
        method: "POST",
        headers: bcHeaders,
        body: JSON.stringify({
          conversation_id: conversationId,
          content: greetingMessage,
          source: "AMELIA_SDR",
        }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error("Blue Chat send-message error:", sendRes.status, errText);
        return jsonResponse(
          { error: "Failed to send message via Blue Chat", detail: errText },
          req,
          sendRes.status
        );
      }

      const sendData = await sendRes.json().catch(() => ({}));
      messageId = sendData?.message_id || sendData?.id || null;
      if (!ticketId) ticketId = sendData?.ticket_id || null;
    } catch (err) {
      console.error("send-message fetch error:", err);
      return jsonResponse({ error: "Failed to connect to Blue Chat" }, req, 502);
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
        motivo: objetivo || motivo || "abordagem proativa",
        ai_model: aiResult.model,
        context_depth: {
          messages: ctx.messages.length,
          has_deal: !!ctx.deal,
          framework: ctx.convState?.framework_ativo || "NONE",
          sgt_events: ctx.sgtEvents.length,
        },
      },
    }).select("id").maybeSingle();

    // 9. Update conversation state
    await serviceClient.from("lead_conversation_state").upsert(
      {
        lead_id,
        empresa,
        canal: "WHATSAPP",
        estado_funil: (ctx.convState?.estado_funil as string) || "SAUDACAO",
        framework_ativo: (ctx.convState?.framework_ativo as string) || "SPIN",
        modo: "SDR_IA",
        framework_data: {
          ...(ctx.convState?.framework_data as Record<string, unknown> || {}),
          bluechat_conversation_id: conversationId,
        },
        ultimo_contato_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,empresa" }
    );

    // 10. Update deal if exists
    let dealUpdated = false;
    const { data: contact } = await serviceClient
      .from("contacts")
      .select("id")
      .eq("legacy_lead_id", lead_id)
      .maybeSingle();

    if (contact?.id) {
      const { data: dealRow } = await serviceClient
        .from("deals")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("status", "ABERTO")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dealRow?.id) {
        await serviceClient
          .from("deals")
          .update({ etiqueta: "Atendimento IA", updated_at: new Date().toISOString() })
          .eq("id", dealRow.id);
        dealUpdated = true;
      }
    }

    console.log(
      `[sdr-proactive-outreach] ✅ ${empresa} lead=${lead_id} conv=${conversationId} ctx={msgs:${ctx.messages.length},deal:${!!ctx.deal},fw:${ctx.convState?.framework_ativo}} msg="${greetingMessage.substring(0, 50)}..."`
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
