import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHUNK_TOKENS = 500;
const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;
const BATCH_SIZE = 200;

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFFFD/g, '');
}

function semanticChunk(text: string, titlePrefix: string): string[] {
  if (!text || text.trim().length < 20) return [];

  const sections = text.split(/(?=^#{2,3}\s)/m);
  const rawParagraphs: string[] = [];

  for (const section of sections) {
    const paragraphs = section.split(/\n{2,}/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed.length > 10) rawParagraphs.push(trimmed);
    }
  }

  const chunks: string[] = [];
  let buffer = '';

  for (const para of rawParagraphs) {
    const candidateLen = buffer ? buffer.length + 2 + para.length : para.length;

    if (candidateLen <= MAX_CHUNK_CHARS) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      if (buffer) chunks.push(buffer);
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

  const result: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let chunk = titlePrefix ? `${titlePrefix}\n${chunks[i]}` : chunks[i];
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

interface EmbedChunksOptions {
  supabase: any;
  chunks: string[];
  sourceType: string;
  sourceId: string;
  empresa: string;
  metadata: Record<string, unknown>;
  openaiKey: string;
  startFrom?: number;
  skipDelete?: boolean;
}

async function embedChunks(opts: EmbedChunksOptions) {
  const { supabase, chunks, sourceType, sourceId, empresa, metadata, openaiKey, startFrom = 0, skipDelete = false } = opts;
  let embedded = 0, errors = 0;

  if (!skipDelete && startFrom === 0) {
    const { error: deleteError } = await supabase
      .from("knowledge_embeddings")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);

    if (deleteError) {
      console.error("Delete error (non-blocking):", deleteError);
    }
  }

  for (let i = startFrom; i < chunks.length; i++) {
    const sanitizedChunk = sanitizeText(chunks[i]);
    const embedding = await generateEmbedding(sanitizedChunk, openaiKey);
    if (embedding) {
      const { error } = await supabase.from("knowledge_embeddings").upsert(
        {
          source_type: sourceType,
          source_id: sourceId,
          chunk_index: i,
          chunk_text: sanitizedChunk,
          embedding: JSON.stringify(embedding),
          metadata,
          empresa,
        },
        { onConflict: "source_type,source_id,chunk_index" }
      );
      if (error) { console.error(`Upsert error chunk ${i}:`, error); errors++; } else embedded++;
    } else errors++;

    if ((i + 1) % 20 === 0) {
      console.log(`[embed] Progress: ${i + 1}/${chunks.length} chunks processed (${embedded} ok, ${errors} errors)`);
      if (sourceType === 'behavioral') {
        await supabase.from("behavioral_knowledge")
          .update({ chunks_count: embedded })
          .eq("id", sourceId);
      }
    }
  }
  return { embedded, errors };
}

async function extractPdfTextFromBucket(supabase: any, bucket: string, storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) { console.error("Storage download error:", error); return null; }
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log(`[PDF] Downloaded ${bucket}/${storagePath}, size: ${bytes.length} bytes`);

    let extractedText = '';
    try {
      const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
      const result = await pdfParse(bytes);
      extractedText = result.text || '';
      console.log(`[PDF] pdf-parse extracted ${extractedText.length} chars, ${result.numpages} pages`);
    } catch (parseError) {
      console.error("[PDF] pdf-parse failed, using fallback:", parseError);
      extractedText = fallbackExtractPdf(bytes) || '';
    }

    const sanitized = sanitizeText(extractedText.trim());
    console.log(`[PDF] Final text length: ${sanitized.length} chars`);
    return sanitized.length > 10 ? sanitized : null;
  } catch (e) { console.error("PDF extraction failed:", e); return null; }
}

function fallbackExtractPdf(bytes: Uint8Array): string | null {
  const raw = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];

  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const text = tjMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .trim();
      if (text.length > 1) textParts.push(text);
    }
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const itemRegex = /\(([^)]*)\)/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(arrMatch[1])) !== null) {
        const text = itemMatch[1].trim();
        if (text.length > 0) textParts.push(text);
      }
    }
  }

  if (textParts.length === 0) {
    const parenRegex = /\(([^)]{3,})\)/g;
    while ((match = parenRegex.exec(raw)) !== null) {
      const text = match[1].trim();
      if (text.length > 2 && !/^[0-9.]+$/.test(text)) textParts.push(text);
    }
  }

  const fullText = textParts.join(' ').replace(/\s+/g, ' ').trim();
  return fullText.length > 10 ? fullText : null;
}

async function extractPdfText(supabase: any, storagePath: string): Promise<string | null> {
  return extractPdfTextFromBucket(supabase, "knowledge-documents", storagePath);
}

