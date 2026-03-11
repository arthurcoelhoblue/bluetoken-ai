// ========================================
// lp-lead-ingest — Ingestão de leads do LP com IA
// Endpoint permanente para webhook + importação em lote
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { normalizePhoneE164 } from "../_shared/phone-utils.ts";
import { validateApiKey } from "../_shared/api-key-utils.ts";

const corsHeaders = getWebhookCorsHeaders("x-api-key");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// IDs fixos (fallback quando não vem via body)
const DEFAULT_PIPELINE_ID = "5bbac98b-5ae9-4b31-9b7f-896d7b732a2c"; // Ofertas Públicas
const DEFAULT_STAGE_ID = "da80e912-b462-401d-b367-1b6a9b2ec4da"; // Lead

// Emails de teste a filtrar
// Partner tags extracted from utm_campaign
const PARTNER_TAGS: Record<string, string> = {
  'MPUPPE': 'MPUPPE',
  'AXIA': 'AXIA',
};

const TEST_EMAILS: string[] = [];

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

    const results: Array<{ email: string; status: string; contact_id?: string; deal_id?: string; reason?: string }> = [];

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

        // Dedup: check if contact exists by email
        const { data: existingContactByEmail } = await supabase
          .from("contacts")
          .select("id")
          .eq("empresa", empresa)
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        // Dedup by phone if email not found
        const phoneNorm = normalizePhoneE164(lead.telefone || null);
        let existingContact = existingContactByEmail;
        if (!existingContact && phoneNorm?.e164) {
          const { data: existingContactByPhone } = await supabase
            .from("contacts")
            .select("id")
            .eq("empresa", empresa)
            .eq("telefone_e164", phoneNorm.e164)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          existingContact = existingContactByPhone;
        }

        let contactId: string;

        if (existingContact) {
          contactId = existingContact.id;

          // Check if already has open deal in this pipeline
          const { data: existingDeal } = await supabase
            .from("deals")
            .select("id")
            .eq("contact_id", contactId)
            .eq("pipeline_id", pipelineId)
            .eq("status", "ABERTO")
            .limit(1)
            .maybeSingle();

        if (existingDeal) {
          // 1. Registrar atividade de re-conversão
          const reconversaoMeta: Record<string, unknown> = {
            reconversao_em: new Date().toISOString(),
            canal_origem: lead.canal_origem || "LP_COM_IA",
          };
          if (lead.utm_source) reconversaoMeta.utm_source = lead.utm_source;
          if (lead.utm_medium) reconversaoMeta.utm_medium = lead.utm_medium;
          if (lead.utm_campaign) reconversaoMeta.utm_campaign = lead.utm_campaign;
          if (lead.utm_content) reconversaoMeta.utm_content = lead.utm_content;
          if (lead.utm_term) reconversaoMeta.utm_term = lead.utm_term;

          await supabase.from("deal_activities").insert({
            deal_id: existingDeal.id,
            tipo: "NOTA",
            descricao: `🔄 Lead reconverteu via ${lead.canal_origem || "LP_COM_IA"}`,
            metadata: reconversaoMeta,
          });

          // 2. Atualizar tags do deal (merge partner tags)
          const newPartnerTags: string[] = [];
          const campaignUpperReconv = (lead.utm_campaign || "").toUpperCase();
          for (const [key, tag] of Object.entries(PARTNER_TAGS)) {
            if (campaignUpperReconv.includes(key)) {
              newPartnerTags.push(tag);
            }
          }
          if (newPartnerTags.length > 0) {
            const { data: dealData } = await supabase
              .from("deals")
              .select("tags, owner_id, titulo")
              .eq("id", existingDeal.id)
              .single();
            const currentTags: string[] = dealData?.tags || [];
            const mergedTags = [...new Set([...currentTags, ...newPartnerTags])];
            if (mergedTags.length > currentTags.length) {
              await supabase
                .from("deals")
                .update({ tags: mergedTags })
                .eq("id", existingDeal.id);
            }
          }

          // 3. Notificar owner do deal
          const { data: dealInfo } = await supabase
            .from("deals")
            .select("owner_id, titulo, pipeline_id")
            .eq("id", existingDeal.id)
            .single();

          if (dealInfo?.owner_id) {
            const { data: pipelineInfo } = await supabase
              .from("pipelines")
              .select("empresa")
              .eq("id", dealInfo.pipeline_id)
              .single();

            await supabase.from("notifications").insert({
              user_id: dealInfo.owner_id,
              empresa: pipelineInfo?.empresa || empresa,
              titulo: `🔄 Lead reconverteu: ${lead.nome || email}`,
              mensagem: `O lead "${lead.nome || email}" converteu novamente via ${lead.canal_origem || "LP_COM_IA"}. Deal: ${dealInfo.titulo}`,
              tipo: "INFO",
              referencia_tipo: "DEAL",
              referencia_id: existingDeal.id,
              link: "/pipeline",
            });
          }

          // 4. Retornar status reconverted
          results.push({ email, status: "reconverted", deal_id: existingDeal.id, contact_id: contactId });
          continue;
        }
        } else {
          // Create contact (phoneNorm already computed above)

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
          contactId = newContact.id;
        }

        // Build deal title: prioridade canal_origem > utm_campaign > sem tag
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

        results.push({ email, status: "created", contact_id: contactId, deal_id: newDeal.id });
      } catch (err) {
        results.push({ email: lead.email || "", status: "error", reason: String(err) });
      }
    }

    const summary = {
      total: leadsInput.length,
      created: results.filter((r) => r.status === "created").length,
      reconverted: results.filter((r) => r.status === "reconverted").length,
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
