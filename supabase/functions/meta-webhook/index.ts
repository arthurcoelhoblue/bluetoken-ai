import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

// ========================================
// Meta Cloud API — Webhook Handler
// GET  → Verification handshake
// POST → Inbound messages + Status updates
// ========================================

const log = createLogger("meta-webhook");
const corsHeaders = getWebhookCorsHeaders("x-hub-signature-256");

type EmpresaTipo = "TOKENIZA" | "BLUE";

// ---- Status mapping ----
const META_STATUS_MAP: Record<string, string> = {
  sent: "ENVIADO",
  delivered: "ENTREGUE",
  read: "LIDO",
  failed: "FALHA",
};

// ---- Phone normalization (same as whatsapp-inbound) ----
function normalizePhone(raw: string): string {
  let n = raw.replace(/\D/g, "");
  if (n.length === 11) n = "55" + n;
  return n;
}

function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [phone];
  const withoutDDI = phone.startsWith("55") ? phone.slice(2) : phone;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);
  if (number.length === 8) {
    variations.push(`55${ddd}9${number}`, `${ddd}9${number}`);
  }
  if (number.length === 9 && number.startsWith("9")) {
    variations.push(`55${ddd}${number.slice(1)}`, `${ddd}${number.slice(1)}`);
  }
  variations.push(withoutDDI);
  return [...new Set(variations)];
}

// ---- HMAC signature validation ----
async function verifySignature(
  body: string,
  signatureHeader: string | null
): Promise<boolean> {
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appSecret) {
    log.warn("META_APP_SECRET not configured, skipping signature validation");
    return true; // allow during initial setup
  }
  if (!signatureHeader) return false;

  const expectedSig = signatureHeader.replace("sha256=", "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hexSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hexSig === expectedSig;
}

// ---- Lead lookup (simplified from whatsapp-inbound) ----
interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  telefone: string | null;
}

async function findLeadByPhone(
  supabase: ReturnType<typeof createServiceClient>,
  phoneNormalized: string
): Promise<LeadContact | null> {
  const e164 = phoneNormalized.startsWith("+")
    ? phoneNormalized
    : `+${phoneNormalized}`;

  // 1. Try telefone_e164
  const { data: e164Match } = await supabase
    .from("lead_contacts")
    .select("*")
    .eq("telefone_e164", e164)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e164Match) return e164Match as LeadContact;

  // 2. Try phone variations
  const variations = generatePhoneVariations(phoneNormalized);
  for (const variant of variations) {
    const { data } = await supabase
      .from("lead_contacts")
      .select("*")
      .eq("telefone", variant)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadContact;
  }

  // 3. Last 8 digits fallback
  const last8 = phoneNormalized.slice(-8);
  const { data: partial } = await supabase
    .from("lead_contacts")
    .select("*")
    .like("telefone", `%${last8}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (partial) return partial as LeadContact;

  return null;
}

// ---- Handle inbound message ----
async function handleMessage(
  supabase: ReturnType<typeof createServiceClient>,
  msg: {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
  }
): Promise<{ success: boolean; messageId?: string; status: string }> {
  // Only handle text for now
  const textContent = msg.text?.body || `[${msg.type}]`;
  const phoneNormalized = normalizePhone(msg.from);

  // Dedup
  const { data: existing } = await supabase
    .from("lead_messages")
    .select("id")
    .eq("whatsapp_message_id", msg.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    log.info("Duplicate message", { wamid: msg.id });
    return { success: true, status: "DUPLICATE" };
  }

  const lead = await findLeadByPhone(supabase, phoneNormalized);
  const empresa: EmpresaTipo = lead?.empresa || "TOKENIZA";

  // Find active cadence run
  let runId: string | null = null;
  if (lead) {
    const { data: run } = await supabase
      .from("lead_cadence_runs")
      .select("id")
      .eq("lead_id", lead.lead_id)
      .eq("empresa", lead.empresa)
      .eq("status", "ATIVA")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (run) runId = (run as { id: string }).id;
  }

  // Save message
  const { data: saved, error } = await supabase
    .from("lead_messages")
    .insert({
      lead_id: lead?.lead_id || null,
      empresa,
      run_id: runId,
      canal: "WHATSAPP",
      direcao: "INBOUND",
      conteudo: textContent,
      estado: lead ? "RECEBIDO" : "UNMATCHED",
      whatsapp_message_id: msg.id,
      recebido_em: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    log.error("Error saving message", { error: error.message });
    return { success: false, status: "ERROR" };
  }

  const savedId = (saved as { id: string }).id;
  log.info("Message saved", { id: savedId, leadId: lead?.lead_id });

  // Update last_inbound_at for 24h window
  if (lead) {
    await supabase
      .from("lead_conversation_state")
      .upsert(
        {
          lead_id: lead.lead_id,
          empresa: lead.empresa,
          canal: "WHATSAPP",
          last_inbound_at: new Date().toISOString(),
          ultimo_contato_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lead_id,empresa" }
      );
    log.info("last_inbound_at updated", { leadId: lead.lead_id });
  }

  // Register cadence event
  if (runId) {
    await supabase.from("lead_cadence_events").insert({
      lead_cadence_run_id: runId,
      step_ordem: 0,
      template_codigo: "INBOUND_RESPONSE",
      tipo_evento: "RESPOSTA_DETECTADA",
      detalhes: {
        message_id: savedId,
        whatsapp_message_id: msg.id,
        preview: textContent.substring(0, 100),
        source: "meta-webhook",
      },
    });
  }

  // Trigger SDR-IA interpret (fire-and-forget with retry)
  if (lead) {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/sdr-ia-interpret`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ messageId: savedId }),
          }
        );
        if (resp.ok) {
          const iaResult = await resp.json();
          log.info("SDR-IA ok", iaResult);
          break;
        }
        const _body = await resp.text();
        log.error(`SDR-IA attempt ${attempt + 1} failed`, { status: resp.status });
        if (attempt < 2 && [500, 502, 503, 504].includes(resp.status)) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      } catch (e) {
        log.error(`SDR-IA error attempt ${attempt + 1}`, { error: String(e) });
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  return { success: true, messageId: savedId, status: lead ? "MATCHED" : "UNMATCHED" };
}

