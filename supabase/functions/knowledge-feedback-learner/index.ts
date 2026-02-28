import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: Record<string, unknown> = {};

    // ============================================
    // 1. ANALYZE FEEDBACK — Last 7 days
    // ============================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: feedback } = await supabase
      .from("knowledge_search_feedback")
      .select("query, chunks_returned, search_method, empresa, outcome")
      .gte("created_at", sevenDaysAgo);

    const totalFeedback = (feedback || []).length;
    const utilCount = (feedback || []).filter((f: any) => f.outcome === "UTIL").length;
    const naoUtilCount = (feedback || []).filter((f: any) => f.outcome === "NAO_UTIL").length;
    const efficacyRate = totalFeedback > 0 ? Math.round((utilCount / totalFeedback) * 100) : 0;

    results.feedback_analysis = {
      total: totalFeedback,
      util: utilCount,
      nao_util: naoUtilCount,
      pendente: totalFeedback - utilCount - naoUtilCount,
      efficacy_rate: efficacyRate,
    };

    // ============================================
    // 2. IDENTIFY LOW-EFFICACY PATTERNS
    // ============================================
    // Group by empresa and find queries that consistently fail
    const empresaStats: Record<string, { total: number; nao_util: number; queries: string[] }> = {};
    for (const f of (feedback || [])) {
      const fb = f as any;
      if (!empresaStats[fb.empresa]) empresaStats[fb.empresa] = { total: 0, nao_util: 0, queries: [] };
      empresaStats[fb.empresa].total++;
      if (fb.outcome === "NAO_UTIL") {
        empresaStats[fb.empresa].nao_util++;
        empresaStats[fb.empresa].queries.push(fb.query);
      }
    }

    const lowEfficacyEmpresas: string[] = [];
    for (const [emp, stats] of Object.entries(empresaStats)) {
      if (stats.total >= 5 && (stats.nao_util / stats.total) >= 0.6) {
        lowEfficacyEmpresas.push(emp);
      }
    }
    results.low_efficacy_empresas = lowEfficacyEmpresas;

    // ============================================
    // 3. BOOST CONSISTENTLY USEFUL CHUNKS
    // ============================================
    // Find chunks that appear in UTIL feedback and boost their metadata
    let boostedCount = 0;
    const utilFeedback = (feedback || []).filter((f: any) => f.outcome === "UTIL" && f.chunks_returned);
    const chunkIdCounts: Record<string, number> = {};

    for (const fb of utilFeedback) {
      const chunks = (fb as any).chunks_returned;
      if (Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.source_id) {
            chunkIdCounts[chunk.source_id] = (chunkIdCounts[chunk.source_id] || 0) + 1;
          }
        }
      }
    }

    // Boost chunks that were useful >= 3 times
    for (const [sourceId, count] of Object.entries(chunkIdCounts)) {
      if (count >= 3) {
        const { data: existing } = await supabase
          .from("knowledge_embeddings")
          .select("id, metadata")
          .eq("source_id", sourceId)
          .limit(5);

        for (const emb of (existing || [])) {
          const meta = (emb as any).metadata || {};
          meta.boost = Math.min((meta.boost || 1) + 0.1, 2.0);
          meta.util_count = count;
          await supabase.from("knowledge_embeddings").update({ metadata: meta }).eq("id", (emb as any).id);
          boostedCount++;
        }
      }
    }
    results.boosted_chunks = boostedCount;

    // ============================================
    // 4. AUTO-RESOLVE KNOWLEDGE GAPS
    // ============================================
    let suggestedFaqs = 0;

    if (LOVABLE_API_KEY) {
      const { data: gaps } = await supabase
        .from("knowledge_gaps")
        .select("id, empresa, topic, description, frequency, sample_queries")
        .eq("status", "ABERTO")
        .gte("frequency", 5)
        .is("suggested_faq_id", null)
        .limit(10);

      for (const gap of (gaps || [])) {
        const g = gap as any;
        try {
          // Get existing knowledge context for this empresa
          const { data: sections } = await supabase
            .from("knowledge_sections")
            .select("titulo, conteudo")
            .limit(5);

          const contextText = (sections || []).map((s: any) => `${s.titulo}: ${s.conteudo?.slice(0, 200)}`).join("\n");

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              tools: [{
                type: "function",
                function: {
                  name: "generate_faq",
                  description: "Generate a FAQ entry based on a knowledge gap",
                  parameters: {
                    type: "object",
                    properties: {
                      pergunta: { type: "string", description: "Clear question in Portuguese" },
                      resposta: { type: "string", description: "Comprehensive answer in Portuguese (100-300 words)" },
                      categoria: { type: "string", description: "FAQ category" },
                    },
                    required: ["pergunta", "resposta", "categoria"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "generate_faq" } },
              messages: [
                {
                  role: "system",
                  content: `Você gera FAQs para uma base de conhecimento de ${g.empresa === 'TOKENIZA' ? 'investimentos tokenizados (Tokeniza)' : 'IR e tributação cripto (Blue)'}. 
Gere uma pergunta clara e uma resposta detalhada baseada no contexto disponível. Se não houver informação suficiente, gere uma resposta genérica útil.`
                },
                {
                  role: "user",
                  content: `Gap identificado: "${g.topic}"
Descrição: ${g.description}
Exemplos de perguntas dos leads:
${(g.sample_queries || []).slice(0, 5).join("\n")}

Contexto disponível:
${contextText}`
                },
              ],
              temperature: 0.3,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const args = JSON.parse(toolCall.function.arguments);
              
              // Insert FAQ as PENDENTE
              const { data: newFaq } = await supabase.from("knowledge_faq").insert({
                empresa: g.empresa,
                pergunta: args.pergunta,
                resposta: args.resposta,
                categoria: args.categoria || "Auto-gerada",
                fonte: "CONVERSA",
                status: "PENDENTE",
                visivel_amelia: false,
                tags: ["auto-sugerida", "gap-resolution"],
              }).select("id").single();

              if (newFaq) {
                await supabase.from("knowledge_gaps").update({
                  status: "SUGERIDO",
                  suggested_faq_id: newFaq.id,
                  auto_suggested_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }).eq("id", g.id);
                suggestedFaqs++;
              }
            }
          }
        } catch (e) {
          console.error(`Gap auto-resolution failed for ${g.id}:`, e);
        }
      }
    }
    results.suggested_faqs = suggestedFaqs;

    // ============================================
    // 5. CLEANUP EXPIRED CACHE
    // ============================================
    const { count: deletedCache } = await supabase
      .from("knowledge_query_cache")
      .delete()
      .lt("expires_at", new Date().toISOString());
    results.expired_cache_cleaned = deletedCache || 0;

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-feedback-learner error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
