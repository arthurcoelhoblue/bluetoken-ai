import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // ─── MODE: PORTFOLIO ───────────────────────────────
    if (body.mode === 'portfolio') {
      const empresa = body.empresa
      const dias = body.dias ?? 90

      const cutoff = new Date(Date.now() - dias * 86400000).toISOString()

      const [wonsRes, lostsRes, stagesRes] = await Promise.all([
        supabase.from('deals').select('id, titulo, valor, categoria_perda_closer, motivo_perda_closer, owner_id, stage_id, created_at, fechado_em, pipeline_id, profiles:owner_id(nome), pipeline_stages:stage_id(nome)')
          .eq('status', 'GANHO').gte('fechado_em', cutoff).order('fechado_em', { ascending: false }).limit(200),
        supabase.from('deals').select('id, titulo, valor, categoria_perda_closer, categoria_perda_ia, motivo_perda_closer, motivo_perda_ia, owner_id, stage_id, created_at, fechado_em, pipeline_id, profiles:owner_id(nome), pipeline_stages:stage_id(nome)')
          .eq('status', 'PERDIDO').gte('fechado_em', cutoff).order('fechado_em', { ascending: false }).limit(200),
        supabase.from('deal_stage_history').select('deal_id, from_stage_id, to_stage_id, pipeline_stages!deal_stage_history_from_stage_id_fkey(nome)')
          .gte('created_at', cutoff),
      ])

      const wons = wonsRes.data ?? []
      const losts = lostsRes.data ?? []
      const stageHistory = stagesRes.data ?? []

      // Build summary for Claude
      const summary = {
        periodo_dias: dias,
        total_ganhos: wons.length,
        total_perdidos: losts.length,
        win_rate: wons.length + losts.length > 0 ? ((wons.length / (wons.length + losts.length)) * 100).toFixed(1) + '%' : 'N/A',
        valor_ganho: wons.reduce((s: number, d: any) => s + (d.valor || 0), 0),
        valor_perdido: losts.reduce((s: number, d: any) => s + (d.valor || 0), 0),
        vendedores_ganhos: Object.entries(
          wons.reduce((acc: Record<string, { nome: string; count: number; valor: number }>, d: any) => {
            const key = d.owner_id || 'sem_owner'
            if (!acc[key]) acc[key] = { nome: (d.profiles as any)?.nome || 'N/A', count: 0, valor: 0 }
            acc[key].count++
            acc[key].valor += d.valor || 0
            return acc
          }, {})
        ).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.count - a.count).slice(0, 10),
        vendedores_perdidos: Object.entries(
          losts.reduce((acc: Record<string, { nome: string; count: number; valor: number }>, d: any) => {
            const key = d.owner_id || 'sem_owner'
            if (!acc[key]) acc[key] = { nome: (d.profiles as any)?.nome || 'N/A', count: 0, valor: 0 }
            acc[key].count++
            acc[key].valor += d.valor || 0
            return acc
          }, {})
        ).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.count - a.count).slice(0, 10),
        categorias_perda: Object.entries(
          losts.reduce((acc: Record<string, number>, d: any) => {
            const cat = d.categoria_perda_ia || d.categoria_perda_closer || 'NAO_INFORMADA'
            acc[cat] = (acc[cat] || 0) + 1
            return acc
          }, {})
        ).map(([cat, count]) => ({ categoria: cat, count })).sort((a: any, b: any) => b.count - a.count),
        stages_drop_off: Object.entries(
          losts.reduce((acc: Record<string, number>, d: any) => {
            const stage = (d.pipeline_stages as any)?.nome || 'N/A'
            acc[stage] = (acc[stage] || 0) + 1
            return acc
          }, {})
        ).map(([stage, count]) => ({ stage, count })).sort((a: any, b: any) => b.count - a.count),
        ticket_medio_ganho: wons.length > 0 ? Math.round(wons.reduce((s: number, d: any) => s + (d.valor || 0), 0) / wons.length) : 0,
        ticket_medio_perdido: losts.length > 0 ? Math.round(losts.reduce((s: number, d: any) => s + (d.valor || 0), 0) / losts.length) : 0,
      }

      const prompt = `Você é um diretor comercial analisando o portfólio de vendas dos últimos ${dias} dias.

Dados:
${JSON.stringify(summary, null, 2)}

Analise e retorne APENAS um JSON com:
{
  "resumo_executivo": "3-4 frases sobre o estado geral do pipeline",
  "padroes_sucesso": ["padrão 1", "padrão 2", ...],
  "padroes_perda": ["padrão 1", "padrão 2", ...],
  "drop_off_critico": "stage com maior perda e por quê",
  "recomendacoes": ["recomendação 1", "recomendação 2", ...],
  "vendedor_destaque": "nome e motivo",
  "vendedor_atencao": "nome e motivo"
}

Sem markdown, apenas JSON.`

      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        console.error('[WinLoss] Anthropic error:', errText)
        return new Response(JSON.stringify({ error: 'AI analysis failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const aiData = await aiResponse.json()
      const content = aiData.content?.[0]?.text ?? ''

      let analysis: any = {}
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        analysis = JSON.parse(cleaned)
      } catch {
        console.error('[WinLoss] Failed to parse AI response')
        analysis = { resumo_executivo: content }
      }

      // Save to system_settings
      await supabase.from('system_settings').upsert({
        category: 'analytics',
        key: 'win_loss_analysis',
        value: { ...analysis, summary, generated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'category,key' })

      return new Response(JSON.stringify({ success: true, analysis, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── MODE: INDIVIDUAL (existing logic) ─────────────
    const { deal_id } = body
    if (!deal_id) {
      return new Response(JSON.stringify({ error: 'deal_id or mode=portfolio required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('*, contacts:contact_id(id, nome, legacy_lead_id)')
      .eq('id', deal_id)
      .single()

    if (dealErr || !deal) {
      return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const leadId = (deal as any).contacts?.legacy_lead_id
    let messages: any[] = []

    if (leadId) {
      const { data: msgs } = await supabase
        .from('lead_messages')
        .select('direcao, conteudo, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
        .limit(50)
      messages = msgs ?? []
    }

    if (messages.length === 0) {
      await supabase.from('deals').update({
        motivo_perda_ia: 'Sem histórico de conversas para análise',
        categoria_perda_ia: deal.categoria_perda_closer,
        motivo_perda_final: deal.motivo_perda_closer,
        categoria_perda_final: deal.categoria_perda_closer,
        perda_resolvida: true,
      }).eq('id', deal_id)

      return new Response(JSON.stringify({ success: true, auto_resolved: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const transcript = messages.map((m: any) => {
      const dir = m.direcao === 'INBOUND' ? 'LEAD' : 'SDR'
      return `[${dir}]: ${m.conteudo}`
    }).join('\n')

    const prompt = `Você é um analista comercial. Analise o histórico de conversa abaixo entre um SDR/Closer e um lead que resultou em perda do negócio.

Histórico:
${transcript}

Motivo informado pelo vendedor: ${deal.motivo_perda_closer || 'Não informado'}
Categoria informada pelo vendedor: ${deal.categoria_perda_closer || 'Não informada'}

Com base APENAS no conteúdo da conversa, identifique o motivo real da perda. Retorne um JSON com:
- "categoria": uma das seguintes: PRECO, CONCORRENCIA, TIMING, SEM_NECESSIDADE, SEM_RESPOSTA, PRODUTO_INADEQUADO, OUTRO
- "explicacao": uma explicação em 2-3 frases do motivo real

Responda APENAS com o JSON, sem markdown.`

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('Anthropic error:', errText)
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aiData = await aiResponse.json()
    const content = aiData.content?.[0]?.text ?? ''

    let categoria_ia = 'OUTRO'
    let explicacao_ia = content

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      categoria_ia = parsed.categoria || 'OUTRO'
      explicacao_ia = parsed.explicacao || content
    } catch {
      console.error('Failed to parse AI response as JSON, using raw text')
    }

    const match = categoria_ia === deal.categoria_perda_closer
    const updates: Record<string, unknown> = { motivo_perda_ia: explicacao_ia, categoria_perda_ia: categoria_ia }

    if (match) {
      updates.motivo_perda_final = deal.motivo_perda_closer
      updates.categoria_perda_final = deal.categoria_perda_closer
      updates.motivo_perda = deal.motivo_perda_closer
      updates.perda_resolvida = true
    }

    await supabase.from('deals').update(updates).eq('id', deal_id)

    return new Response(JSON.stringify({ success: true, categoria_ia, match, auto_resolved: match }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