function fireContinuation(supabaseUrl: string, serviceRoleKey: string, body: Record<string, unknown>) {
  const url = `${supabaseUrl}/functions/v1/knowledge-embed`;
  console.log(`[embed] Firing continuation from chunk ${body.start_from} ...`);
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  }).catch(err => console.error("[embed] Continuation fire-and-forget error:", err));
}

// ============================================
// SONNET REFINEMENT — Intelligence layer
// ============================================

const SONNET_REFINE_SYSTEM = `Você é um especialista em metodologias de vendas. Seu trabalho é analisar trechos de livros/materiais de vendas e:

1. EXTRAIR técnicas práticas, frameworks acionáveis, perguntas estratégicas, padrões de comportamento e dicas de negociação
2. ENRIQUECER o conteúdo com contexto quando necessário para que o trecho seja auto-contido e útil
3. DESCARTAR conteúdo sem valor prático: índices, sumários, agradecimentos, copyright, páginas de referência, epígrafes, dedicatórias, notas de rodapé bibliográficas, páginas em branco

Regras:
- Se o chunk contém técnicas, frameworks ou insights acionáveis de vendas: retorne o conteúdo refinado, mantendo a substância mas organizando de forma clara
- Se o chunk é puramente administrativo/sem valor prático: retorne EXATAMENTE a palavra "SKIP" (nada mais)
- NÃO resuma demais — mantenha os detalhes práticos
- NÃO invente informações que não estejam no texto original
- Mantenha o idioma original do texto`;

