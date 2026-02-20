import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('faq-auto-review');

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pergunta, resposta, empresa } = await req.json();
    if (!pergunta || !resposta || !empresa) {
      return new Response(JSON.stringify({ error: "pergunta, resposta e empresa são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createServiceClient();

    // Fetch approved FAQs + knowledge sections in parallel
    const [faqsRes, sectionsRes] = await Promise.all([
      supabase
        .from("knowledge_faq")
        .select("pergunta, resposta, categoria")
        .eq("empresa", empresa)
        .eq("status", "APROVADO")
        .limit(50),
      supabase
        .from("knowledge_sections")
        .select("titulo, conteudo, tipo")
        .eq("tipo", "FAQ")
        .limit(30),
    ]);

    const faqs = faqsRes.data ?? [];
    const sections = sectionsRes.data ?? [];

    // Build context
    const faqContext = faqs.length > 0
      ? faqs.map((f, i) => `FAQ #${i + 1}:\nP: ${f.pergunta}\nR: ${f.resposta}`).join("\n\n")
      : "Nenhuma FAQ aprovada encontrada.";

    const sectionContext = sections.length > 0
      ? sections.map((s, i) => `Seção #${i + 1} (${s.tipo}): ${s.titulo}\n${s.conteudo}`).join("\n\n")
      : "";

    const systemPrompt = `Você é um revisor de FAQ corporativa. Analise se a nova FAQ abaixo está alinhada com a base de conhecimento existente da empresa.

## Instruções
1. Verifique se a pergunta já está coberta (mesmo que com palavras diferentes) por alguma FAQ aprovada
2. Verifique se a resposta está alinhada com as informações da base de conhecimento
3. Se a pergunta E a resposta estão alinhadas com o conhecimento existente, aprove automaticamente
4. Se há divergência, informação nova não coberta, ou potencial erro, NÃO aprove

Retorne APENAS um JSON válido (sem markdown):
{"auto_approve": boolean, "confianca": number (0-100), "justificativa": "string curta"}`;

    const userPrompt = `## Base de FAQs Aprovadas
${faqContext}

${sectionContext ? `## Base de Conhecimento\n${sectionContext}` : ""}

## Nova FAQ para análise
Pergunta: ${pergunta}
Resposta: ${resposta}`;

    let result: Record<string, unknown> = { auto_approve: false, confianca: 0, justificativa: "Erro na análise" };

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userPrompt,
      functionName: 'faq-auto-review',
      empresa,
      temperature: 0.2,
      maxTokens: 500,
      supabase,
      model: 'gemini-flash',
    });

    if (aiResult.content) {
      try {
        const jsonMatch = aiResult.content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch {
        log.error("Could not parse AI response", { content: aiResult.content });
      }
    }

    // Enforce threshold
    const autoApprove = result.auto_approve === true && ((result.confianca as number) ?? 0) >= 85;

    return new Response(
      JSON.stringify({
        auto_approve: autoApprove,
        confianca: (result.confianca as number) ?? 0,
        justificativa: (result.justificativa as string) ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log.error("Error", { error: String(err) });
    return new Response(
      JSON.stringify({ auto_approve: false, confianca: 0, justificativa: "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
