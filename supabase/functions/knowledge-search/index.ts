import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!resp.ok) { console.error("Embedding API error:", resp.status); return null; }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) { console.error("Embedding generation failed:", e); return null; }
}

// === FASE 4: Keyword fallback search ===
function extractKeywords(query: string): string[] {
  const stopwords = new Set(['a', 'o', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'para', 'com', 'no', 'na', 'por', 'se', 'como', 'mais', 'mas', 'os', 'as', 'dos', 'das', 'ao', 'é', 'eu', 'me', 'meu', 'minha', 'te', 'tu', 'seu', 'sua', 'ele', 'ela', 'nós', 'eles', 'esse', 'essa', 'isso', 'este', 'esta', 'isto', 'aquele', 'aquela', 'muito', 'bem', 'não', 'sim', 'já', 'tem', 'ser', 'ter', 'fazer', 'pode', 'vai', 'vou', 'foi', 'sobre', 'quero', 'preciso', 'gostaria']);
  return query.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

async function keywordFallbackSearch(supabase: any, query: string, empresa: string, topK: number) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  // Search in knowledge_sections
  const { data: sections } = await supabase
    .from("knowledge_sections")
    .select("id, titulo, conteudo, tipo, product_knowledge_id")
    .order("ordem");

  // Search in knowledge_faq
  const { data: faqs } = await supabase
    .from("knowledge_faq")
    .select("id, pergunta, resposta, categoria, empresa")
    .eq("empresa", empresa)
    .eq("status", "APROVADO")
    .eq("visivel_amelia", true);

  // Get products for empresa filtering
  const { data: products } = await supabase
    .from("product_knowledge")
    .select("id, empresa, produto_nome")
    .eq("empresa", empresa)
    .eq("ativo", true);
  const productIds = new Set((products || []).map((p: any) => p.id));
  const productMap = new Map((products || []).map((p: any) => [p.id, p]));

  type ScoredResult = { text: string; source_type: string; source_id: string; similarity: number; metadata: Record<string, unknown> };
  const results: ScoredResult[] = [];

  // Score sections
  for (const section of (sections || [])) {
    if (!productIds.has(section.product_knowledge_id)) continue;
    const text = `${section.titulo} ${section.conteudo}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    for (const kw of keywords) { if (text.includes(kw)) score++; }
    if (score > 0) {
      const product = productMap.get(section.product_knowledge_id);
      results.push({
        text: `[${product?.produto_nome || ''}] ${section.titulo}\n${section.conteudo}`,
        source_type: "section", source_id: section.id,
        similarity: score / keywords.length,
        metadata: { tipo: section.tipo, titulo: section.titulo, produto: product?.produto_nome },
      });
    }
  }

  // Score FAQs
  for (const faq of (faqs || [])) {
    const text = `${faq.pergunta} ${faq.resposta}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    for (const kw of keywords) { if (text.includes(kw)) score++; }
    if (score > 0) {
      results.push({
        text: `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`,
        source_type: "faq", source_id: faq.id,
        similarity: score / keywords.length,
        metadata: { categoria: faq.categoria, pergunta: faq.pergunta },
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { query, empresa, top_k = 5, threshold = 0.3 } = await req.json();

    if (!query || !empresa) {
      return new Response(JSON.stringify({ error: "query and empresa are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try semantic search first
    const queryEmbedding = await generateEmbedding(query, OPENAI_API_KEY);
    let chunks: any[] = [];
    let searchMethod = "semantic";

    if (queryEmbedding) {
      const { data: results, error } = await supabase.rpc("search_knowledge_embeddings", {
        query_embedding: JSON.stringify(queryEmbedding),
        p_empresa: empresa,
        p_top_k: top_k,
        p_threshold: threshold,
      });

      if (!error && results && results.length > 0) {
        chunks = results.map((r: any) => ({
          text: r.chunk_text, source_type: r.source_type, source_id: r.source_id,
          similarity: r.similarity, metadata: r.metadata,
        }));
      }
    }

    // === FASE 4: Keyword fallback when semantic search returns 0 results ===
    if (chunks.length === 0) {
      searchMethod = "keyword_fallback";
      console.log("Semantic search returned 0 results, falling back to keyword search");
      const fallbackResults = await keywordFallbackSearch(supabase, query, empresa, top_k);
      chunks = fallbackResults;
    }

    const contextText = chunks.map((c: any) => c.text).join("\n\n---\n\n");

    return new Response(JSON.stringify({
      chunks, context: contextText, total: chunks.length, search_method: searchMethod,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("knowledge-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
