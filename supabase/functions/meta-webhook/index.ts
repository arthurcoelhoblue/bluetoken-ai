import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

// ========================================
// Meta Cloud API — Webhook Handler
// GET  → Verification handshake
// POST → Inbound messages + Status updates
// Supports: text, image, document, audio, video, sticker, location
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

// ---- Media type mapping ----
type MediaType = "text" | "image" | "document" | "audio" | "video" | "sticker" | "location" | "contacts";

interface MediaInfo {
  tipo_midia: MediaType;
  conteudo: string;
  media_meta_id?: string;
  media_mime_type?: string;
  media_filename?: string;
  media_caption?: string;
}

// ---- Phone normalization ----
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
    return true;
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

// ---- Resolve empresa from phone_number_id ----
async function resolveEmpresa(
  supabase: ReturnType<typeof createServiceClient>,
  phoneNumberId: string | null
): Promise<EmpresaTipo> {
  if (!phoneNumberId) return "TOKENIZA";
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("empresa")
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (data) {
    log.info("Empresa resolved via whatsapp_connections", { phoneNumberId, empresa: data.empresa });
    return data.empresa as EmpresaTipo;
  }
  log.warn("No whatsapp_connection found for phone_number_id, defaulting to TOKENIZA", { phoneNumberId });
  return "TOKENIZA";
}

// ---- Lead lookup ----
interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  telefone: string | null;
}

