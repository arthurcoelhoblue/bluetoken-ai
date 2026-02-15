import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch won and lost deals with contact info
    const { data: wonDeals } = await supabase
      .from("deals")
      .select(`
        id, valor, titulo, canal_origem, temperatura,
        contact_id, contacts!inner(
          linkedin_cargo, linkedin_empresa, linkedin_setor,
          canal_origem, tags, tipo, organization_id,
          organizations(nome, setor, porte)
        )
      `)
      .eq("status", "GANHO")
      .order("fechado_em", { ascending: false })
      .limit(200);

    const { data: lostDeals } = await supabase
      .from("deals")
      .select(`
        id, valor, titulo, canal_origem, temperatura, motivo_perda,
        contact_id, contacts!inner(
          linkedin_cargo, linkedin_empresa, linkedin_setor,
          canal_origem, tags, tipo, organization_id,
          organizations(nome, setor, porte)
        )
      `)
      .eq("status", "PERDIDO")
      .order("fechado_em", { ascending: false })
      .limit(200);

    const won = wonDeals || [];
    const lost = lostDeals || [];

    // Analyze patterns
    const patterns = analyzePatterns(won);
    const patternsLost = analyzePatterns(lost);
    
    const analysisData = {
      won: patterns,
      lost: patternsLost,
      total_won: won.length,
      total_lost: lost.length,
      win_rate: won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0,
    };

    // Generate ICP insights using AI (Claude primary, Gemini fallback)
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    let icpNarrative = "";
    
    if ((GOOGLE_API_KEY || ANTHROPIC_API_KEY) && (won.length + lost.length) >= 10) {
      const startMs = Date.now();
      let provider = '';
      let model = '';

      try {
        const prompt = `Analise estes padrões de deals ganhos vs perdidos e gere um ICP (Ideal Customer Profile) em português:

DEALS GANHOS (${won.length}):
- Setores top: ${JSON.stringify(analysisData.won.topSectors)}
- Cargos top: ${JSON.stringify(analysisData.won.topRoles)}
- Canais top: ${JSON.stringify(analysisData.won.topChannels)}
- Ticket médio: R$ ${analysisData.won.avgValue.toFixed(0)}
- Portes: ${JSON.stringify(analysisData.won.topSizes)}

DEALS PERDIDOS (${lost.length}):
- Setores top: ${JSON.stringify(analysisData.lost.topSectors)}
- Motivos perda: ${JSON.stringify(analysisData.lost.topLossReasons)}
- Ticket médio: R$ ${analysisData.lost.avgValue.toFixed(0)}

Responda com JSON: { "icp_summary": "texto 3 frases", "ideal_sectors": [...], "ideal_roles": [...], "ideal_channels": [...], "red_flags": [...], "recommendations": [...] }`;

        // Try Claude first (Primary)
        if (ANTHROPIC_API_KEY) {
          try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                temperature: 0.3,
                messages: [{ role: 'user', content: prompt }],
              }),
            });
            if (!resp.ok) throw new Error(`Claude error ${resp.status}`);
            const data = await resp.json();
            icpNarrative = data.content?.[0]?.text ?? '';
            provider = 'CLAUDE';
            model = 'claude-sonnet-4-20250514';
          } catch (e) {
            console.warn('[icp-learner] Claude failed:', e);
          }
        }

        // Fallback to Gemini
        if (!icpNarrative && GOOGLE_API_KEY) {
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
                }),
              }
            );
            if (res.ok) {
              const data = await res.json();
              icpNarrative = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              provider = 'GEMINI';
              model = 'gemini-3-pro-preview';
            }
          } catch (e) {
            console.warn('[icp-learner] Gemini fallback failed:', e);
          }
        }

        // Fallback 2: OpenAI GPT-4o
        if (!icpNarrative) {
          const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
          if (OPENAI_API_KEY) {
            try {
              const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1000 }),
              });
              if (gptResp.ok) {
                const gptData = await gptResp.json();
                icpNarrative = gptData.choices?.[0]?.message?.content ?? '';
                provider = 'OPENAI';
                model = 'gpt-4o';
              }
            } catch (gptErr) {
              console.error('[icp-learner] OpenAI exception:', gptErr);
            }
          }
        }

        if (icpNarrative) {
          const latencyMs = Date.now() - startMs;
          // Log AI usage
          await supabase.from("ai_usage_log").insert({
            function_name: "icp-learner",
            provider: provider,
            model: model,
            tokens_input: null,
            tokens_output: null,
            success: true,
            latency_ms: latencyMs,
            custo_estimado: 0.001,
          });
        }
      } catch (e) {
        console.error("AI ICP error:", e);
      }
    }

    // Save ICP to system_settings
    if (icpNarrative || won.length > 0) {
      await supabase.from("system_settings").upsert(
        {
          category: "ia",
          key: "icp_profile",
          value: {
            patterns: analysisData,
            narrative: icpNarrative,
            generated_at: new Date().toISOString(),
          },
        },
        { onConflict: "category,key" }
      );
    }

    return new Response(
      JSON.stringify({ success: true, patterns: analysisData, icpNarrative: icpNarrative.slice(0, 500) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ICP learner error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzePatterns(deals: any[]) {
  const sectors: Record<string, number> = {};
  const roles: Record<string, number> = {};
  const channels: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  const lossReasons: Record<string, number> = {};
  let totalValue = 0;

  for (const d of deals) {
    totalValue += d.valor || 0;
    const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
    if (contact?.linkedin_setor) sectors[contact.linkedin_setor] = (sectors[contact.linkedin_setor] || 0) + 1;
    if (contact?.linkedin_cargo) roles[contact.linkedin_cargo] = (roles[contact.linkedin_cargo] || 0) + 1;
    if (d.canal_origem) channels[d.canal_origem] = (channels[d.canal_origem] || 0) + 1;
    const org = contact?.organizations;
    if (org?.porte) sizes[org.porte] = (sizes[org.porte] || 0) + 1;
    if (d.motivo_perda) lossReasons[d.motivo_perda] = (lossReasons[d.motivo_perda] || 0) + 1;
  }

  const topN = (obj: Record<string, number>, n = 5) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, count: v }));

  return {
    topSectors: topN(sectors),
    topRoles: topN(roles),
    topChannels: topN(channels),
    topSizes: topN(sizes),
    topLossReasons: topN(lossReasons),
    avgValue: deals.length > 0 ? totalValue / deals.length : 0,
  };
}
