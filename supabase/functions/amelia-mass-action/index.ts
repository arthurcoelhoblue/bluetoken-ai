import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { jobId, action } = body;
    if (!jobId) throw new Error("jobId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, serviceKey);

    // ========== EXECUTE BRANCH ==========
    if (action === "execute") {
      const { data: job, error: jobErr } = await sb
        .from("mass_action_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (jobErr || !job) throw new Error("Job not found: " + jobErr?.message);
      if (job.status !== "PREVIEW") throw new Error("Job must be in PREVIEW status to execute");

      await sb.from("mass_action_jobs").update({ status: "SENDING" }).eq("id", jobId);

      const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean }> =
        job.messages_preview || [];
      const approved = messagesPreview.filter((m) => m.approved);

      if (approved.length === 0) {
        await sb.from("mass_action_jobs").update({ status: "DONE", processed: 0 }).eq("id", jobId);
        return new Response(JSON.stringify({ ok: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const canal = job.canal || "WHATSAPP";
      let sent = 0;
      let errors = 0;

      for (const msg of approved) {
        try {
          // Get deal + contact info
          const { data: deal } = await sb
            .from("deals")
            .select("id, titulo, contacts(id, nome, telefone, email)")
            .eq("id", msg.deal_id)
            .single();

          if (!deal) {
            errors++;
            continue;
          }

          const contact = deal.contacts as any;

          if (canal === "WHATSAPP") {
            const telefone = contact?.telefone;
            if (!telefone) { errors++; continue; }

            const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: telefone,
                message: msg.message,
                deal_id: msg.deal_id,
                contact_id: contact?.id,
              }),
            });

            if (resp.ok) { sent++; } else {
              console.error("whatsapp-send error:", await resp.text());
              errors++;
            }
          } else if (canal === "EMAIL") {
            const email = contact?.email;
            if (!email) { errors++; continue; }

            const resp = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: email,
                subject: job.instrucao ? `Re: ${job.instrucao.substring(0, 50)}` : "Mensagem importante",
                body: msg.message,
                deal_id: msg.deal_id,
                contact_id: contact?.id,
              }),
            });

            if (resp.ok) { sent++; } else {
              console.error("email-send error:", await resp.text());
              errors++;
            }
          }
        } catch (e) {
          console.error("Send error for deal:", msg.deal_id, e);
          errors++;
        }
      }

      const finalStatus = errors === approved.length ? "FAILED" : "DONE";
      await sb.from("mass_action_jobs").update({
        status: finalStatus,
        processed: sent,
      }).eq("id", jobId);

      return new Response(JSON.stringify({ ok: true, sent, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GENERATE BRANCH (existing) ==========
    const { data: job, error: jobErr } = await sb
      .from("mass_action_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobErr || !job) throw new Error("Job not found: " + jobErr?.message);

    await sb.from("mass_action_jobs").update({ status: "GENERATING" }).eq("id", jobId);

    const dealIds: string[] = job.deal_ids || [];

    const { data: deals } = await sb
      .from("deals")
      .select("id, titulo, valor, temperatura, status, contacts(id, nome, telefone, email)")
      .in("id", dealIds);

    if (!deals || deals.length === 0) {
      await sb.from("mass_action_jobs").update({ status: "FAILED" }).eq("id", jobId);
      return new Response(JSON.stringify({ error: "No deals found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean }> = [];

    for (const deal of deals) {
      const contact = deal.contacts as any;
      const contactName = contact?.nome || "Cliente";
      const canal = job.canal || "WHATSAPP";

      const systemPrompt = `Você é Amélia, uma SDR virtual profissional e empática. Gere UMA mensagem personalizada de ${canal === 'WHATSAPP' ? 'WhatsApp' : 'e-mail'} para o contato.
Regras:
- Português brasileiro informal mas profissional
- Mensagem curta (máximo 3 parágrafos para WhatsApp, 5 para email)
- Use o nome do contato
- Seja direta e persuasiva
- NÃO use markdown, apenas texto puro
- Para WhatsApp: máximo 2 emojis`;

      let userPrompt = `Contato: ${contactName}
Deal: ${deal.titulo || "Negociação"}
Valor: R$ ${deal.valor || 0}
Temperatura: ${deal.temperatura || "não definida"}`;

      if (job.tipo === "CAMPANHA_ADHOC" && job.instrucao) {
        userPrompt += `\n\nInstrução especial: ${job.instrucao}`;
      }

      try {
        if (lovableApiKey) {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const message = aiData.choices?.[0]?.message?.content || "";
            messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message, approved: true });
          } else {
            const errText = await aiResp.text();
            console.error("AI error:", aiResp.status, errText);
            messagesPreview.push({
              deal_id: deal.id, contact_name: contactName,
              message: `[Erro na geração - status ${aiResp.status}]`, approved: false,
            });
          }
        } else {
          messagesPreview.push({
            deal_id: deal.id, contact_name: contactName,
            message: "[LOVABLE_API_KEY não configurada]", approved: false,
          });
        }
      } catch (e) {
        console.error("Error generating for deal:", deal.id, e);
        messagesPreview.push({
          deal_id: deal.id, contact_name: contactName,
          message: `[Erro: ${e instanceof Error ? e.message : "unknown"}]`, approved: false,
        });
      }
    }

    await sb.from("mass_action_jobs").update({
      status: "PREVIEW",
      messages_preview: messagesPreview,
      processed: messagesPreview.length,
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, count: messagesPreview.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("amelia-mass-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
