import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHUNK_TOKENS = 500;
const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;

// ============================================
// TEXT SANITIZATION
// ============================================

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFFFD/g, '');
}

// ============================================
// SEMANTIC CHUNKING — Split by structure first
// ============================================

function semanticChunk(text: string, titlePrefix: string): string[] {
  if (!text || text.trim().length < 20) return [];

  // Step 1: Split by headings (##, ###) and double newlines
  const sections = text.split(/(?=^#{2,3}\s)/m);
  const rawParagraphs: string[] = [];

  for (const section of sections) {
    const paragraphs = section.split(/\n{2,}/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed.length > 10) rawParagraphs.push(trimmed);
    }
  }

  // Step 2: Merge small paragraphs, split large ones
  const chunks: string[] = [];
  let buffer = '';

  for (const para of rawParagraphs) {
    const candidateLen = buffer ? buffer.length + 2 + para.length : para.length;

    if (candidateLen <= MAX_CHUNK_CHARS) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      // Flush buffer
      if (buffer) chunks.push(buffer);
      
      // If paragraph itself exceeds limit, split it
      if (para.length > MAX_CHUNK_CHARS) {
        const subChunks = splitLargeParagraph(para);
        chunks.push(...subChunks);
        buffer = '';
      } else {
        buffer = para;
      }
    }
  }
  if (buffer) chunks.push(buffer);

  // Step 3: Add title prefix and semantic overlap
  const result: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let chunk = titlePrefix ? `${titlePrefix}\n${chunks[i]}` : chunks[i];
    
    // Add last sentence of previous chunk as overlap (except first chunk)
    if (i > 0) {
      const prevLastSentence = extractLastSentence(chunks[i - 1]);
      if (prevLastSentence && prevLastSentence.length > 15) {
        chunk = `${titlePrefix}\n[contexto anterior] ${prevLastSentence}\n\n${chunks[i]}`;
      }
    }
    
    result.push(chunk);
  }

  return result.filter(c => c.length > 30);
}

function splitLargeParagraph(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (buffer.length + sentence.length > MAX_CHUNK_CHARS) {
      if (buffer) chunks.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer += sentence;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

function extractLastSentence(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) return '';
  return sentences[sentences.length - 1].trim();
}

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
    if (!resp.ok) { console.error("Embedding API error:", resp.status, await resp.text()); return null; }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) { console.error("Embedding generation failed:", e); return null; }
}

async function embedChunks(supabase: any, chunks: string[], sourceType: string, sourceId: string, empresa: string, metadata: Record<string, unknown>, openaiKey: string) {
  let embedded = 0, errors = 0;
  await supabase.from("knowledge_embeddings").delete().eq("source_type", sourceType).eq("source_id", sourceId);
  for (let i = 0; i < chunks.length; i++) {
    const sanitizedChunk = sanitizeText(chunks[i]);
    const embedding = await generateEmbedding(sanitizedChunk, openaiKey);
    if (embedding) {
      const { error } = await supabase.from("knowledge_embeddings").insert({
        source_type: sourceType, source_id: sourceId, chunk_index: i,
        chunk_text: sanitizedChunk, embedding: JSON.stringify(embedding), metadata, empresa,
      });
      if (error) { console.error("Insert error:", error); errors++; } else embedded++;
    } else errors++;
  }
  return { embedded, errors };
}

// ============================================
// PDF TEXT EXTRACTION (enhanced)
// ============================================

function decodePdfEscapes(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_match: string, octal: string) => {
      const code = parseInt(octal, 8);
      return code > 31 && code < 127 ? String.fromCharCode(code) : '';
    });
}

async function tryInflateStream(rawStream: Uint8Array): Promise<string | null> {
  try {
    // Try zlib inflate (FlateDecode) using DecompressionStream
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    
    writer.write(rawStream).catch(() => {});
    writer.close().catch(() => {});
    
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    const maxLen = 5 * 1024 * 1024; // 5MB safety limit
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.length;
      if (totalLen > maxLen) break;
    }
    
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    
    return new TextDecoder("latin1").decode(merged);
  } catch {
    return null;
  }
}

