import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOKEN = 4;

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + maxChars * 0.5) end = breakPoint + 1;
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
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!resp.ok) { console.error("Embedding API error:", resp.status, await resp.text()); return null; }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) { console.error("Embedding generation failed:", e); return null; }
}

async function embedChunks(supabase: any, chunks: string[], sourceType: string, sourceId: string, empresa: string, metadata: Record<string, unknown>, openaiKey: string) {
  let embedded = 0, errors = 0;
  await supabase.from("knowledge_embeddings").delete().eq("source_type", sourceType).eq("source_id", sourceId);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i], openaiKey);
    if (embedding) {
      const { error } = await supabase.from("knowledge_embeddings").insert({
        source_type: sourceType, source_id: sourceId, chunk_index: i,
        chunk_text: chunks[i], embedding: JSON.stringify(embedding), metadata, empresa,
      });
      if (error) { console.error("Insert error:", error); errors++; } else embedded++;
    } else errors++;
  }
  return { embedded, errors };
}

// Extract text from PDF stored in Supabase Storage
async function extractPdfText(supabase: any, storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from("knowledge-documents").download(storagePath);
    if (error || !data) { console.error("Storage download error:", error); return null; }

    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Simple PDF text extraction — extract text between BT/ET blocks and parentheses
    const textDecoder = new TextDecoder("latin1");
    const raw = textDecoder.decode(bytes);
    const textParts: string[] = [];

    // Method 1: Extract from stream objects (works for most PDFs)
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    while ((match = streamRegex.exec(raw)) !== null) {
      const content = match[1];
      // Extract text from Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(content)) !== null) {
        if (tjMatch[1].trim()) textParts.push(tjMatch[1]);
      }
      // Extract from TJ arrays
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = tjArrayRegex.exec(content)) !== null) {
        const items = tjArrayMatch[1];
        const itemRegex = /\(([^)]*)\)/g;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(items)) !== null) {
          if (itemMatch[1].trim()) textParts.push(itemMatch[1]);
        }
      }
    }

    // Method 2: Simple parenthesis extraction as fallback
    if (textParts.length === 0) {
      const parenRegex = /\(([^)]{3,})\)/g;
      while ((match = parenRegex.exec(raw)) !== null) {
        const text = match[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\/g, '');
        if (text.trim().length > 2 && !/^[0-9.]+$/.test(text.trim())) {
          textParts.push(text);
        }
      }
    }

    const fullText = textParts.join(' ').replace(/\s+/g, ' ').trim();
    return fullText.length > 10 ? fullText : null;
  } catch (e) {
    console.error("PDF extraction failed:", e);
    return null;
  }
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
    const body = await req.json();
    const { action, source_id, empresa } = body;
    let totalEmbedded = 0, totalErrors = 0;

    if (action === "embed_section" && source_id) {
      const { data: section } = await supabase.from("knowledge_sections").select("id, tipo, titulo, conteudo, product_knowledge_id").eq("id", source_id).single();
      if (!section) return new Response(JSON.stringify({ error: "Section not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: product } = await supabase.from("product_knowledge").select("empresa, produto_nome").eq("id", section.product_knowledge_id).single();
      if (!product) return new Response(JSON.stringify({ error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fullText = `[${product.produto_nome}] ${section.titulo}\n${section.conteudo}`;
      const r = await embedChunks(supabase, chunkText(fullText), "section", source_id, product.empresa, { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_faq" && source_id) {
      const { data: faq } = await supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("id", source_id).single();
      if (!faq) return new Response(JSON.stringify({ error: "FAQ not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
      const r = await embedChunks(supabase, chunkText(fullText), "faq", source_id, faq.empresa, { categoria: faq.categoria, pergunta: faq.pergunta }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_document" && source_id) {
      // === FASE 1: PDF Document Indexing ===
      const { data: doc } = await supabase.from("knowledge_documents").select("id, product_knowledge_id, nome_arquivo, storage_path, tipo_documento, descricao").eq("id", source_id).single();
      if (!doc) return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: product } = await supabase.from("product_knowledge").select("empresa, produto_nome").eq("id", doc.product_knowledge_id).single();
      if (!product) return new Response(JSON.stringify({ error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const extractedText = await extractPdfText(supabase, doc.storage_path);
      if (!extractedText) {
        return new Response(JSON.stringify({ error: "Could not extract text from document", document: doc.nome_arquivo }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullText = `[${product.produto_nome}] Documento: ${doc.nome_arquivo}\n${doc.descricao ? doc.descricao + '\n' : ''}${extractedText}`;
      const r = await embedChunks(supabase, chunkText(fullText), "document", source_id, product.empresa, { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_all" || action === "reindex") {
      const targetEmpresa = empresa || null;

      if (action === "reindex") {
        let deleteQuery = supabase.from("knowledge_embeddings").delete();
        if (targetEmpresa) deleteQuery = deleteQuery.eq("empresa", targetEmpresa);
        else deleteQuery = deleteQuery.neq("empresa", "");
        await deleteQuery;
      }

      // Embed sections
      const { data: allSections } = await supabase.from("knowledge_sections").select("id, tipo, titulo, conteudo, product_knowledge_id").order("ordem");
      let productsQuery = supabase.from("product_knowledge").select("id, empresa, produto_nome").eq("ativo", true);
      if (targetEmpresa) productsQuery = productsQuery.eq("empresa", targetEmpresa);
      const { data: allProducts } = await productsQuery;
      const productMap = new Map((allProducts || []).map((p: any) => [p.id, p]));

      for (const section of (allSections || [])) {
        const product = productMap.get(section.product_knowledge_id);
        if (!product) continue;
        const fullText = `[${product.produto_nome}] ${section.titulo}\n${section.conteudo}`;
        const r = await embedChunks(supabase, chunkText(fullText), "section", section.id, product.empresa, { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed FAQs
      let faqQuery = supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("status", "APROVADO").eq("visivel_amelia", true);
      if (targetEmpresa) faqQuery = faqQuery.eq("empresa", targetEmpresa);
      const { data: allFaqs } = await faqQuery;
      for (const faq of (allFaqs || [])) {
        const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
        const r = await embedChunks(supabase, chunkText(fullText), "faq", faq.id, faq.empresa, { categoria: faq.categoria, pergunta: faq.pergunta }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // === FASE 1: Embed Documents (PDFs) ===
      let docQuery = supabase.from("knowledge_documents").select("id, product_knowledge_id, nome_arquivo, storage_path, tipo_documento, descricao");
      const { data: allDocs } = await docQuery;
      for (const doc of (allDocs || [])) {
        const product = productMap.get(doc.product_knowledge_id);
        if (!product) continue;
        const extractedText = await extractPdfText(supabase, doc.storage_path);
        if (!extractedText) { totalErrors++; continue; }
        const fullText = `[${product.produto_nome}] Documento: ${doc.nome_arquivo}\n${doc.descricao ? doc.descricao + '\n' : ''}${extractedText}`;
        const r = await embedChunks(supabase, chunkText(fullText), "document", doc.id, product.empresa, { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use: embed_section, embed_faq, embed_document, embed_all, reindex" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, embedded: totalEmbedded, errors: totalErrors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-embed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
