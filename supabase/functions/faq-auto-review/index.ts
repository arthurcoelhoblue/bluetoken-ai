import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pergunta, resposta, empresa } = await req.json();

    if (!pergunta || !resposta || !empresa) {
      return new Response(
        JSON.stringify({ error: "pergunta, resposta e empresa são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    let result: any = { auto_approve: false, confianca: 0, justificativa: "Erro na análise" };

    const aiResult = await callAI({
      system: systemPrompt,
      prompt: userPrompt,
      functionName: 'faq-auto-review',
      empresa,
      temperature: 0.2,
      maxTokens: 500,
      supabase,
    });

    if (aiResult.content) {
      try {
        const jsonMatch = aiResult.content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error("Could not parse AI response:", aiResult.content);
      }
    }

    // Enforce threshold
    const autoApprove = result.auto_approve === true && (result.confianca ?? 0) >= 85;

    return new Response(
      JSON.stringify({
        auto_approve: autoApprove,
        confianca: result.confianca ?? 0,
        justificativa: result.justificativa ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("faq-auto-review error:", err);
    return new Response(
      JSON.stringify({ auto_approve: false, confianca: 0, justificativa: "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