async function refineChunkWithSonnet(chunk: string, bookTitle: string, anthropicKey: string): Promise<string | null> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SONNET_REFINE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Livro: "${bookTitle}"\n\nTrecho para analisar:\n\n${chunk}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[Sonnet] API error ${resp.status}:`, errText);
      // On API error, keep original chunk rather than losing data
      return chunk;
    }

    const data = await resp.json();
    const content = data.content?.[0]?.text?.trim();

    if (!content) return chunk; // fallback: keep original
    if (content === "SKIP") {
      console.log(`[Sonnet] Chunk skipped (no practical value)`);
      return null;
    }

    return content;
  } catch (e) {
    console.error("[Sonnet] Refinement error:", e);
    return chunk; // fallback: keep original on error
  }
}

async function refineChunksWithSonnet(chunks: string[], bookTitle: string, anthropicKey: string): Promise<string[]> {
  const refined: string[] = [];
  let skipped = 0;

  for (let i = 0; i < chunks.length; i++) {
    const result = await refineChunkWithSonnet(chunks[i], bookTitle, anthropicKey);
    if (result === null) {
      skipped++;
    } else {
      refined.push(result);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`[Sonnet] Refinement progress: ${i + 1}/${chunks.length} (${skipped} skipped)`);
    }
  }

  console.log(`[Sonnet] Refinement complete: ${chunks.length} input → ${refined.length} output (${skipped} skipped)`);
  return refined;
}

// ============================================
// ARCHIVE — delete PDF & mark as archived
// ============================================

async function archiveBook(supabase: any, bookId: string, storagePath: string | null) {
  // Delete PDF from storage
  if (storagePath) {
    const { error } = await supabase.storage.from('behavioral-books').remove([storagePath]);
    if (error) {
      console.error(`[Archive] Failed to delete PDF from storage:`, error);
    } else {
      console.log(`[Archive] PDF deleted from storage: ${storagePath}`);
    }
  }

  // Mark as archived
  await supabase.from("behavioral_knowledge").update({
    arquivado: true,
    storage_path: null,
  }).eq("id", bookId);

  console.log(`[Archive] Book ${bookId} marked as archived`);
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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || '';

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, source_id, empresa, start_from: rawStartFrom } = body;
    const startFrom = rawStartFrom ? parseInt(rawStartFrom, 10) : 0;
    let totalEmbedded = 0, totalErrors = 0;

    if (action === "embed_section" && source_id) {
      const { data: section } = await supabase.from("knowledge_sections").select("id, tipo, titulo, conteudo, product_knowledge_id").eq("id", source_id).single();
      if (!section) return new Response(JSON.stringify({ error: "Section not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: product } = await supabase.from("product_knowledge").select("empresa, produto_nome").eq("id", section.product_knowledge_id).single();
      if (!product) return new Response(JSON.stringify({ error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      const titlePrefix = `[${product.produto_nome}] ${section.titulo}`;
      const chunks = semanticChunk(section.conteudo, titlePrefix);
      const r = await embedChunks({ supabase, chunks, sourceType: "section", sourceId: source_id, empresa: product.empresa, metadata: { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, openaiKey: OPENAI_API_KEY });
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_faq" && source_id) {
      const { data: faq } = await supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("id", source_id).single();
      if (!faq) return new Response(JSON.stringify({ error: "FAQ not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
      const chunks = semanticChunk(fullText, `[FAQ] ${faq.categoria}`);
      const r = await embedChunks({ supabase, chunks, sourceType: "faq", sourceId: source_id, empresa: faq.empresa, metadata: { categoria: faq.categoria, pergunta: faq.pergunta }, openaiKey: OPENAI_API_KEY });
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
      const r = await embedChunks({ supabase, chunks, sourceType: "document", sourceId: source_id, empresa: product.empresa, metadata: { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, openaiKey: OPENAI_API_KEY });
      totalEmbedded = r.embedded; totalErrors = r.errors;

    } else if (action === "embed_behavioral" && source_id) {
      const { data: book } = await supabase.from("behavioral_knowledge").select("id, empresa, titulo, autor, descricao, storage_path, nome_arquivo, embed_status, embed_started_at, arquivado").eq("id", source_id).single();
      if (!book) return new Response(JSON.stringify({ error: "Behavioral knowledge not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      // Block re-indexing of archived books
      if (book.arquivado || !book.storage_path) {
        return new Response(JSON.stringify({ error: "Este livro já foi arquivado. O PDF foi processado e removido. Reindexação não é possível.", archived: true }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // On continuation (start_from > 0), skip concurrency lock and PDF extraction
      if (startFrom > 0) {
        console.log(`[Behavioral] Continuation from chunk ${startFrom} for "${book.titulo}"`);
        // Continuation receives pre-refined chunks via body
        const continuationChunks = body.refined_chunks as string[] | undefined;
        if (!continuationChunks || continuationChunks.length === 0) {
          await supabase.from("behavioral_knowledge").update({ embed_status: 'error' }).eq("id", source_id);
          return new Response(JSON.stringify({ error: "No refined chunks provided for continuation" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        const endIdx = Math.min(startFrom + BATCH_SIZE, continuationChunks.length);
        console.log(`[Behavioral] Processing chunks ${startFrom}-${endIdx - 1} of ${continuationChunks.length}`);
        
        const r = await embedChunks({
          supabase, chunks: continuationChunks.slice(0, endIdx), sourceType: "behavioral", sourceId: source_id,
          empresa: book.empresa, metadata: { titulo: book.titulo, autor: book.autor, tipo: "livro" },
          openaiKey: OPENAI_API_KEY, startFrom, skipDelete: true,
        });
        totalEmbedded = r.embedded; totalErrors = r.errors;
        
        // If there are more chunks, fire another continuation
        if (endIdx < continuationChunks.length) {
          await supabase.from("behavioral_knowledge").update({ chunks_count: r.embedded, embed_status: 'processing' }).eq("id", source_id);
          fireContinuation(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { action: "embed_behavioral", source_id, start_from: endIdx, refined_chunks: continuationChunks });
          return new Response(JSON.stringify({ success: true, embedded: r.embedded, errors: r.errors, status: 'partial', next_from: endIdx, total_chunks: continuationChunks.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Final batch done — count total embeddings and archive
        const { count } = await supabase.from("knowledge_embeddings").select("id", { count: "exact", head: true }).eq("source_type", "behavioral").eq("source_id", source_id);
        await supabase.from("behavioral_knowledge").update({ chunks_count: count || r.embedded, embed_status: 'done' }).eq("id", source_id);
        
        // Archive: delete PDF and mark as archived
        await archiveBook(supabase, source_id, book.storage_path);
        
      } else {
        // First invocation — full flow
        // Concurrency lock
        if (book.embed_status === 'processing' && book.embed_started_at) {
          const startedAt = new Date(book.embed_started_at).getTime();
          const fiveMinAgo = Date.now() - 5 * 60 * 1000;
          if (startedAt > fiveMinAgo) {
            console.log(`[Behavioral] SKIPPED "${book.titulo}" — already processing since ${book.embed_started_at}`);
            return new Response(JSON.stringify({ success: true, skipped: true, reason: "already_processing", titulo: book.titulo }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        await supabase.from("behavioral_knowledge").update({ embed_status: 'processing', embed_started_at: new Date().toISOString() }).eq("id", source_id);

        try {
          const extractedText = await extractPdfTextFromBucket(supabase, "behavioral-books", book.storage_path);
          if (!extractedText) {
            await supabase.from("behavioral_knowledge").update({ embed_status: 'error' }).eq("id", source_id);
            return new Response(JSON.stringify({ error: "Could not extract text from book", document: book.nome_arquivo }), {
              status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log(`[Behavioral] Extracted ${extractedText.length} chars from "${book.titulo}"`);
          const titlePrefix = `[Metodologia: ${book.titulo}${book.autor ? ` — ${book.autor}` : ''}]`;
          const fullText = book.descricao ? `${book.descricao}\n\n${extractedText}` : extractedText;
          const rawChunks = semanticChunk(fullText, titlePrefix);
          console.log(`[Behavioral] Generated ${rawChunks.length} raw chunks for "${book.titulo}"`);
          
          // INTELLIGENCE LAYER: Refine chunks with Claude Sonnet
          let chunks: string[];
          if (ANTHROPIC_API_KEY) {
            console.log(`[Behavioral] Starting Sonnet refinement for ${rawChunks.length} chunks...`);
            chunks = await refineChunksWithSonnet(rawChunks, book.titulo, ANTHROPIC_API_KEY);
            console.log(`[Behavioral] After refinement: ${chunks.length} chunks (${rawChunks.length - chunks.length} discarded)`);
          } else {
            console.warn(`[Behavioral] ANTHROPIC_API_KEY not configured — skipping Sonnet refinement`);
            chunks = rawChunks;
          }
          
          // If too many chunks, process only first batch and fire continuation
          const endIdx = Math.min(BATCH_SIZE, chunks.length);
          const r = await embedChunks({
            supabase, chunks: chunks.slice(0, endIdx), sourceType: "behavioral", sourceId: source_id,
            empresa: book.empresa, metadata: { titulo: book.titulo, autor: book.autor, tipo: "livro" },
            openaiKey: OPENAI_API_KEY,
          });
          totalEmbedded = r.embedded; totalErrors = r.errors;
          
          if (endIdx < chunks.length) {
            // More chunks to process — fire continuation with refined chunks
            await supabase.from("behavioral_knowledge").update({ chunks_count: r.embedded, embed_status: 'processing' }).eq("id", source_id);
            fireContinuation(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { action: "embed_behavioral", source_id, start_from: endIdx, refined_chunks: chunks });
            return new Response(JSON.stringify({ success: true, embedded: r.embedded, errors: r.errors, status: 'partial', next_from: endIdx, total_chunks: chunks.length }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          
          await supabase.from("behavioral_knowledge").update({ chunks_count: r.embedded, embed_status: 'done' }).eq("id", source_id);
          
          // Archive: delete PDF and mark as archived
          await archiveBook(supabase, source_id, book.storage_path);
          
        } catch (embedError) {
          await supabase.from("behavioral_knowledge").update({ embed_status: 'error' }).eq("id", source_id);
          throw embedError;
        }
      }

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
        const r = await embedChunks({ supabase, chunks, sourceType: "section", sourceId: section.id, empresa: product.empresa, metadata: { tipo: section.tipo, titulo: section.titulo, produto: product.produto_nome }, openaiKey: OPENAI_API_KEY });
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed FAQs
      let faqQuery = supabase.from("knowledge_faq").select("id, pergunta, resposta, categoria, empresa").eq("status", "APROVADO").eq("visivel_amelia", true);
      if (targetEmpresa) faqQuery = faqQuery.eq("empresa", targetEmpresa);
      const { data: allFaqs } = await faqQuery;
      for (const faq of (allFaqs || [])) {
        const fullText = `Pergunta: ${faq.pergunta}\nResposta: ${faq.resposta}`;
        const chunks = semanticChunk(fullText, `[FAQ] ${faq.categoria}`);
        const r = await embedChunks({ supabase, chunks, sourceType: "faq", sourceId: faq.id, empresa: faq.empresa, metadata: { categoria: faq.categoria, pergunta: faq.pergunta }, openaiKey: OPENAI_API_KEY });
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
        const r = await embedChunks({ supabase, chunks, sourceType: "document", sourceId: doc.id, empresa: product.empresa, metadata: { documento: doc.nome_arquivo, produto: product.produto_nome, tipo: doc.tipo_documento }, openaiKey: OPENAI_API_KEY });
        totalEmbedded += r.embedded; totalErrors += r.errors;
      }

      // Embed Behavioral Knowledge — only non-archived books
      let booksQuery = supabase.from("behavioral_knowledge").select("id, empresa, titulo, autor, descricao, storage_path, nome_arquivo, embed_status, embed_started_at, arquivado").eq("ativo", true).eq("arquivado", false);
      if (targetEmpresa) booksQuery = booksQuery.eq("empresa", targetEmpresa);
      const { data: allBooks } = await booksQuery;
      for (const book of (allBooks || [])) {
        if (!book.storage_path) continue; // skip books without PDF
        if (book.embed_status === 'processing' && book.embed_started_at) {
          const startedAt = new Date(book.embed_started_at).getTime();
          if (startedAt > Date.now() - 5 * 60 * 1000) {
            console.log(`[Behavioral] SKIPPED "${book.titulo}" in reindex — already processing`);
            continue;
          }
        }
        fireContinuation(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { action: "embed_behavioral", source_id: book.id });
        console.log(`[Behavioral] Queued "${book.titulo}" for embedding`);
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
