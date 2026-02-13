import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { slug, answers, metadata } = await req.json();
    if (!slug || !answers) {
      return new Response(JSON.stringify({ error: "slug and answers required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Create deal if pipeline configured
    let dealId: string | null = null;
    if (form.pipeline_id && form.stage_id && contactId) {
      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          contact_id: contactId,
          pipeline_id: form.pipeline_id,
          stage_id: form.stage_id,
          titulo: `${contactName} — ${form.nome}`,
          canal_origem: "FORM_CAPTURA",
          status: "ABERTO",
        })
        .select("id")
        .single();

      if (dealErr) {
        console.error("Deal creation error:", dealErr);
      } else {
        dealId = deal.id;
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
