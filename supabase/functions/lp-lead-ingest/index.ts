// ========================================
// lp-lead-ingest — Ingestão de leads do LP com IA
// Endpoint permanente para webhook + importação em lote
// SEMPRE cria novo contato + deal. Se detectar duplicata, registra pendência.
// Push fire-and-forget para Mautic e SGT após criação.
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { normalizePhoneE164 } from "../_shared/phone-utils.ts";
import { validateApiKey } from "../_shared/api-key-utils.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("lp-lead-ingest");
const corsHeaders = getWebhookCorsHeaders("x-api-key");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// IDs fixos (fallback quando não vem via body)
const DEFAULT_PIPELINE_ID = "5bbac98b-5ae9-4b31-9b7f-896d7b732a2c"; // Ofertas Públicas
const DEFAULT_STAGE_ID = "da80e912-b462-401d-b367-1b6a9b2ec4da"; // Lead

// Partner tags extracted from utm_campaign
const PARTNER_TAGS: Record<string, string> = {
  'MPUPPE': 'MPUPPE',
  'AXIA': 'AXIA',
};

const TEST_EMAILS: string[] = [];

// SGT endpoint
const SGT_API_URL = "https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/criar-lead-api";

interface LeadPayload {
  nome: string;
  email: string;
  telefone?: string;
  canal_origem?: string;
  tags?: string[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campos_extras?: Record<string, unknown>;
}

interface IngestRequest {
  empresa?: string;
  pipeline_id?: string;
  stage_id?: string;
  lead?: LeadPayload;
  leads?: LeadPayload[];
}

// ========================================
// Push helpers (fire-and-forget)
// ========================================

async function getMauticConfig(
  supabase: ReturnType<typeof createClient>,
  empresa: string
): Promise<{ url: string; user: string; pass: string; segmentIds?: Record<string, string>; customFields?: Record<string, string> } | null> {
  // Try per-company config from DB first
  const { data } = await supabase
    .from("mautic_company_config")
    .select("*")
    .eq("empresa", empresa)
    .eq("enabled", true)
    .maybeSingle();

  if (data?.mautic_url && data?.mautic_username && data?.mautic_password) {
    return {
      url: data.mautic_url,
      user: data.mautic_username,
      pass: data.mautic_password,
      segmentIds: (data.segment_ids as Record<string, string>) || undefined,
      customFields: (data.custom_fields as Record<string, string>) || undefined,
    };
  }

  // Fallback to env vars
  const mauticUrl = Deno.env.get("MAUTIC_URL");
  const mauticUser = Deno.env.get("MAUTIC_USERNAME");
  const mauticPass = Deno.env.get("MAUTIC_PASSWORD");

  if (mauticUrl && mauticUser && mauticPass) {
    return { url: mauticUrl, user: mauticUser, pass: mauticPass };
  }

  return null;
}

async function pushToMautic(
  lead: LeadPayload,
  mauticCfg: { url: string; user: string; pass: string; segmentId?: string; customFields?: Record<string, string> }
): Promise<{ status: string; mautic_contact_id?: number }> {
  try {
    const nameParts = (lead.nome || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const body: Record<string, unknown> = {
      firstname: firstName,
      lastname: lastName,
      email: lead.email,
      phone: lead.telefone || undefined,
      tags: lead.tags || [],
    };

    // UTMs as custom fields
    if (lead.utm_source) body.utm_source = lead.utm_source;
    if (lead.utm_medium) body.utm_medium = lead.utm_medium;
    if (lead.utm_campaign) body.utm_campaign = lead.utm_campaign;
    if (lead.utm_content) body.utm_content = lead.utm_content;
    if (lead.utm_term) body.utm_term = lead.utm_term;

    // Custom fields mapping from DB config
    if (mauticCfg.customFields && lead.campos_extras) {
      for (const [localField, mauticField] of Object.entries(mauticCfg.customFields)) {
        const value = lead.campos_extras[localField];
        if (value !== undefined && value !== null) {
          body[mauticField] = value;
        }
      }
    }

    const basicAuth = btoa(`${mauticCfg.user}:${mauticCfg.pass}`);
    const endpoint = `${mauticCfg.url.replace(/\/$/, "")}/api/contacts/new`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();

    if (!resp.ok) {
      log.error("Mautic push failed", { status: resp.status, response: text.substring(0, 500), email: lead.email });
      return { status: "error" };
    }

    let contactId: number | undefined;
    try {
      const data = JSON.parse(text);
      contactId = data?.contact?.id;
    } catch { /* ignore */ }

    // Add to segment if configured
    if (contactId && mauticCfg.segmentId) {
      try {
        await fetch(
          `${mauticCfg.url.replace(/\/$/, "")}/api/segments/${mauticCfg.segmentId}/contact/${contactId}/add`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${basicAuth}` },
          }
        );
        log.info("Mautic segment add ok", { contactId, segmentId: mauticCfg.segmentId });
      } catch (segErr) {
        log.warn("Mautic segment add failed", { error: String(segErr) });
      }
    }

    log.info("Mautic push ok", { email: lead.email, mautic_contact_id: contactId });
    return { status: "ok", mautic_contact_id: contactId };
  } catch (err) {
    log.error("Mautic push exception", { error: String(err), email: lead.email });
    return { status: "error" };
  }
}

async function pushToSGT(lead: LeadPayload, empresa: string): Promise<{ status: string }> {
  const sgtSecret = Deno.env.get("SGT_WEBHOOK_SECRET");
  if (!sgtSecret) {
    log.warn("SGT_WEBHOOK_SECRET not configured, skipping push");
    return { status: "skipped" };
  }

  try {
    const body = {
      empresa,
      lead: {
        nome_lead: lead.nome || lead.email.split("@")[0],
        email: lead.email,
        telefone: lead.telefone || undefined,
        origem_canal: lead.canal_origem || "AMELIA_CRM",
        utm_source: lead.utm_source || undefined,
        utm_medium: lead.utm_medium || undefined,
        utm_campaign: lead.utm_campaign || undefined,
        utm_content: lead.utm_content || undefined,
        utm_term: lead.utm_term || undefined,
      },
    };

    const resp = await fetch(SGT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": sgtSecret,
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();

    if (!resp.ok) {
      log.error("SGT push failed", { status: resp.status, response: text.substring(0, 500), email: lead.email });
      return { status: "error" };
    }

    log.info("SGT push ok", { email: lead.email });
    return { status: "ok" };
  } catch (err) {
    log.error("SGT push exception", { error: String(err), email: lead.email });
    return { status: "error" };
  }
}

// ========================================
// Main handler
// ========================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleWebhookCorsOptions("x-api-key");
  }

  try {
    // Authenticate via X-API-Key header (optional, falls back to body.empresa)
    const apiKeyRecord = await validateApiKey(req, "lead:write");

    const body: IngestRequest = await req.json();

    // API key scopes empresa; body.empresa is ignored when using API key
    const empresa = apiKeyRecord?.empresa || body.empresa || "TOKENIZA";
    const pipelineId = body.pipeline_id || DEFAULT_PIPELINE_ID;
    const stageId = body.stage_id || DEFAULT_STAGE_ID;

    // Accept single lead or array
    const leadsInput = body.leads || (body.lead ? [body.lead] : []);
    if (leadsInput.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum lead fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get round-robin owner: seller with fewest open deals in this pipeline
    const ownerId = await getRoundRobinOwner(supabase, empresa, pipelineId);

    const results: Array<{
      email: string;
      status: string;
      contact_id?: string;
      deal_id?: string;
      duplicate?: boolean;
      reason?: string;
      mautic_status?: string;
      sgt_status?: string;
    }> = [];

    for (const lead of leadsInput) {
      try {
        const email = lead.email?.trim().toLowerCase();
        if (!email) {
          results.push({ email: "", status: "skipped", reason: "email_vazio" });
          continue;
        }

        // Filter test emails
        if (TEST_EMAILS.includes(email)) {
          results.push({ email, status: "skipped", reason: "email_teste" });
          continue;
        }

        // --- Check for existing contacts (for pendency only, NOT to block creation) ---
        let matchType: string | null = null;
        let existingContactId: string | null = null;
        let existingDealId: string | null = null;
        const matchDetails: Record<string, unknown> = {};

        // Check by email
        const { data: existingByEmail } = await supabase
          .from("contacts")
          .select("id, nome, email, telefone")
          .eq("empresa", empresa)
          .eq("email", email)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        // Check by phone
        const phoneNorm = normalizePhoneE164(lead.telefone || null);
        let existingByPhone: typeof existingByEmail = null;
        if (phoneNorm?.e164) {
          const { data } = await supabase
            .from("contacts")
            .select("id, nome, email, telefone")
            .eq("empresa", empresa)
            .eq("telefone_e164", phoneNorm.e164)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          existingByPhone = data;
        }

        // Determine match type
        if (existingByEmail && existingByPhone && existingByEmail.id === existingByPhone.id) {
          matchType = "EMAIL_E_TELEFONE";
          existingContactId = existingByEmail.id;
          matchDetails.existing_email = existingByEmail.email;
          matchDetails.existing_telefone = existingByEmail.telefone;
        } else if (existingByEmail) {
          matchType = "EMAIL";
          existingContactId = existingByEmail.id;
          matchDetails.existing_email = existingByEmail.email;
          matchDetails.existing_nome = existingByEmail.nome;
        } else if (existingByPhone) {
          matchType = "TELEFONE";
          existingContactId = existingByPhone.id;
          matchDetails.existing_email = existingByPhone.email;
          matchDetails.existing_nome = existingByPhone.nome;
          matchDetails.existing_telefone = existingByPhone.telefone;
        }

        // If there's an existing contact, check for open deal
        if (existingContactId) {
          const { data: existingDeal } = await supabase
            .from("deals")
            .select("id")
            .eq("contact_id", existingContactId)
            .eq("pipeline_id", pipelineId)
            .eq("status", "ABERTO")
            .limit(1)
            .maybeSingle();
          if (existingDeal) {
            existingDealId = existingDeal.id;
          }
        }

        // --- ALWAYS create new contact ---
        const { data: newContact, error: contactErr } = await supabase
          .from("contacts")
          .insert({
            nome: lead.nome || email.split("@")[0],
            primeiro_nome: lead.nome?.split(" ")[0] || null,
            email,
            telefone: lead.telefone || null,
            telefone_e164: phoneNorm?.e164 || null,
            ddi: phoneNorm?.ddi || null,
            numero_nacional: phoneNorm?.nacional || null,
            telefone_valido: phoneNorm !== null,
            empresa,
            canal_origem: lead.canal_origem || "LP_COM_IA",
            tags: lead.tags || [],
          })
          .select("id")
          .single();

        if (contactErr || !newContact) {
          results.push({ email, status: "error", reason: contactErr?.message || "contact_insert_failed" });
          continue;
        }

        const contactId = newContact.id;

        // Build deal title
        const origemTag = lead.canal_origem && lead.canal_origem !== "LP_COM_IA"
          ? lead.canal_origem.substring(0, 60)
          : lead.utm_campaign
            ? lead.utm_campaign.replace(/[\[\]🟡🔴🟢]/g, "").trim().substring(0, 60)
            : null;
        const dealTitle = origemTag
          ? `${lead.nome || email.split("@")[0]} [${origemTag}]`
          : `${lead.nome || email.split("@")[0]}`;

        // Metadata extra
        const metadataExtra: Record<string, unknown> = {};
        if (lead.utm_source) metadataExtra.utm_source = lead.utm_source;
        if (lead.utm_medium) metadataExtra.utm_medium = lead.utm_medium;
        if (lead.utm_campaign) metadataExtra.utm_campaign = lead.utm_campaign;
        if (lead.utm_content) metadataExtra.utm_content = lead.utm_content;
        if (lead.utm_term) metadataExtra.utm_term = lead.utm_term;
        if (lead.campos_extras) metadataExtra.campos_extras = lead.campos_extras;

        // Extract partner tags from utm_campaign
        const dealTags: string[] = [...(lead.tags || [])];
        const campaignUpper = (lead.utm_campaign || "").toUpperCase();
        for (const [key, tag] of Object.entries(PARTNER_TAGS)) {
          if (campaignUpper.includes(key) && !dealTags.includes(tag)) {
            dealTags.push(tag);
          }
        }

        // --- ALWAYS create new deal ---
        const { data: newDeal, error: dealErr } = await supabase
          .from("deals")
          .insert({
            titulo: dealTitle,
            contact_id: contactId,
            pipeline_id: pipelineId,
            stage_id: stageId,
            status: "ABERTO",
            temperatura: "FRIO",
            owner_id: ownerId,
            canal_origem: lead.canal_origem || "LP_COM_IA",
            valor: 0,
            metadata: metadataExtra,
            tags: dealTags.length > 0 ? dealTags : null,
          })
          .select("id")
          .single();

        if (dealErr || !newDeal) {
          results.push({ email, status: "error", reason: dealErr?.message || "deal_insert_failed" });
          continue;
        }

        // --- Register CRIACAO activity with form data in timeline ---
        const camposPreenchidos: Record<string, unknown> = {
          nome: lead.nome,
          email,
          ...(lead.telefone ? { telefone: lead.telefone } : {}),
          ...(lead.campos_extras || {}),
        };
        const { error: activityErr } = await supabase.from("deal_activities").insert({
          deal_id: newDeal.id,
          tipo: "CRIACAO",
          descricao: `Lead via ${lead.canal_origem || "formulário"}`,
          metadata: {
            origem: "FORMULARIO",
            canal_origem: lead.canal_origem || null,
            form_id: lead.campos_extras?.form_id || null,
            campos_preenchidos: camposPreenchidos,
            utm_source: lead.utm_source || null,
            utm_medium: lead.utm_medium || null,
            utm_campaign: lead.utm_campaign || null,
          },
        });
        if (activityErr) {
          log.error(`Failed to create CRIACAO activity for deal ${newDeal.id}`, { error: activityErr.message });
        }

        // --- If duplicate detected, create pendency ---
        let isDuplicate = false;
        if (matchType && existingContactId) {
          isDuplicate = true;
          matchDetails.new_email = email;
          matchDetails.new_nome = lead.nome;
          matchDetails.new_telefone = lead.telefone;

          await supabase.from("duplicate_pendencies").insert({
            empresa,
            new_contact_id: contactId,
            new_deal_id: newDeal.id,
            existing_contact_id: existingContactId,
            existing_deal_id: existingDealId,
            match_type: matchType,
            match_details: matchDetails,
          });

          // Notify owner of existing deal (or round-robin owner)
          const notifyUserId = existingDealId
            ? (await supabase.from("deals").select("owner_id").eq("id", existingDealId).single()).data?.owner_id
            : ownerId;

          if (notifyUserId) {
            await supabase.from("notifications").insert({
              user_id: notifyUserId,
              empresa,
              titulo: `⚠️ Possível duplicação: ${lead.nome || email}`,
              mensagem: `Lead "${lead.nome || email}" pode ser duplicado (match por ${matchType.toLowerCase().replace(/_/g, ' ')}). Verifique em Pendências.`,
              tipo: "WARNING",
              referencia_tipo: "DEAL",
              referencia_id: newDeal.id,
              link: "/admin/pendencias",
            });
          }
        }

        // --- Fire-and-forget: push to Mautic + SGT in parallel ---
        const leadWithNormalizedEmail = { ...lead, email };
        const mauticCfg = await getMauticConfig(supabase, empresa);
        const [mauticResult, sgtResult] = await Promise.allSettled(
          mauticCfg
            ? [pushToMautic(leadWithNormalizedEmail, mauticCfg), pushToSGT(leadWithNormalizedEmail, empresa)]
            : [Promise.resolve({ status: "skipped" }), pushToSGT(leadWithNormalizedEmail, empresa)]
        );

        const mauticStatus = mauticResult.status === "fulfilled" ? mauticResult.value.status : "error";
        const sgtStatus = sgtResult.status === "fulfilled" ? sgtResult.value.status : "error";

        results.push({
          email,
          status: "created",
          contact_id: contactId,
          deal_id: newDeal.id,
          duplicate: isDuplicate,
          mautic_status: mauticStatus,
          sgt_status: sgtStatus,
        });
      } catch (err) {
        results.push({ email: lead.email || "", status: "error", reason: String(err) });
      }
    }

    const summary = {
      total: leadsInput.length,
      created: results.filter((r) => r.status === "created").length,
      duplicates: results.filter((r) => r.duplicate).length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Round-robin: seller with fewest open deals in this pipeline */
async function getRoundRobinOwner(
  supabase: ReturnType<typeof createClient>,
  empresa: string,
  pipelineId: string
): Promise<string> {
  // Get active sellers for this empresa
  const { data: sellers } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .in("id", (
      await supabase
        .from("user_access_assignments")
        .select("user_id")
        .eq("empresa", empresa)
    ).data?.map((r: { user_id: string }) => r.user_id) || []
    );

  if (!sellers || sellers.length === 0) {
    // Fallback: Renato Gallucci
    return "8dd53528-2eca-4978-bb31-2be291c83409";
  }

  // Count open deals per seller in this pipeline
  let minCount = Infinity;
  let minSellerId = sellers[0].id;

  for (const seller of sellers) {
    const { count } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipelineId)
      .eq("owner_id", seller.id)
      .eq("status", "ABERTO");

    const c = count || 0;
    if (c < minCount) {
      minCount = c;
      minSellerId = seller.id;
    }
  }

  return minSellerId;
}