function extractTextFromStream(content: string): string[] {
  const textParts: string[] = [];
  
  // Method 1: Tj operator
  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(content)) !== null) {
    const decoded = decodePdfEscapes(match[1]).trim();
    if (decoded) textParts.push(decoded);
  }
  
  // Method 2: TJ array operator
  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(content)) !== null) {
    const items = match[1];
    const itemRegex = /\(([^)]*)\)/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(items)) !== null) {
      const decoded = decodePdfEscapes(itemMatch[1]).trim();
      if (decoded) textParts.push(decoded);
    }
  }
  
  // Method 3: BT/ET blocks with Tj/TJ inside (if not already captured)
  if (textParts.length === 0) {
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    while ((match = btEtRegex.exec(content)) !== null) {
      const block = match[1];
      const innerTjRegex = /\(([^)]*)\)\s*Tj/g;
      let innerMatch;
      while ((innerMatch = innerTjRegex.exec(block)) !== null) {
        const decoded = decodePdfEscapes(innerMatch[1]).trim();
        if (decoded) textParts.push(decoded);
      }
    }
  }
  
  return textParts;
}

async function extractPdfTextFromBucket(supabase: any, bucket: string, storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) { console.error("Storage download error:", error); return null; }
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder("latin1");
    const raw = textDecoder.decode(bytes);
    
    console.log(`[PDF] Downloaded ${bucket}/${storagePath}, size: ${bytes.length} bytes`);
    
    const textParts: string[] = [];
    
    // Extract streams (both compressed and uncompressed)
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    let streamIndex = 0;
    
    while ((match = streamRegex.exec(raw)) !== null) {
      streamIndex++;
      const streamContent = match[1];
      
      // Try uncompressed text extraction first
      const uncompressedText = extractTextFromStream(streamContent);
      if (uncompressedText.length > 0) {
        textParts.push(...uncompressedText);
        continue;
      }
      
      // Try FlateDecode (zlib decompression)
      const streamBytes = new Uint8Array(streamContent.length);
      for (let i = 0; i < streamContent.length; i++) {
        streamBytes[i] = streamContent.charCodeAt(i);
      }
      
      const inflated = await tryInflateStream(streamBytes);
      if (inflated) {
        const compressedText = extractTextFromStream(inflated);
        if (compressedText.length > 0) {
          textParts.push(...compressedText);
        }
      }
    }
    
    console.log(`[PDF] Processed ${streamIndex} streams, extracted ${textParts.length} text fragments`);
    
    // Fallback: broad parentheses extraction
    if (textParts.length === 0) {
      console.log(`[PDF] Using fallback parentheses extraction`);
      const parenRegex = /\(([^)]{3,})\)/g;
      while ((match = parenRegex.exec(raw)) !== null) {
        const text = decodePdfEscapes(match[1]);
        if (text.trim().length > 2 && !/^[0-9.]+$/.test(text.trim())) textParts.push(text);
      }
    }
    
    const fullText = sanitizeText(textParts.join(' ').replace(/\s+/g, ' ').trim());
    console.log(`[PDF] Final extracted text length: ${fullText.length} chars`);
    
    return fullText.length > 10 ? fullText : null;
  } catch (e) { console.error("PDF extraction failed:", e); return null; }
}

