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
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!resp.ok) {
      console.error("Embedding API error:", resp.status);
      return null;
    }

    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { query, empresa, top_k = 5, threshold = 0.3 } = await req.json();

    if (!query || !empresa) {
      return new Response(JSON.stringify({ error: "query and empresa are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, OPENAI_API_KEY);
    if (!queryEmbedding) {
      return new Response(JSON.stringify({ error: "Failed to generate query embedding" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search using the DB function
    const { data: results, error } = await supabase.rpc("search_knowledge_embeddings", {
      query_embedding: JSON.stringify(queryEmbedding),
      p_empresa: empresa,
      p_top_k: top_k,
      p_threshold: threshold,
    });

    if (error) {
      console.error("Search error:", error);
      return new Response(JSON.stringify({ error: "Search failed", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format results
    const chunks = (results || []).map((r: any) => ({
      text: r.chunk_text,
      source_type: r.source_type,
      source_id: r.source_id,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    // Also return a concatenated context string ready for prompt injection
    const contextText = chunks.map((c: any) => c.text).join("\n\n---\n\n");

    return new Response(JSON.stringify({
      chunks,
      context: contextText,
      total: chunks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