async function findLeadByPhone(
  supabase: ReturnType<typeof createServiceClient>,
  phoneNormalized: string,
  preferredEmpresa?: EmpresaTipo
): Promise<LeadContact | null> {
  const e164 = phoneNormalized.startsWith("+")
    ? phoneNormalized
    : `+${phoneNormalized}`;

  // Generate e164 variations (with/without 9th digit)
  const e164Variations = [e164];
  const rawDigits = e164.replace("+", "");
  const ddd = rawDigits.startsWith("55") ? rawDigits.slice(2, 4) : null;
  const numberPart = rawDigits.startsWith("55") ? rawDigits.slice(4) : null;
  if (ddd && numberPart) {
    if (numberPart.length === 8) {
      e164Variations.push(`+55${ddd}9${numberPart}`);
    } else if (numberPart.length === 9 && numberPart.startsWith("9")) {
      e164Variations.push(`+55${ddd}${numberPart.slice(1)}`);
    }
  }

  // Try e164 match (preferred empresa first)
  for (const variant of e164Variations) {
    if (preferredEmpresa) {
      const { data } = await supabase
        .from("lead_contacts")
        .select("*")
        .eq("telefone_e164", variant)
        .eq("empresa", preferredEmpresa)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as LeadContact;
    }
    const { data } = await supabase
      .from("lead_contacts")
      .select("*")
      .eq("telefone_e164", variant)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadContact;
  }

  // Try telefone variations (preferred empresa first)
  const variations = generatePhoneVariations(phoneNormalized);
  for (const variant of variations) {
    if (preferredEmpresa) {
      const { data } = await supabase
        .from("lead_contacts")
        .select("*")
        .eq("telefone", variant)
        .eq("empresa", preferredEmpresa)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return data as LeadContact;
    }
  }
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

  // Partial match (last 8 digits)
  const last8 = phoneNormalized.slice(-8);
  if (preferredEmpresa) {
    const { data } = await supabase
      .from("lead_contacts")
      .select("*")
      .like("telefone", `%${last8}`)
      .eq("empresa", preferredEmpresa)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as LeadContact;
  }
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

// ---- Auto-create lead_contact for unknown numbers ----
async function autoCreateLead(
  supabase: ReturnType<typeof createServiceClient>,
  phoneNormalized: string,
  empresa: EmpresaTipo,
  profileName: string | null
): Promise<LeadContact | null> {
  const e164 = phoneNormalized.startsWith("+") ? phoneNormalized : `+${phoneNormalized}`;

  // Generate all phone variations for dedup check
  const variations = generatePhoneVariations(phoneNormalized);
  const e164WithNine = phoneNormalized.length >= 10
    ? `+55${phoneNormalized.slice(phoneNormalized.startsWith("55") ? 2 : 0, phoneNormalized.startsWith("55") ? 4 : 2)}9${phoneNormalized.slice(phoneNormalized.startsWith("55") ? 4 : 2)}`
    : null;

  // Check all variations to prevent duplicates
  const allPhones = [...new Set([...variations, phoneNormalized])];
  for (const phone of allPhones) {
    const { data: existing } = await supabase
      .from("lead_contacts")
      .select("*")
      .eq("telefone", phone)
      .eq("empresa", empresa)
      .limit(1)
      .maybeSingle();
    if (existing) {
      log.info("Dedup: found existing lead_contact by telefone", { phone, leadId: existing.lead_id });
      return existing as LeadContact;
    }
  }

  // Also check e164 variations
  const e164Variants = [e164];
  const rawDigits = e164.replace("+", "");
  const ddd = rawDigits.startsWith("55") ? rawDigits.slice(2, 4) : null;
  const numberPart = rawDigits.startsWith("55") ? rawDigits.slice(4) : null;
  if (ddd && numberPart) {
    if (numberPart.length === 8) e164Variants.push(`+55${ddd}9${numberPart}`);
    if (numberPart.length === 9 && numberPart.startsWith("9")) e164Variants.push(`+55${ddd}${numberPart.slice(1)}`);
  }
  for (const ev of e164Variants) {
    const { data: existing } = await supabase
      .from("lead_contacts")
      .select("*")
      .eq("telefone_e164", ev)
      .eq("empresa", empresa)
      .limit(1)
      .maybeSingle();
    if (existing) {
      log.info("Dedup: found existing lead_contact by e164", { e164: ev, leadId: existing.lead_id });
      return existing as LeadContact;
    }
  }

  // No duplicate found, create new lead
  const phoneHash = phoneNormalized.slice(-8);
  const ts = Date.now();
  const leadId = `inbound_${phoneHash}_${ts}`;
  const nome = profileName || `WhatsApp ${phoneNormalized.slice(-4)}`;

  const { data, error } = await supabase
    .from("lead_contacts")
    .insert({
      lead_id: leadId,
      empresa,
      nome,
      telefone: phoneNormalized,
      telefone_e164: e164,
    })
    .select("*")
    .single();

  if (error) {
    log.error("Failed to auto-create lead_contact", { error: error.message, phone: phoneNormalized });
    return null;
  }

  log.info("Auto-created lead_contact for unknown number", { leadId, empresa, phone: phoneNormalized });
  return data as LeadContact;
}

// ---- Download media from Meta and upload to Storage ----
async function downloadMetaMedia(
  supabase: ReturnType<typeof createServiceClient>,
  mediaId: string,
  mimeType: string,
): Promise<string | null> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN_TOKENIZA") || Deno.env.get("META_ACCESS_TOKEN_BLUE");
  if (!accessToken) {
    // Try to get from whatsapp_connections
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("empresa")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (conn) {
      const settingsKey = `meta_cloud_${(conn.empresa as string).toLowerCase()}`;
      const { data: setting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("category", "integrations")
        .eq("key", settingsKey)
        .maybeSingle();
      const token = (setting?.value as Record<string, unknown>)?.access_token as string | undefined;
      if (token) return await doDownload(supabase, mediaId, mimeType, token);
    }
    log.error("No Meta access token available for media download");
    return null;
  }
  return await doDownload(supabase, mediaId, mimeType, accessToken);
}

async function doDownload(
  supabase: ReturnType<typeof createServiceClient>,
  mediaId: string,
  mimeType: string,
  accessToken: string,
): Promise<string | null> {
  try {
    // Step 1: Get media URL from Meta
    const metaResp = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResp.ok) {
      log.error("Failed to get media URL", { mediaId, status: metaResp.status });
      return null;
    }
    const metaData = await metaResp.json();
    const mediaUrl = metaData.url;
    if (!mediaUrl) return null;

    // Step 2: Download the actual file
    const fileResp = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileResp.ok) {
      log.error("Failed to download media file", { mediaId, status: fileResp.status });
      return null;
    }
    const fileBlob = await fileResp.blob();

    // Step 3: Upload to Supabase Storage
    const ext = mimeType.split("/")[1]?.split(";")[0] || "bin";
    const fileName = `${mediaId}.${ext}`;
    const storagePath = `inbound/${new Date().toISOString().slice(0, 10)}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBlob, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      log.error("Storage upload failed", { error: uploadError.message });
      return null;
    }

    // Step 4: Get public URL
    const { data: publicUrl } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    log.info("Media downloaded and stored", { mediaId, path: storagePath });
    return publicUrl.publicUrl;
  } catch (err) {
    log.error("Media download error", { error: String(err) });
    return null;
  }
}

// ---- Extract media info from message ----
function extractMediaInfo(msg: Record<string, unknown>): MediaInfo {
  const type = msg.type as string;

  switch (type) {
    case "image": {
      const img = msg.image as Record<string, unknown>;
      return {
        tipo_midia: "image",
        conteudo: (img?.caption as string) || "[Imagem]",
        media_meta_id: img?.id as string,
        media_mime_type: img?.mime_type as string,
        media_caption: img?.caption as string,
      };
    }
    case "document": {
      const doc = msg.document as Record<string, unknown>;
      return {
        tipo_midia: "document",
        conteudo: (doc?.caption as string) || `[Documento: ${doc?.filename || "arquivo"}]`,
        media_meta_id: doc?.id as string,
        media_mime_type: doc?.mime_type as string,
        media_filename: doc?.filename as string,
        media_caption: doc?.caption as string,
      };
    }
    case "audio": {
      const audio = msg.audio as Record<string, unknown>;
      return {
        tipo_midia: "audio",
        conteudo: "[Áudio]",
        media_meta_id: audio?.id as string,
        media_mime_type: audio?.mime_type as string,
      };
    }
    case "video": {
      const video = msg.video as Record<string, unknown>;
      return {
        tipo_midia: "video",
        conteudo: (video?.caption as string) || "[Vídeo]",
        media_meta_id: video?.id as string,
        media_mime_type: video?.mime_type as string,
        media_caption: video?.caption as string,
      };
    }
    case "sticker": {
      const sticker = msg.sticker as Record<string, unknown>;
      return {
        tipo_midia: "sticker",
        conteudo: "[Sticker]",
        media_meta_id: sticker?.id as string,
        media_mime_type: sticker?.mime_type as string,
      };
    }
    case "location": {
      const loc = msg.location as Record<string, unknown>;
      const lat = loc?.latitude;
      const lng = loc?.longitude;
      const name = loc?.name as string;
      return {
        tipo_midia: "location",
        conteudo: name
          ? `📍 ${name} (${lat}, ${lng})`
          : `📍 Localização: ${lat}, ${lng}`,
      };
    }
    case "contacts": {
      return {
        tipo_midia: "contacts",
        conteudo: "[Contato compartilhado]",
      };
    }
    case "text":
    default: {
      const text = msg.text as Record<string, unknown> | undefined;
      return {
        tipo_midia: "text",
        conteudo: (text?.body as string) || `[${type}]`,
      };
    }
  }
}

// ---- Handle inbound message ----
async function handleMessage(
  supabase: ReturnType<typeof createServiceClient>,
  msg: Record<string, unknown>,
  resolvedEmpresa: EmpresaTipo,
  profileName: string | null
): Promise<{ success: boolean; messageId?: string; status: string }> {
  const from = msg.from as string;
  const wamid = msg.id as string;
  const timestamp = msg.timestamp as string;
  const phoneNormalized = normalizePhone(from);

  // Extract media info
  const mediaInfo = extractMediaInfo(msg);

  // Dedup
  const { data: existing } = await supabase
    .from("lead_messages")
    .select("id")
    .eq("whatsapp_message_id", wamid)
    .limit(1)
    .maybeSingle();
  if (existing) {
    log.info("Duplicate message", { wamid });
    return { success: true, status: "DUPLICATE" };
  }

  let lead = await findLeadByPhone(supabase, phoneNormalized, resolvedEmpresa);
  
  // Auto-create lead if not found
  if (!lead) {
    log.info("No lead found, auto-creating", { phone: phoneNormalized, empresa: resolvedEmpresa });
    lead = await autoCreateLead(supabase, phoneNormalized, resolvedEmpresa, profileName);
  }

  const empresa: EmpresaTipo = lead?.empresa || resolvedEmpresa;

  // Download media if applicable
  let mediaUrl: string | null = null;
  if (mediaInfo.media_meta_id && mediaInfo.media_mime_type) {
    mediaUrl = await downloadMetaMedia(supabase, mediaInfo.media_meta_id, mediaInfo.media_mime_type);
  }

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
      conteudo: mediaInfo.conteudo,
      estado: lead ? "RECEBIDO" : "UNMATCHED",
      whatsapp_message_id: wamid,
      recebido_em: new Date(parseInt(timestamp) * 1000).toISOString(),
      tipo_midia: mediaInfo.tipo_midia,
      media_url: mediaUrl,
      media_mime_type: mediaInfo.media_mime_type || null,
      media_filename: mediaInfo.media_filename || null,
      media_caption: mediaInfo.media_caption || null,
      media_meta_id: mediaInfo.media_meta_id || null,
    })
    .select("id")
    .single();

  if (error) {
    log.error("Error saving message", { error: error.message });
    return { success: false, status: "ERROR" };
  }

  const savedId = (saved as { id: string }).id;
  log.info("Message saved", { id: savedId, leadId: lead?.lead_id, tipo_midia: mediaInfo.tipo_midia });

  // Update last_inbound_at for 24h window
  if (lead) {
    const now = new Date().toISOString();
    const { error: upsertErr } = await supabase
      .from("lead_conversation_state")
      .upsert(
        {
          lead_id: lead.lead_id,
          empresa: lead.empresa,
          canal: "WHATSAPP",
          last_inbound_at: now,
          ultimo_contato_em: now,
          updated_at: now,
        },
        { onConflict: "lead_id,empresa" }
      );
    if (upsertErr) {
      log.error("Upsert last_inbound_at failed, trying direct update", { error: upsertErr.message, leadId: lead.lead_id });
      const { error: updateErr } = await supabase
        .from("lead_conversation_state")
        .update({ last_inbound_at: now, ultimo_contato_em: now, updated_at: now })
        .eq("lead_id", lead.lead_id)
        .eq("empresa", lead.empresa);
      if (updateErr) {
        log.error("Fallback update last_inbound_at also failed", { error: updateErr.message });
      } else {
        log.info("last_inbound_at updated via fallback", { leadId: lead.lead_id });
      }
    } else {
      log.info("last_inbound_at updated", { leadId: lead.lead_id });
    }
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
        whatsapp_message_id: wamid,
        preview: mediaInfo.conteudo.substring(0, 100),
        tipo_midia: mediaInfo.tipo_midia,
        source: "meta-webhook",
      },
    });
  }

  // Trigger SDR-IA interpret (fire-and-forget, only for text messages)
  if (lead && mediaInfo.tipo_midia === "text") {
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

      // Extract phone_number_id for empresa resolution
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = metadata?.phone_number_id as string | null;

      // Resolve empresa from phone_number_id
      const resolvedEmpresa = await resolveEmpresa(supabase, phoneNumberId);

      // Extract profile name from contacts
      const contacts = (value.contacts as Array<Record<string, unknown>>) || [];
      const profileName = contacts.length > 0
        ? ((contacts[0].profile as Record<string, unknown>)?.name as string) || null
        : null;

      // Process messages
      const messages = (value.messages as Array<Record<string, unknown>>) || [];
      for (const msg of messages) {
        log.info("Processing inbound message", {
          from: msg.from,
          wamid: msg.id,
          type: msg.type,
          empresa: resolvedEmpresa,
        });
        const res = await handleMessage(supabase, msg, resolvedEmpresa, profileName);
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
