// api-keys-meta — Retorna pipelines e stages da empresa vinculada ao API key
// Usado pelo LP com IA para popular selects dinâmicos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { validateApiKey } from "../_shared/api-key-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = getWebhookCorsHeaders("x-api-key");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleWebhookCorsOptions("x-api-key");

  try {
    const apiKeyRecord = await validateApiKey(req, "meta:read");
    if (!apiKeyRecord) {
      return new Response(JSON.stringify({ error: "API key inválida ou sem permissão" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const empresa = apiKeyRecord.empresa;

    // Fetch pipelines for this empresa
    const { data: pipelines, error: pipErr } = await supabase
      .from("pipelines")
      .select("id, nome, empresa")
      .eq("empresa", empresa)
      .order("nome");

    if (pipErr) throw pipErr;

    // Fetch stages for these pipelines
    const pipelineIds = pipelines?.map((p: { id: string }) => p.id) || [];
    let stages: unknown[] = [];

    if (pipelineIds.length > 0) {
      const { data: stagesData, error: stgErr } = await supabase
        .from("pipeline_stages")
        .select("id, nome, pipeline_id, posicao, is_won, is_lost")
        .in("pipeline_id", pipelineIds)
        .order("posicao");

      if (stgErr) throw stgErr;
      stages = stagesData || [];
    }

    return new Response(JSON.stringify({
      empresa,
      pipelines: pipelines || [],
      stages,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
