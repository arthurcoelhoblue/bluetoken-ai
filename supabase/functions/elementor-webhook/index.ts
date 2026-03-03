// ========================================
// elementor-webhook — Recebe webhooks do Elementor Pro
// Converte formato Elementor → LeadPayload → lp-lead-ingest
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { checkWebhookRateLimit, rateLimitResponse, simpleHash } from "../_shared/webhook-rate-limit.ts";

const corsHeaders = getWebhookCorsHeaders("x-webhook-token");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAIN_FIELDS = ["nome", "email", "telefone"];
const TRACKING_FIELDS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "page_url", "referrer", "gclid", "fbclid",
];

interface ElementorFields {
  [fieldId: string]: { id?: string; value: string; type?: string; raw_value?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleWebhookCorsOptions("x-webhook-token");
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const formId = url.searchParams.get("form_id");

    if (!formId) {
      return new Response(JSON.stringify({ error: "Missing form_id query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limiting
    const tokenHeader = req.headers.get("x-webhook-token") || "anonymous";
    const rateCheck = await checkWebhookRateLimit(supabase, "elementor-webhook", simpleHash(tokenHeader), 60);
    if (!rateCheck.allowed) return rateLimitResponse(corsHeaders);

    // Fetch mapping from DB
    const { data: mapping, error: mapErr } = await supabase
      .from("elementor_form_mappings")
      .select("*")
      .eq("form_id", formId)
      .eq("is_active", true)
      .maybeSingle();

    if (mapErr || !mapping) {
      return new Response(JSON.stringify({ error: "Form mapping not found or inactive", form_id: formId }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate via X-Webhook-Token
    if (tokenHeader !== mapping.token) {
      return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse incoming body
    const body = await req.json();

    // Extract field values — support both Elementor native format and flat format
    const fieldMap = mapping.field_map as Record<string, string>;
    const mainPayload: Record<string, string> = {};
    const camposExtras: Record<string, string> = {};

    const elementorFields = body.fields as ElementorFields | undefined;

    for (const [ameliaField, elementorFieldId] of Object.entries(fieldMap)) {
      if (!elementorFieldId) continue;

      let value: string | undefined;

      if (elementorFields && elementorFields[elementorFieldId]) {
        value = elementorFields[elementorFieldId].value;
      } else if (body[elementorFieldId] !== undefined) {
        value = String(body[elementorFieldId]);
      } else if (body[ameliaField] !== undefined) {
        value = String(body[ameliaField]);
      }

      if (value) {
        if (MAIN_FIELDS.includes(ameliaField)) {
          mainPayload[ameliaField] = value;
        } else {
          camposExtras[ameliaField] = value;
        }
      }
    }

    // Auto-capture tracking fields from body or query params (even if not in field_map)
    for (const tf of TRACKING_FIELDS) {
      if (!camposExtras[tf]) {
        const val = body[tf] || url.searchParams.get(tf);
        if (val) camposExtras[tf] = val;
      }
    }

    if (!mainPayload.email && !mainPayload.nome) {
      return new Response(JSON.stringify({
        error: "Could not extract lead data. Check field_map configuration.",
        received_keys: Object.keys(body),
        configured_map: fieldMap,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call lp-lead-ingest internally
    const ingestPayload = {
      empresa: mapping.empresa || "TOKENIZA",
      pipeline_id: mapping.pipeline_id,
      stage_id: mapping.stage_id,
      lead: {
        nome: mainPayload.nome || "",
        email: mainPayload.email || "",
        telefone: mainPayload.telefone || undefined,
        tags: mapping.tags_auto || [],
        ...(camposExtras.utm_source && { utm_source: camposExtras.utm_source }),
        ...(camposExtras.utm_medium && { utm_medium: camposExtras.utm_medium }),
        ...(camposExtras.utm_campaign && { utm_campaign: camposExtras.utm_campaign }),
        ...(camposExtras.utm_content && { utm_content: camposExtras.utm_content }),
        ...(camposExtras.utm_term && { utm_term: camposExtras.utm_term }),
        campos_extras: {
          source: "elementor",
          form_id: formId,
          ...camposExtras,
        },
      },
    };

    const ingestResponse = await fetch(`${SUPABASE_URL}/functions/v1/lp-lead-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(ingestPayload),
    });

    const ingestResult = await ingestResponse.json();

    return new Response(JSON.stringify({
      success: true,
      form_id: formId,
      ...ingestResult,
    }), {
      status: ingestResponse.ok ? 200 : ingestResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[elementor-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
