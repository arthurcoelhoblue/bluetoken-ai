import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey.replace(/[^\x20-\x7E]/g, '')}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!resp.ok) { console.error("Embedding API error:", resp.status); return null; }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) { console.error("Embedding generation failed:", e); return null; }
}

// ============================================
// QUERY EXPANSION via Lovable AI
// ============================================

async function expandQuery(query: string, empresa: string, lovableApiKey: string): Promise<string> {
  // Skip expansion for already-long queries
  if (query.split(/\s+/).length > 12) return query;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um otimizador de queries de busca. Expanda a query do usuário para melhorar a busca semântica em uma base de conhecimento de ${empresa === 'TOKENIZA' ? 'investimentos tokenizados' : 'IR e tributação cripto'}.
Regras:
- Mantenha o significado original
- Adicione sinônimos e termos relacionados
- Máximo 50 palavras
- Retorne APENAS a query expandida, sem explicações`
          },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!resp.ok) {
      console.error("Query expansion failed:", resp.status);
      return query;
    }

    const data = await resp.json();
    const expanded = data.choices?.[0]?.message?.content?.trim();
    return expanded && expanded.length > query.length ? expanded : query;
  } catch (e) {
    console.error("Query expansion error:", e);
    return query;
  }
}

// ============================================
// QUERY CACHE
// ============================================

async function getCachedExpansion(supabase: any, queryHash: string): Promise<{ expanded_query: string; embedding: number[] } | null> {
  const { data } = await supabase
    .from("knowledge_query_cache")
    .select("expanded_query, embedding")
    .eq("query_hash", queryHash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (data) {
    // Increment hit count
    await supabase.from("knowledge_query_cache").update({ hit_count: (data.hit_count || 0) + 1 }).eq("query_hash", queryHash);
    return { expanded_query: data.expanded_query, embedding: data.embedding };
  }
  return null;
}

async function cacheExpansion(supabase: any, queryHash: string, originalQuery: string, expandedQuery: string, embedding: number[], empresa: string) {
  await supabase.from("knowledge_query_cache").upsert({
    query_hash: queryHash,
    original_query: originalQuery,
    expanded_query: expandedQuery,
    embedding: JSON.stringify(embedding),
    empresa,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "query_hash" });
}

function hashQuery(query: string): string {
  // Simple hash for caching
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// RE-RANKING via Lovable AI
// ============================================

async function rerankChunks(
  query: string,
  chunks: any[],
  lovableApiKey: string,
  topK: number
): Promise<any[]> {
  if (chunks.length <= topK) return chunks;

  try {
    const chunkSummaries = chunks.map((c, i) => `[${i}] ${c.text.slice(0, 300)}`).join("\n\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um ranqueador de relevância. Dado uma pergunta e trechos de texto, retorne os índices dos ${topK} trechos MAIS relevantes, ordenados do mais ao menos relevante.
Retorne APENAS os índices separados por vírgula, sem explicações. Exemplo: 2,0,4,1,3`
          },
          {
            role: "user",
            content: `Pergunta: ${query}\n\nTrechos:\n${chunkSummaries}`
          }
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    if (!resp.ok) {
      console.error("Re-ranking failed:", resp.status);
      return chunks.slice(0, topK);
    }

    const data = await resp.json();
    const indicesStr = data.choices?.[0]?.message?.content?.trim() || '';
    const indices = indicesStr.split(/[,\s]+/).map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n) && n >= 0 && n < chunks.length);

    if (indices.length === 0) return chunks.slice(0, topK);

    // Build re-ranked list, add any missing chunks at the end
    const seen = new Set<number>();
    const reranked: any[] = [];
    for (const idx of indices) {
      if (!seen.has(idx) && reranked.length < topK) {
        reranked.push({ ...chunks[idx], rerank_position: reranked.length + 1 });
        seen.add(idx);
      }
    }
    // Fill remaining spots
    for (let i = 0; i < chunks.length && reranked.length < topK; i++) {
      if (!seen.has(i)) {
        reranked.push({ ...chunks[i], rerank_position: reranked.length + 1 });
        seen.add(i);
      }
    }
    return reranked;
  } catch (e) {
    console.error("Re-ranking error:", e);
    return chunks.slice(0, topK);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.replace(/[^\x20-\x7E]/g, '');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { query, empresa, top_k = 5, threshold = 0.2 } = await req.json();

    if (!query || !empresa) {
      return new Response(JSON.stringify({ error: "query and empresa are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    let searchMethod = "hybrid";
    let expandedQuery = query;
    let queryEmbedding: number[] | null = null;

    // === STEP 1: Check cache ===
    const qHash = hashQuery(query.toLowerCase().trim());
    const cached = await getCachedExpansion(supabase, qHash);

    if (cached) {
      expandedQuery = cached.expanded_query;
      queryEmbedding = cached.embedding;
      searchMethod = "hybrid_cached";
    } else {
      // === STEP 2: Query Expansion ===
      if (LOVABLE_API_KEY) {
        expandedQuery = await expandQuery(query, empresa, LOVABLE_API_KEY);
      }

      // === STEP 3: Generate embedding ===
      queryEmbedding = await generateEmbedding(expandedQuery, OPENAI_API_KEY);

      // Cache for future use
      if (queryEmbedding) {
        await cacheExpansion(supabase, qHash, query, expandedQuery, queryEmbedding, empresa);
      }
    }

    let chunks: any[] = [];

    // === STEP 4: Hybrid Search (RRF) ===
    if (queryEmbedding) {
      const { data: results, error } = await supabase.rpc("hybrid_search_knowledge", {
        query_embedding: JSON.stringify(queryEmbedding),
        query_text: expandedQuery,
        p_empresa: empresa,
        p_top_k: Math.max(top_k * 2, 10), // Get more for re-ranking
        p_threshold: threshold,
      });

      if (!error && results && results.length > 0) {
        chunks = results.map((r: any) => ({
          text: r.chunk_text,
          source_type: r.source_type,
          source_id: r.source_id,
          similarity: r.similarity,
          rrf_score: r.rrf_score,
          search_source: r.search_source,
          metadata: r.metadata,
        }));
      }
    }

    // If hybrid search returned nothing, try vector-only with original query
    if (chunks.length === 0 && queryEmbedding) {
      const { data: results } = await supabase.rpc("search_knowledge_embeddings", {
        query_embedding: JSON.stringify(queryEmbedding),
        p_empresa: empresa,
        p_top_k: top_k,
        p_threshold: threshold,
      });
      if (results && results.length > 0) {
        searchMethod = "vector_fallback";
        chunks = results.map((r: any) => ({
          text: r.chunk_text, source_type: r.source_type, source_id: r.source_id,
          similarity: r.similarity, metadata: r.metadata,
        }));
      }
    }

    // === STEP 5: Re-Ranking with AI ===
    if (chunks.length > top_k && LOVABLE_API_KEY) {
      chunks = await rerankChunks(query, chunks, LOVABLE_API_KEY, top_k);
      searchMethod += "+reranked";
    } else {
      chunks = chunks.slice(0, top_k);
    }

    const contextText = chunks.map((c: any) => c.text).join("\n\n---\n\n");
    const processingMs = Date.now() - startTime;

    return new Response(JSON.stringify({
      chunks,
      context: contextText,
      total: chunks.length,
      search_method: searchMethod,
      expanded_query: expandedQuery !== query ? expandedQuery : undefined,
      processing_ms: processingMs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("knowledge-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
