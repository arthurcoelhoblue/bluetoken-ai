import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { deal_id } = await req.json()
    if (!deal_id) {
      return new Response(JSON.stringify({ error: 'deal_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

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
