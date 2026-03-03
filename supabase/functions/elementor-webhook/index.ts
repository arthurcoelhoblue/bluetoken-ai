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
    const leadPayload: Record<string, string> = {};

    // Elementor native: { "fields": { "field_abc": { "value": "..." } } }
    const elementorFields = body.fields as ElementorFields | undefined;

    for (const [ameliaField, elementorFieldId] of Object.entries(fieldMap)) {
      if (!elementorFieldId) continue;

      let value: string | undefined;

      if (elementorFields && elementorFields[elementorFieldId]) {
        // Elementor native format
        value = elementorFields[elementorFieldId].value;
      } else if (body[elementorFieldId] !== undefined) {
        // Flat format: { "field_abc": "value" }
        value = String(body[elementorFieldId]);
      } else if (body[ameliaField] !== undefined) {
        // Direct format: { "nome": "value", "email": "value" }
        value = String(body[ameliaField]);
      }

      if (value) {
        leadPayload[ameliaField] = value;
      }
    }

    if (!leadPayload.email && !leadPayload.nome) {
      return new Response(JSON.stringify({
        error: "Could not extract lead data. Check field_map configuration.",
        received_keys: Object.keys(body),
        configured_map: fieldMap,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build UTM data from body or query params
    const utmFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const utmData: Record<string, string> = {};
    for (const utm of utmFields) {
      const val = body[utm] || url.searchParams.get(utm);
      if (val) utmData[utm] = val;
    }

    // Call lp-lead-ingest internally
    const ingestPayload = {
      empresa: mapping.empresa || "TOKENIZA",
      pipeline_id: mapping.pipeline_id,
      stage_id: mapping.stage_id,
      lead: {
        nome: leadPayload.nome || "",
        email: leadPayload.email || "",
        telefone: leadPayload.telefone || undefined,
        tags: mapping.tags_auto || [],
        ...utmData,
        campos_extras: {
          source: "elementor",
          form_id: formId,
          ...leadPayload,
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
