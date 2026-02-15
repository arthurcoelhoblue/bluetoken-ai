import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const submitPayload = z.object({
  slug: z.string().trim().min(1, "slug is required").max(200),
  answers: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional().default({}),
});

import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parsed = submitPayload.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0]?.message || "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { slug, answers, metadata } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch form
    const { data: form, error: formError } = await supabase
      .from("capture_forms")
      .select("*")
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .single();

    if (formError || !form) {
      return new Response(JSON.stringify({ error: "Form not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = (form.fields || []) as Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
    }>;

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = answers[field.id];
        if (val === undefined || val === null || val === "") {
          return new Response(
            JSON.stringify({ error: `Campo obrigatório: ${field.label}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Extract contact info from answers
    let contactName = "Lead Captura";
    let contactEmail: string | null = null;
    let contactPhone: string | null = null;

    for (const field of fields) {
      const val = answers[field.id];
      if (!val) continue;
      if (field.type === "email") contactEmail = String(val);
      if (field.type === "phone") contactPhone = String(val);
      if (field.type === "short_text" && !contactEmail && !contactPhone) {
        contactName = String(val);
      }
    }

    // Create or find contact
    let contactId: string | null = null;
    if (contactEmail) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("empresa", form.empresa)
        .eq("email", contactEmail)
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      }
    }

    if (!contactId) {
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          empresa: form.empresa,
          nome: contactName,
          email: contactEmail,
          telefone: contactPhone,
          canal_origem: "FORM_CAPTURA",
        })
        .select("id")
        .single();

      if (contactErr) {
        console.error("Contact creation error:", contactErr);
        return new Response(JSON.stringify({ error: "Failed to create contact" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contactId = newContact.id;
    }

    // ── Routing logic based on metadata ──
    const temperatura = (metadata.temperatura as string) || null;
    const comando = (metadata.comando as string) || null;
    const isAtacar = comando === "atacar_agora";

    // Determine target stage
    let targetStageId = form.stage_id;

    if (isAtacar && form.pipeline_id) {
      // Find priority stage in this pipeline
      const { data: priorityStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", form.pipeline_id)
        .eq("is_priority", true)
        .limit(1)
        .maybeSingle();

      if (priorityStage) {
        targetStageId = priorityStage.id;
      }
    }

    // Build UTM data for deal metadata
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
    const utmData: Record<string, string> = {};
    for (const key of utmKeys) {
      if (metadata[key]) utmData[key] = String(metadata[key]);
    }

    // Create deal if pipeline configured
    let dealId: string | null = null;
    if (form.pipeline_id && targetStageId && contactId) {
      // Duplicate prevention: check for existing open deal in same pipeline
      const { data: existingDeal } = await supabase
        .from("deals")
        .select("id")
        .eq("contact_id", contactId)
        .eq("pipeline_id", form.pipeline_id)
        .eq("status", "ABERTO")
        .maybeSingle();

      if (existingDeal) {
        dealId = existingDeal.id;
        console.log("Existing open deal found, skipping creation:", dealId);
      } else {
        const dealInsert: Record<string, unknown> = {
          contact_id: contactId,
          pipeline_id: form.pipeline_id,
          stage_id: targetStageId,
          titulo: `${contactName} — ${form.nome}`,
          canal_origem: "FORM_CAPTURA",
          status: "ABERTO",
        };

        if (temperatura && ["FRIO", "MORNO", "QUENTE"].includes(temperatura)) {
          dealInsert.temperatura = temperatura;
        }

        if (Object.keys(utmData).length > 0 || metadata.valor_investido || metadata.contexto) {
          dealInsert.metadata_extra = {
            ...utmData,
            ...(metadata.valor_investido ? { valor_investido: metadata.valor_investido } : {}),
            ...(metadata.contexto && typeof metadata.contexto === "object" ? { contexto: metadata.contexto } : {}),
          };
        }

        const { data: deal, error: dealErr } = await supabase
          .from("deals")
          .insert(dealInsert)
          .select("id")
          .single();

        if (dealErr) {
          console.error("Deal creation error:", dealErr);
        } else {
          dealId = deal.id;
        }
      }

      // ── Post-creation actions ──
      if (dealId) {
        // HOT or atacar_agora → notify pipeline owner
        if (isAtacar || temperatura === "QUENTE") {
          try {
            await supabase.from("closer_notifications").insert({
              lead_id: contactId,
              empresa: form.empresa,
              motivo: isAtacar
                ? "FORM_CAPTURA: Comando atacar_agora recebido"
                : "FORM_CAPTURA: Lead QUENTE capturado",
              contexto: {
                deal_id: dealId,
                form_slug: slug,
                temperatura: temperatura || "QUENTE",
                ...utmData,
              },
            });
          } catch (e) {
            console.error("Notification error:", e);
          }
        }

        // COLD → start warming cadence
        if (temperatura === "FRIO") {
          try {
            const cadenceCodigo = `WARMING_INBOUND_FRIO_${form.empresa}`;
            const { data: cadence } = await supabase
              .from("cadences")
              .select("id")
              .eq("codigo", cadenceCodigo)
              .eq("ativo", true)
              .maybeSingle();

            if (cadence) {
              // Find legacy_lead_id from contact
              const { data: contact } = await supabase
                .from("contacts")
                .select("legacy_lead_id")
                .eq("id", contactId)
                .single();

              const leadId = contact?.legacy_lead_id;
              if (leadId) {
                const { data: run } = await supabase
                  .from("lead_cadence_runs")
                  .insert({
                    cadence_id: cadence.id,
                    lead_id: leadId,
                    empresa: form.empresa,
                    status: "ATIVA",
                    last_step_ordem: 0,
                    next_step_ordem: 1,
                    next_run_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (run) {
                  await supabase.from("deal_cadence_runs").insert({
                    deal_id: dealId,
                    cadence_run_id: run.id,
                    trigger_stage_id: targetStageId,
                    trigger_type: "FORM_CAPTURA",
                    status: "ACTIVE",
                  });
                }
              }
            }
          } catch (e) {
            console.error("Cadence start error:", e);
          }
        }
      }
    }

    // Insert submission
    const { error: subErr } = await supabase
      .from("capture_form_submissions")
      .insert({
        form_id: form.id,
        empresa: form.empresa,
        answers,
        metadata: metadata || {},
        contact_id: contactId,
        deal_id: dealId,
      });

    if (subErr) {
      console.error("Submission error:", subErr);
      return new Response(JSON.stringify({ error: "Failed to save submission" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, contact_id: contactId, deal_id: dealId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
