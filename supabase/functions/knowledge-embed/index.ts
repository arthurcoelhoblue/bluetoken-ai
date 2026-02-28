import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 500; // tokens (~2000 chars)
const CHUNK_OVERLAP = 50; // tokens (~200 chars)
const CHARS_PER_TOKEN = 4;

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;
  
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChars;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + maxChars * 0.5) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlapChars;
  }
  
  return chunks.filter(c => c.length > 20);
}

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
        input: text.slice(0, 8000), // limit input
      }),
    });
    
    if (!resp.ok) {
      console.error("Embedding API error:", resp.status, await resp.text());
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
    const body = await req.json();
    
    // Supports: { action: "embed_section" | "embed_faq" | "embed_all" | "reindex", source_id?, empresa? }
    const { action, source_id, empresa } = body;
    
    let embedded = 0;
    let errors = 0;

    if (action === "embed_section" && source_id) {
      // Embed a single knowledge section
      const { data: section } = await supabase
        .from("knowledge_sections")
        .select("id, tipo, titulo, conteudo, product_knowledge_id")
        .eq("id", source_id)
        .single();
      
      if (!section) {
        return new Response(JSON.stringify({ error: "Section not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get empresa from product
      const { data: product } = await supabase
        .from("product_knowledge")
        .select("empresa, produto_nome")
        .eq("id", section.product_knowledge_id)
        .single();

      if (!product) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullText = `[${product.produto_nome}] ${section.titulo}\n${section.conteudo}`;
      const chunks = chunkText(fullText);

      // Delete existing embeddings for this source
      await supabase.from("knowledge_embeddings").delete().eq("source_type", "section").eq("source_id", source_id);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i], OPENAI_API_KEY);
        if (embedding) {
          const { error } = await supabase.from("knowledge_embeddings").insert({
            source_type: "section",
            source_id: source_id,
            chunk_index: i,
            chunk_text: chunks[i],
            embedding: JSON.stringify(embedding),
            metadata: { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome },
            empresa: product.empresa,
          });
          if (error) { console.error("Insert error:", error); errors++; }
          else embedded++;
        } else errors++;
      }

    } else if (action === "embed_faq" && source_id) {
      // Embed a single FAQ
      const { data: faq } = await supabase
        .from("knowledge_faq")
        .select("id, pergunta, resposta, categoria, empresa")
        .eq("id", source_id)
        .single();
      
      if (!faq) {
        return new Response(JSON.stringify({ error: "FAQ not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
      const chunks = chunkText(fullText);

      await supabase.from("knowledge_embeddings").delete().eq("source_type", "faq").eq("source_id", source_id);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i], OPENAI_API_KEY);
        if (embedding) {
          const { error } = await supabase.from("knowledge_embeddings").insert({
            source_type: "faq",
            source_id: source_id,
            chunk_index: i,
            chunk_text: chunks[i],
            embedding: JSON.stringify(embedding),
            metadata: { categoria: faq.categoria, pergunta: faq.pergunta },
            empresa: faq.empresa,
          });
          if (error) { console.error("Insert error:", error); errors++; }
          else embedded++;
        } else errors++;
      }

    } else if (action === "embed_all" || action === "reindex") {
      const targetEmpresa = empresa || null;

      // Delete existing embeddings if reindexing
      if (action === "reindex") {
        let deleteQuery = supabase.from("knowledge_embeddings").delete();
        if (targetEmpresa) deleteQuery = deleteQuery.eq("empresa", targetEmpresa);
        else deleteQuery = deleteQuery.neq("empresa", ""); // delete all
        await deleteQuery;
      }

      // Embed all sections
      let sectionsQuery = supabase
        .from("knowledge_sections")
        .select("id, tipo, titulo, conteudo, product_knowledge_id")
        .order("ordem");

      const { data: allSections } = await sectionsQuery;

      // Get products for empresa mapping
      let productsQuery = supabase.from("product_knowledge").select("id, empresa, produto_nome").eq("ativo", true);
      if (targetEmpresa) productsQuery = productsQuery.eq("empresa", targetEmpresa);
      const { data: allProducts } = await productsQuery;
      
      const productMap = new Map((allProducts || []).map(p => [p.id, p]));

      for (const section of (allSections || [])) {
        const product = productMap.get(section.product_knowledge_id);
        if (!product) continue;

        const fullText = `[${product.produto_nome}] ${section.titulo}\n${section.conteudo}`;
        const chunks = chunkText(fullText);

        // Delete existing for this section
        await supabase.from("knowledge_embeddings").delete().eq("source_type", "section").eq("source_id", section.id);

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i], OPENAI_API_KEY);
          if (embedding) {
            const { error } = await supabase.from("knowledge_embeddings").insert({
              source_type: "section",
              source_id: section.id,
              chunk_index: i,
              chunk_text: chunks[i],
              embedding: JSON.stringify(embedding),
              metadata: { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome },
              empresa: product.empresa,
            });
            if (error) { errors++; } else embedded++;
          } else errors++;
        }
      }

      // Embed all approved FAQs
      let faqQuery = supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("status", "APROVADO").eq("visivel_amelia", true);
      if (targetEmpresa) faqQuery = faqQuery.eq("empresa", targetEmpresa);
      const { data: allFaqs } = await faqQuery;

      for (const faq of (allFaqs || [])) {
        const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
        const chunks = chunkText(fullText);

        await supabase.from("knowledge_embeddings").delete().eq("source_type", "faq").eq("source_id", faq.id);

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i], OPENAI_API_KEY);
          if (embedding) {
            const { error } = await supabase.from("knowledge_embeddings").insert({
              source_type: "faq",
              source_id: faq.id,
              chunk_index: i,
              chunk_text: chunks[i],
              embedding: JSON.stringify(embedding),
              metadata: { categoria: faq.categoria, pergunta: faq.pergunta },
              empresa: faq.empresa,
            });
            if (error) { errors++; } else embedded++;
          } else errors++;
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use: embed_section, embed_faq, embed_all, reindex" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, embedded, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-embed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