// ---- Handle status update ----
async function handleStatus(
  supabase: ReturnType<typeof createServiceClient>,
  status: { id: string; status: string; timestamp: string; errors?: Array<{ code: number; title: string }> }
): Promise<void> {
  const estadoInterno = META_STATUS_MAP[status.status];
  if (!estadoInterno) {
    log.warn("Unknown status", { status: status.status });
    return;
  }

  const updateData: Record<string, unknown> = { estado: estadoInterno };
  if (status.status === "failed" && status.errors?.length) {
    updateData.erro_envio = JSON.stringify(status.errors);
  }

  const { error, count } = await supabase
    .from("lead_messages")
    .update(updateData)
    .eq("whatsapp_message_id", status.id);

  if (error) {
    log.error("Status update error", { error: error.message, wamid: status.id });
  } else {
    log.info("Status updated", { wamid: status.id, status: estadoInterno, count });
  }
}

// ========================================
// Main handler
// ========================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---- GET: Webhook verification ----
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (!verifyToken) {
      log.error("META_WEBHOOK_VERIFY_TOKEN not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    if (mode === "subscribe" && token === verifyToken) {
      log.info("Webhook verified");
      return new Response(challenge || "", { status: 200 });
    }

    log.warn("Verification failed", { mode, tokenMatch: token === verifyToken });
    return new Response("Forbidden", { status: 403 });
  }

  // ---- POST: Process events ----
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Signature validation
  const sigHeader = req.headers.get("x-hub-signature-256");
  const sigValid = await verifySignature(rawBody, sigHeader);
  if (!sigValid) {
    log.error("Invalid signature");
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Must be from WhatsApp Business Account
  if (body.object !== "whatsapp_business_account") {
    log.warn("Ignoring non-WABA object", { object: body.object });
    return new Response("OK", { status: 200 });
  }

  const supabase = createServiceClient();
  const results: Array<{ type: string; result: unknown }> = [];

  const entries = (body.entry as Array<Record<string, unknown>>) || [];
  for (const entry of entries) {
    const changes =
      (entry.changes as Array<{ value: Record<string, unknown>; field: string }>) || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value;

      // Process messages
      const messages = (value.messages as Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>) || [];

      for (const msg of messages) {
        log.info("Processing inbound message", {
          from: msg.from,
          wamid: msg.id,
          type: msg.type,
        });
        const res = await handleMessage(supabase, msg);
        results.push({ type: "message", result: res });
      }

      // Process statuses
      const statuses = (value.statuses as Array<{
        id: string;
        status: string;
        timestamp: string;
        errors?: Array<{ code: number; title: string }>;
      }>) || [];

      for (const st of statuses) {
        log.info("Processing status", { wamid: st.id, status: st.status });
        await handleStatus(supabase, st);
        results.push({ type: "status", result: { wamid: st.id, status: st.status } });
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