async function extractPdfText(supabase: any, storagePath: string): Promise<string | null> {
  return extractPdfTextFromBucket(supabase, "knowledge-documents", storagePath);
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
      
      const titlePrefix = `[${product.produto_nome}] ${section.titulo}`;
      const chunks = semanticChunk(section.conteudo, titlePrefix);
      const r = await embedChunks(supabase, chunks, "section", source_id, product.empresa, { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_faq" && source_id) {
      const { data: faq } = await supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("id", source_id).single();
      if (!faq) return new Response(JSON.stringify({ error: "FAQ not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
      const chunks = semanticChunk(fullText, `[FAQ] ${faq.categoria}`);
      const r = await embedChunks(supabase, chunks, "faq", source_id, faq.empresa, { categoria: faq.categoria, pergunta: faq.pergunta }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_document" && source_id) {
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
      const titlePrefix = `[${product.produto_nome}] Documento: ${doc.nome_arquivo}`;
      const fullText = doc.descricao ? `${doc.descricao}\n\n${extractedText}` : extractedText;
      const chunks = semanticChunk(fullText, titlePrefix);
      const r = await embedChunks(supabase, chunks, "document", source_id, product.empresa, { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_behavioral" && source_id) {
      const { data: book } = await supabase.from("behavioral_knowledge").select("id, empresa, titulo, autor, descricao, storage_path, nome_arquivo").eq("id", source_id).single();
      if (!book) return new Response(JSON.stringify({ error: "Behavioral knowledge not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const extractedText = await extractPdfTextFromBucket(supabase, "behavioral-books", book.storage_path);
      if (!extractedText) {
        return new Response(JSON.stringify({ error: "Could not extract text from book", document: book.nome_arquivo }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[Behavioral] Extracted ${extractedText.length} chars from "${book.titulo}"`);
      const titlePrefix = `[Metodologia: ${book.titulo}${book.autor ? ` — ${book.autor}` : ''}]`;
      const fullText = book.descricao ? `${book.descricao}\n\n${extractedText}` : extractedText;
      const chunks = semanticChunk(fullText, titlePrefix);
      console.log(`[Behavioral] Generated ${chunks.length} chunks for "${book.titulo}"`);
      const r = await embedChunks(supabase, chunks, "behavioral", source_id, book.empresa, { titulo: book.titulo, autor: book.autor, tipo: "livro" }, OPENAI_API_KEY);
      totalEmbedded = r.embedded; totalErrors = r.errors;
      await supabase.from("behavioral_knowledge").update({ chunks_count: r.embedded }).eq("id", source_id);

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
        const titlePrefix = `[${product.produto_nome}] ${section.titulo}`;
        const chunks = semanticChunk(section.conteudo, titlePrefix);
        const r = await embedChunks(supabase, chunks, "section", section.id, product.empresa, { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed FAQs
      let faqQuery = supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("status", "APROVADO").eq("visivel_amelia", true);
      if (targetEmpresa) faqQuery = faqQuery.eq("empresa", targetEmpresa);
      const { data: allFaqs } = await faqQuery;
      for (const faq of (allFaqs || [])) {
        const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
        const chunks = semanticChunk(fullText, `[FAQ] ${faq.categoria}`);
        const r = await embedChunks(supabase, chunks, "faq", faq.id, faq.empresa, { categoria: faq.categoria, pergunta: faq.pergunta }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed Documents (PDFs)
      const { data: allDocs } = await supabase.from("knowledge_documents").select("id, product_knowledge_id, nome_arquivo, storage_path, tipo_documento, descricao");
      for (const doc of (allDocs || [])) {
        const product = productMap.get(doc.product_knowledge_id);
        if (!product) continue;
        const extractedText = await extractPdfText(supabase, doc.storage_path);
        if (!extractedText) { totalErrors++; continue; }
        const titlePrefix = `[${product.produto_nome}] Documento: ${doc.nome_arquivo}`;
        const fullText = doc.descricao ? `${doc.descricao}\n\n${extractedText}` : extractedText;
        const chunks = semanticChunk(fullText, titlePrefix);
        const r = await embedChunks(supabase, chunks, "document", doc.id, product.empresa, { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed Behavioral Knowledge (books/methodologies)
      let booksQuery = supabase.from("behavioral_knowledge").select("id, empresa, titulo, autor, descricao, storage_path, nome_arquivo").eq("ativo", true);
      if (targetEmpresa) booksQuery = booksQuery.eq("empresa", targetEmpresa);
      const { data: allBooks } = await booksQuery;
      for (const book of (allBooks || [])) {
        const extractedText = await extractPdfTextFromBucket(supabase, "behavioral-books", book.storage_path);
        if (!extractedText) { totalErrors++; continue; }
        const titlePrefix = `[Metodologia: ${book.titulo}${book.autor ? ` — ${book.autor}` : ''}]`;
        const fullText = book.descricao ? `${book.descricao}\n\n${extractedText}` : extractedText;
        const chunks = semanticChunk(fullText, titlePrefix);
        const r = await embedChunks(supabase, chunks, "behavioral", book.id, book.empresa, { titulo: book.titulo, autor: book.autor, tipo: "livro" }, OPENAI_API_KEY);
        totalEmbedded += r.embedded; totalErrors += r.errors;
        await supabase.from("behavioral_knowledge").update({ chunks_count: r.embedded }).eq("id", book.id);
      }

    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use: embed_section, embed_faq, embed_document, embed_behavioral, embed_all, reindex" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[knowledge-embed] Action: ${action}, embedded: ${totalEmbedded}, errors: ${totalErrors}`);

    return new Response(JSON.stringify({ success: true, embedded: totalEmbedded, errors: totalErrors, chunking: 'semantic' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-embed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
