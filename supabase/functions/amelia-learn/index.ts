import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callAI(googleApiKey: string | undefined, anthropicKey: string | undefined, prompt: string, options: { system?: string; temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const { system, temperature = 0.3, maxTokens = 1500 } = options;
  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  // Try Claude first (Primary)
  if (anthropicKey) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] }),
      });
      if (!resp.ok) throw new Error(`Claude ${resp.status}`);
      const data = await resp.json();
      const text = data.content?.[0]?.text ?? '';
      if (text) return text;
    } catch (e) { console.warn('[amelia-learn] Claude failed:', e); }
  }

  // Fallback to Gemini
  if (googleApiKey) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text;
    } catch (e) {
      console.warn('[amelia-learn] Gemini failed:', e);
    }
  }

  // Fallback 2: OpenAI GPT-4o via API direta
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (OPENAI_API_KEY) {
    console.log('[amelia-learn] Trying OpenAI GPT-4o fallback...');
    try {
      const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (gptResp.ok) {
        const gptData = await gptResp.json();
        const text = gptData.choices?.[0]?.message?.content ?? '';
        if (text) {
          console.log('[amelia-learn] OpenAI GPT-4o fallback succeeded');
          return text;
        }
      } else {
        console.error('[amelia-learn] OpenAI error:', gptResp.status);
      }
    } catch (gptErr) {
      console.error('[amelia-learn] OpenAI exception:', gptErr);
    }
  }

  throw new Error('No AI API key available');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { empresa, periodo_horas = 72 } = await req.json();
    if (!empresa) {
      return new Response(JSON.stringify({ error: 'empresa is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, serviceKey);

    const since = new Date(Date.now() - periodo_horas * 3600_000).toISOString();
    const learnings: any[] = [];

    // ========================================
    // ANÁLISE 1: Padrões de Takeover
    // ========================================
    const { data: takeovers } = await supabase
      .from('conversation_takeover_log')
      .select('*')
      .eq('empresa', empresa)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (takeovers && takeovers.length >= 3) {
      const byMotivo: Record<string, number> = {};
      for (const t of takeovers) {
        const motivo = t.motivo || 'SEM_MOTIVO';
        byMotivo[motivo] = (byMotivo[motivo] || 0) + 1;
      }
      for (const [motivo, count] of Object.entries(byMotivo)) {
        if (count >= 3) {
          const hash = `takeover_${motivo}_${empresa}`;
          const existing = await checkDuplicate(supabase, hash);
          if (!existing) {
            learnings.push({
              empresa, tipo: 'PADRAO_TAKEOVER', categoria: 'conversacao',
              titulo: `Takeover recorrente: ${motivo}`,
              descricao: `Vendedores assumiram conversas ${count}x pelo motivo "${motivo}" nas últimas ${periodo_horas}h. Considerar automatizar este cenário.`,
              dados: { motivo, count, periodo_horas },
              confianca: Math.min(0.95, 0.5 + count * 0.1),
              hash_titulo: hash,
            });
          }
        }
      }
    }

    // ========================================
    // ANÁLISE 2: Padrões de Perda de Deals
    // ========================================
    const { data: perdas } = await supabase
      .from('deal_activities')
      .select('deal_id, tipo, descricao, metadata, created_at')
      .eq('tipo', 'PERDA')
      .gte('created_at', since)
      .limit(200);

    if (perdas && perdas.length >= 3) {
      const byCategoria: Record<string, number> = {};
      for (const p of perdas) {
        const cat = (p.metadata as any)?.categoria || 'SEM_CATEGORIA';
        byCategoria[cat] = (byCategoria[cat] || 0) + 1;
      }
      const total = perdas.length;
      for (const [cat, count] of Object.entries(byCategoria)) {
        const pct = count / total;
        if (pct >= 0.4 && count >= 3) {
          const hash = `perda_${cat}_${empresa}`;
          const existing = await checkDuplicate(supabase, hash);
          if (!existing) {
            learnings.push({
              empresa, tipo: 'PADRAO_PERDA', categoria: 'pipeline',
              titulo: `${Math.round(pct * 100)}% das perdas por "${cat}"`,
              descricao: `${count} de ${total} deals perdidos recentemente tiveram a categoria "${cat}". Revisar abordagem comercial.`,
              dados: { categoria: cat, count, total, pct: Math.round(pct * 100) },
              confianca: Math.min(0.95, pct + 0.1),
              hash_titulo: hash,
            });
          }
        }
      }
    }

    // ========================================
    // ANÁLISE 3: Correções de Classificação
    // ========================================
    const { data: corrections } = await supabase
      .from('lead_classifications' as any)
      .select('*')
      .eq('empresa', empresa)
      .gte('created_at', since)
      .limit(200);

    if (corrections && corrections.length >= 5) {
      let tempCorrections = 0;
      for (const c of corrections) {
        if ((c as any).temperatura_anterior && (c as any).temperatura !== (c as any).temperatura_anterior) {
          tempCorrections++;
        }
      }
      if (tempCorrections >= 3) {
        const hash = `correcao_temp_${empresa}`;
        const existing = await checkDuplicate(supabase, hash);
        if (!existing) {
          learnings.push({
            empresa, tipo: 'CORRECAO_CLASSIFICACAO', categoria: 'classificacao',
            titulo: `${tempCorrections} correções de temperatura recentes`,
            descricao: `Humanos corrigiram a temperatura da IA ${tempCorrections}x. Revisar critérios de classificação automática.`,
            dados: { tempCorrections, total: corrections.length },
            confianca: Math.min(0.9, 0.5 + tempCorrections * 0.05),
            hash_titulo: hash,
          });
        }
      }
    }

    // ========================================
    // ANÁLISE 4: Deals sem atividade
    // ========================================
    const twoDaysAgo = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: inactiveDeals } = await supabase
      .from('deals')
      .select('id, titulo, owner_id, updated_at, contacts!inner(nome)')
      .eq('status', 'ABERTO')
      .lt('updated_at', twoDaysAgo)
      .limit(20);

    if (inactiveDeals) {
      for (const deal of inactiveDeals) {
        const hash = `inativo_${deal.id}`;
        const existing = await checkDuplicate(supabase, hash);
        if (!existing) {
          learnings.push({
            empresa, tipo: 'ALERTA_CRITICO', categoria: 'pipeline',
            titulo: `Deal "${deal.titulo}" sem atividade há 48h+`,
            descricao: `O deal de ${(deal.contacts as any)?.nome} está sem atividade. Risco de perda por inação.`,
            dados: { deal_id: deal.id, owner_id: deal.owner_id },
            confianca: 0.85,
            hash_titulo: hash,
          });

          if (deal.owner_id) {
            await supabase.from('notifications').insert({
              user_id: deal.owner_id, empresa,
              tipo: 'AMELIA_ALERTA',
              titulo: `Deal "${deal.titulo}" sem atividade`,
              mensagem: `Há mais de 48h sem atividade. Ação recomendada para evitar perda.`,
              link: `/pipeline`, entity_id: deal.id, entity_type: 'deal',
            });
          }
        }
      }
    }

    // ========================================
    // ANÁLISE 5: Leads quentes sem followup
    // ========================================
    const fourHoursAgo = new Date(Date.now() - 4 * 3600_000).toISOString();
    const { data: hotIntents } = await supabase
      .from('lead_message_intents')
      .select('lead_id, empresa, created_at')
      .eq('empresa', empresa)
      .eq('intent', 'INTERESSE_COMPRA')
      .lt('created_at', fourHoursAgo)
      .gte('created_at', since)
      .limit(20);

    if (hotIntents) {
      for (const intent of hotIntents) {
        const { data: followup } = await supabase
          .from('lead_messages')
          .select('id')
          .eq('lead_id', intent.lead_id)
          .eq('direcao', 'OUTBOUND')
          .gt('created_at', intent.created_at)
          .limit(1);

        if (!followup || followup.length === 0) {
          const hash = `hot_nofollowup_${intent.lead_id}`;
          const existing = await checkDuplicate(supabase, hash);
          if (!existing) {
            learnings.push({
              empresa, tipo: 'ALERTA_CRITICO', categoria: 'conversacao',
              titulo: `Lead quente sem followup há 4h+`,
              descricao: `Lead demonstrou INTERESSE_COMPRA mas não recebeu followup. Ação imediata recomendada.`,
              dados: { lead_id: intent.lead_id },
              confianca: 0.9,
              hash_titulo: hash,
            });
          }
        }
      }
    }

    // ========================================
    // ANÁLISE 6: Mineração de Sequências (Perda)
    // ========================================
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: lostDeals } = await supabase
      .from('deals')
      .select('id, contact_id, titulo')
      .eq('status', 'PERDIDO')
      .gte('updated_at', ninetyDaysAgo)
      .limit(30);

    if (lostDeals && lostDeals.length >= 5) {
      const timelines: { dealId: string; titulo: string; events: string[] }[] = [];

      for (const deal of lostDeals.slice(0, 20)) {
        const { data: activities } = await supabase
          .from('deal_activities')
          .select('tipo, created_at')
          .eq('deal_id', deal.id)
          .order('created_at', { ascending: true })
          .limit(20);

        if (activities && activities.length >= 2) {
          timelines.push({ dealId: deal.id, titulo: deal.titulo, events: activities.map(a => a.tipo) });
        }
      }

      if (timelines.length >= 5 && (GOOGLE_API_KEY || ANTHROPIC_API_KEY)) {
        const aiStartTime = Date.now();
        try {
          const prompt = `Analise estas timelines de deals que foram PERDIDOS e identifique subsequências de 2-4 eventos que aparecem em 50%+ dos casos.

Timelines:
${timelines.map((t, i) => `${i + 1}. ${t.events.join(' → ')}`).join('\n')}

Retorne JSON: {"sequences": [{"events": ["string"], "match_pct": number, "window_days": number, "description": "string em PT-BR"}]}`;

          const content = await callAI(GOOGLE_API_KEY, ANTHROPIC_API_KEY, prompt, {
            system: 'Você é um analista de dados que identifica padrões em sequências de eventos de CRM. Retorne APENAS JSON válido sem markdown.',
            temperature: 0.3, maxTokens: 1500,
          });

          // Telemetry
          try { await supabase.from('ai_usage_log').insert({ function_name: 'amelia-learn', provider: ANTHROPIC_API_KEY ? 'claude' : 'gemini', model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-20250514' : 'gemini-3-pro-preview', latency_ms: Date.now() - aiStartTime, success: true, empresa }); } catch { /* ignore */ }

          let args: any = { sequences: [] };
          try {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            args = JSON.parse(cleaned);
          } catch { /* ignore */ }

          for (const seq of (args.sequences || [])) {
            if (seq.match_pct >= 50 && seq.events.length >= 2) {
              const hash = `seq_perda_${seq.events.join('_')}_${empresa}`;
              const existing = await checkDuplicate(supabase, hash);
              if (!existing) {
                learnings.push({
                  empresa, tipo: 'SEQUENCIA_PERDA', categoria: 'sequencia',
                  titulo: `Sequência de perda: ${seq.events.join(' → ')}`,
                  descricao: seq.description,
                  dados: { timelines_analyzed: timelines.length },
                  confianca: Math.min(0.95, seq.match_pct / 100),
                  sequencia_eventos: seq.events,
                  sequencia_match_pct: seq.match_pct,
                  sequencia_janela_dias: seq.window_days,
                  hash_titulo: hash,
                });
              }
            }
          }
        } catch (aiErr) {
          console.error('[amelia-learn] AI sequence analysis error:', aiErr);
        }
      }
    }

    // ========================================
    // ANÁLISE 6B: Mineração de Sequências (Churn)
    // ========================================
    const { data: churnLeads } = await supabase
      .from('contacts')
      .select('legacy_lead_id')
      .eq('empresa', empresa)
      .eq('opt_out', true)
      .gte('opt_out_em', ninetyDaysAgo)
      .limit(20);

    if (churnLeads && churnLeads.length >= 3) {
      const churnTimelines: { leadId: string; intents: string[] }[] = [];

      for (const lead of churnLeads) {
        if (!lead.legacy_lead_id) continue;
        const { data: intents } = await supabase
          .from('lead_message_intents')
          .select('intent, created_at')
          .eq('lead_id', lead.legacy_lead_id)
          .order('created_at', { ascending: true })
          .limit(15);

        if (intents && intents.length >= 2) {
          churnTimelines.push({ leadId: lead.legacy_lead_id, intents: intents.map(i => i.intent) });
        }
      }

      if (churnTimelines.length >= 3 && (GOOGLE_API_KEY || ANTHROPIC_API_KEY)) {
        const aiStartTime2 = Date.now();
        try {
          const prompt = `Analise estas timelines de leads que fizeram OPT-OUT (cancelamento). Identifique subsequências de 2-4 intents que precedem o cancelamento em 50%+ dos casos.

Timelines de intents:
${churnTimelines.map((t, i) => `${i + 1}. ${t.intents.join(' → ')}`).join('\n')}

Retorne APENAS JSON: {"sequences": [{"events": ["string"], "match_pct": number, "window_days": number, "description": "string em PT-BR"}]}`;

          const content = await callAI(GOOGLE_API_KEY, ANTHROPIC_API_KEY, prompt, {
            system: 'Analista de padrões de churn em CRM. Retorne APENAS JSON válido sem markdown.',
            temperature: 0.3, maxTokens: 1500,
          });

          // Telemetry
          try { await supabase.from('ai_usage_log').insert({ function_name: 'amelia-learn', provider: ANTHROPIC_API_KEY ? 'claude' : 'gemini', model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-20250514' : 'gemini-3-pro-preview', latency_ms: Date.now() - aiStartTime2, success: true, empresa }); } catch { /* ignore */ }

          let args: any = { sequences: [] };
          try {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            args = JSON.parse(cleaned);
          } catch { /* ignore */ }

          for (const seq of (args.sequences || [])) {
            if (seq.match_pct >= 50 && seq.events.length >= 2) {
              const hash = `seq_churn_${seq.events.join('_')}_${empresa}`;
              const existing = await checkDuplicate(supabase, hash);
              if (!existing) {
                learnings.push({
                  empresa, tipo: 'SEQUENCIA_CHURN', categoria: 'sequencia',
                  titulo: `Sequência de churn: ${seq.events.join(' → ')}`,
                  descricao: seq.description,
                  dados: { timelines_analyzed: churnTimelines.length },
                  confianca: Math.min(0.95, seq.match_pct / 100),
                  sequencia_eventos: seq.events,
                  sequencia_match_pct: seq.match_pct,
                  sequencia_janela_dias: seq.window_days,
                  hash_titulo: hash,
                });
              }
            }
          }
        } catch (aiErr) {
          console.error('[amelia-learn] AI churn sequence error:', aiErr);
        }
      }
    }

    // ========================================
    // SAVE ALL LEARNINGS
    // ========================================
    if (learnings.length > 0) {
      const { error: insertError } = await supabase
        .from('amelia_learnings')
        .insert(learnings.slice(0, 10));

      if (insertError) {
        console.error('[amelia-learn] Insert error:', insertError);
      }
    }

    console.log(`[amelia-learn] ${empresa}: ${learnings.length} learnings generated`);

    return new Response(
      JSON.stringify({ success: true, empresa, learnings_count: learnings.length, types: learnings.map(l => l.tipo) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[amelia-learn] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkDuplicate(supabase: any, hash: string): Promise<boolean> {
  const { data } = await supabase
    .from('amelia_learnings')
    .select('id')
    .eq('hash_titulo', hash)
    .limit(1)
    .maybeSingle();
  return !!data;
}
