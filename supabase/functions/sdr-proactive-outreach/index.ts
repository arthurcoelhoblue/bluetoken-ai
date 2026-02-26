// ========================================
// sdr-proactive-outreach — Amélia proactive SDR outreach
// Generates a personalized greeting with deep context, sends via active channel (Mensageria or Meta Cloud), and records everything.
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { resolveChannelConfig, sendTextViaMetaCloud } from "../_shared/channel-resolver.ts";

// ── helpers ──

function jsonResponse(body: unknown, req: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── contact resolution ──

interface ResolvedLead {
  lead_id: string;
  empresa: string;
  nome: string | null;
  primeiro_nome: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
  synthetic: boolean;
}

async function resolveLeadFromContact(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  empresa: string,
): Promise<{ lead: ResolvedLead | null; error?: string }> {
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("id, legacy_lead_id, nome, primeiro_nome, telefone, telefone_e164, email, empresa")
    .eq("id", contactId)
    .maybeSingle();

  if (cErr || !contact) {
    return { lead: null, error: cErr?.message || "Contact not found" };
  }

  if (contact.legacy_lead_id) {
    const { data: existing } = await supabase
      .from("lead_contacts")
      .select("lead_id, empresa, nome, primeiro_nome, telefone, telefone_e164, email")
      .eq("lead_id", contact.legacy_lead_id)
      .eq("empresa", empresa)
      .maybeSingle();

    if (existing) {
      return { lead: { ...existing, synthetic: false } };
    }
  }

  const syntheticLeadId = `crm_${contactId}`;

  const { data: upserted, error: uErr } = await supabase
    .from("lead_contacts")
    .upsert(
      {
        lead_id: syntheticLeadId,
        empresa,
        nome: contact.nome,
        primeiro_nome: contact.primeiro_nome,
        telefone: contact.telefone,
        telefone_e164: contact.telefone_e164,
        email: contact.email,
      },
      { onConflict: "lead_id,empresa" }
    )
    .select("lead_id, empresa, nome, primeiro_nome, telefone, telefone_e164, email")
    .maybeSingle();

  if (uErr || !upserted) {
    return { lead: null, error: uErr?.message || "Failed to create synthetic lead" };
  }

  await supabase
    .from("contacts")
    .update({ legacy_lead_id: syntheticLeadId })
    .eq("id", contactId);

  return { lead: { ...upserted, synthetic: true } };
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
  empresa: string,
  contactId?: string,
): Promise<DeepContext> {
  const [msgRes, convRes, classRes, contactRes, sgtRes, learningsRes] = await Promise.all([
    supabase
      .from("lead_messages")
      .select("direcao, conteudo, created_at")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("lead_conversation_state")
      .select("estado_funil, framework_ativo, framework_data, perfil_disc, modo")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .maybeSingle(),
    supabase
      .from("lead_classifications")
      .select("temperatura, perfil_investidor, icp_score, tipo_lead")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .maybeSingle(),
    contactId
      ? Promise.resolve({ data: { id: contactId }, error: null })
      : supabase
          .from("contacts")
          .select("id")
          .eq("legacy_lead_id", leadId)
          .eq("empresa", empresa as "BLUE" | "TOKENIZA")
          .maybeSingle(),
    supabase
      .from("sgt_events")
      .select("tipo, descricao, created_at")
      .eq("lead_id", leadId)
      .eq("empresa", empresa)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("amelia_learnings")
      .select("titulo, descricao, categoria")
      .eq("empresa", empresa)
      .eq("status", "VALIDADO")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

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

  const fw = ctx.convState?.framework_data as Record<string, unknown> | undefined;
  const estadoFunil = (ctx.convState?.estado_funil as string) || "DESCONHECIDO";
  const frameworkAtivo = (ctx.convState?.framework_ativo as string) || "NONE";
  const perfilDisc = (ctx.convState?.perfil_disc as string) || "não identificado";
  const temp = (ctx.classification?.temperatura as string) || "MORNO";
  const perfilInvestidor = (ctx.classification?.perfil_investidor as string) || "";

  const lastMessages = ctx.messages.slice(-5);
  const historyText = lastMessages.length > 0
    ? lastMessages.map(m => `[${m.direcao}] ${(m.conteudo || "").substring(0, 100)}`).join("\n")
    : "Nenhuma conversa anterior.";

  let dealText = "Sem deal ativo.";
  if (ctx.deal) {
    const stageName = (ctx.deal.pipeline_stages as Record<string, unknown>)?.nome || "?";
    dealText = `${ctx.deal.titulo} — Estágio: ${stageName} — R$${ctx.deal.valor || 0}`;
  }

  const sgtText = ctx.sgtEvents.length > 0
    ? ctx.sgtEvents.map(e => `${e.tipo}: ${(e.descricao as string || "").substring(0, 60)}`).join("; ")
    : "Sem eventos SGT recentes.";

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

// ── send message via active channel ──

async function sendViaActiveChannel(
  supabase: ReturnType<typeof createClient>,
  empresa: string,
  leadId: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string; channel: string }> {
  const channelConfig = await resolveChannelConfig(supabase, empresa);

  if (channelConfig.mode === 'META_CLOUD') {
    const result = await sendTextViaMetaCloud(channelConfig, phone, message);
    return { ...result, channel: 'META_CLOUD' };
  }

  // DIRECT mode — send via whatsapp-send edge function (Mensageria/Baileys)
  const whatsappSendUrl = `${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`;
  try {
    const res = await fetch(whatsappSendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        telefone: phone,
        mensagem: message,
        leadId,
        empresa,
        source: "AMELIA_SDR",
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return { success: false, error: `whatsapp-send error ${res.status}: ${text}`, channel: 'DIRECT' };
    }

    const data = JSON.parse(text || "{}");
    return { success: true, messageId: data?.messageId || data?.message_id, channel: 'DIRECT' };
  } catch (err) {
    return { success: false, error: `whatsapp-send fetch error: ${err}`, channel: 'DIRECT' };
  }
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
    const rawBody = body as {
      lead_id?: string;
      contact_id?: string;
      empresa?: string;
      motivo?: string;
      objetivo?: string;
      bypass_rate_limit?: boolean;
    };

    const lead_id = rawBody.lead_id?.trim() || undefined;
    const contact_id = rawBody.contact_id?.trim() || undefined;
    const empresa = rawBody.empresa?.trim() || undefined;
    const motivo = rawBody.motivo;
    const objetivo = rawBody.objetivo;
    const bypass_rate_limit = rawBody.bypass_rate_limit;

    if ((!lead_id && !contact_id) || !empresa) {
      return jsonResponse({ error: "Missing lead_id/contact_id or empresa" }, req, 400);
    }

    // ── Resolve lead data ──
    let lead: ResolvedLead | null = null;
    let resolvedContactId: string | undefined = contact_id || undefined;

    if (lead_id) {
      const { data: leadData, error: leadErr } = await serviceClient
        .from("lead_contacts")
        .select("lead_id, empresa, nome, primeiro_nome, telefone, telefone_e164, email")
        .eq("lead_id", lead_id)
        .eq("empresa", empresa)
        .maybeSingle();

      if (leadErr || !leadData) {
        return jsonResponse({ error: "Lead not found", detail: leadErr?.message }, req, 404);
      }
      lead = { ...leadData, synthetic: false };
    } else if (contact_id) {
      const result = await resolveLeadFromContact(serviceClient, contact_id, empresa);
      if (!result.lead) {
        return jsonResponse({ error: "Contact not found", detail: result.error }, req, 404);
      }
      lead = result.lead;
    }

    if (!lead) {
      return jsonResponse({ error: "Could not resolve lead" }, req, 400);
    }

    const effectiveLeadId = lead.lead_id;
    const phone = lead.telefone_e164 || lead.telefone;
    if (!phone) {
      return jsonResponse({ error: "Lead has no phone number" }, req, 400);
    }

    // 2. Rate-limit
    if (!bypass_rate_limit) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentOutbound } = await serviceClient
        .from("lead_messages")
        .select("id")
        .eq("lead_id", effectiveLeadId)
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

    // 3. Load deep context
    const ctx = await loadDeepContext(serviceClient, effectiveLeadId, empresa, resolvedContactId);

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

    // 5. Send via active channel (Mensageria or Meta Cloud)
    const sendResult = await sendViaActiveChannel(serviceClient, empresa, effectiveLeadId, phone, greetingMessage);

    if (!sendResult.success) {
      return jsonResponse(
        { error: "Failed to send message", detail: sendResult.error, channel: sendResult.channel },
        req,
        502
      );
    }

    // 6. Record outbound message in lead_messages
    const { data: savedMsg } = await serviceClient.from("lead_messages").insert({
      lead_id: effectiveLeadId,
      empresa,
      direcao: "OUTBOUND",
      canal: "WHATSAPP",
      conteudo: greetingMessage,
      estado: "ENVIADA",
      template_codigo: "proactive_outreach",
      enviado_em: new Date().toISOString(),
      whatsapp_message_id: sendResult.messageId || undefined,
    }).select("id").maybeSingle();

    // 7. Update conversation state
    await serviceClient.from("lead_conversation_state").upsert(
      {
        lead_id: effectiveLeadId,
        empresa,
        canal: "WHATSAPP",
        estado_funil: (ctx.convState?.estado_funil as string) || "SAUDACAO",
        framework_ativo: (ctx.convState?.framework_ativo as string) || "SPIN",
        modo: "SDR_IA",
        framework_data: ctx.convState?.framework_data as Record<string, unknown> || {},
        ultimo_contato_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,empresa" }
    );

    // 8. Update deal if exists
    let dealUpdated = false;
    let dealContactId: string | null = resolvedContactId || null;

    if (!dealContactId) {
      const { data: contact } = await serviceClient
        .from("contacts")
        .select("id")
        .eq("legacy_lead_id", effectiveLeadId)
        .maybeSingle();
      dealContactId = contact?.id || null;
    }

    if (dealContactId) {
      const { data: dealRow } = await serviceClient
        .from("deals")
        .select("id")
        .eq("contact_id", dealContactId)
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
      `[sdr-proactive-outreach] ✅ ${empresa} lead=${effectiveLeadId} channel=${sendResult.channel} synthetic=${lead.synthetic} ctx={msgs:${ctx.messages.length},deal:${!!ctx.deal},fw:${ctx.convState?.framework_ativo}} msg="${greetingMessage.substring(0, 50)}..."`
    );

    return jsonResponse(
      {
        success: true,
        lead_id: effectiveLeadId,
        contact_id: resolvedContactId || null,
        channel: sendResult.channel,
        message_sent: greetingMessage,
        message_id: savedMsg?.id || null,
        whatsapp_message_id: sendResult.messageId || null,
        ai_model: aiResult.model,
        deal_updated: dealUpdated,
        synthetic_lead: lead.synthetic,
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
