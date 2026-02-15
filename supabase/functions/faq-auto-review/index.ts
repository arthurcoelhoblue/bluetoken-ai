import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!googleApiKey && !anthropicKey) {
      console.error("No AI API key configured");
      return new Response(
        JSON.stringify({ auto_approve: false, confianca: 0, justificativa: "API key não configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const prompt = `Você é um revisor de FAQ corporativa. Analise se a nova FAQ abaixo está alinhada com a base de conhecimento existente da empresa.

## Base de FAQs Aprovadas
${faqContext}

${sectionContext ? `## Base de Conhecimento\n${sectionContext}` : ""}

## Nova FAQ para análise
Pergunta: ${pergunta}
Resposta: ${resposta}

## Instruções
1. Verifique se a pergunta já está coberta (mesmo que com palavras diferentes) por alguma FAQ aprovada
2. Verifique se a resposta está alinhada com as informações da base de conhecimento
3. Se a pergunta E a resposta estão alinhadas com o conhecimento existente, aprove automaticamente
4. Se há divergência, informação nova não coberta, ou potencial erro, NÃO aprove

Retorne APENAS um JSON válido (sem markdown):
{"auto_approve": boolean, "confianca": number (0-100), "justificativa": "string curta"}`;

    let result: any = { auto_approve: false, confianca: 0, justificativa: "Erro na análise" };
    const startMs = Date.now();
    let provider = '';
    let model = '';
    let content = '';

    // Try Claude first (Primary)
    if (anthropicKey) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!resp.ok) throw new Error(`Claude error ${resp.status}`);
        const data = await resp.json();
        content = data.content?.[0]?.text ?? '';
        provider = 'CLAUDE';
        model = 'claude-sonnet-4-20250514';
      } catch (e) {
        console.warn('[faq-auto-review] Claude failed:', e);
      }
    }

    // Fallback to Gemini
    if (!content && googleApiKey) {
      try {
        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
            }),
          }
        );
        if (!geminiResp.ok) throw new Error(`Gemini error ${geminiResp.status}`);
        const geminiData = await geminiResp.json();
        content = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        provider = 'GEMINI';
        model = 'gemini-3-pro-preview';
      } catch (e) {
        console.warn('[faq-auto-review] Gemini fallback failed:', e);
      }
    }

    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error("Could not parse AI response:", content);
      }

      // Log usage
      const latencyMs = Date.now() - startMs;
      await supabase.from("ai_usage_log").insert({
        function_name: "faq-auto-review",
        model: model,
        provider: provider,
        empresa,
        success: true,
        tokens_input: null,
        tokens_output: null,
        latency_ms: latencyMs,
      });
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
