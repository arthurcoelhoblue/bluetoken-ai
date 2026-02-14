import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 7 — Copilot Chat (Amélia IA)
// Enriquece contexto com dados do CRM e chama Lovable AI Gateway
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é a Amélia, consultora de vendas e sucesso do cliente IA do Amélia CRM (Grupo Blue).
Você ajuda vendedores a fechar mais negócios e CSMs a reter clientes com insights do CRM.

Diretrizes:
- Responda SEMPRE em português brasileiro, de forma direta e acionável.
- Use os dados do CRM injetados no contexto para dar respostas personalizadas.
- NÃO invente dados — use apenas o que foi fornecido no contexto.
- Se não tiver dados suficientes, diga claramente o que falta.
- Seja concisa: prefira bullets e respostas curtas.
- Foque em ações práticas que o vendedor/CSM pode tomar agora.
- Quando sugerir mensagens, adapte ao perfil DISC e estágio do funil se disponíveis.
- Para leads Tokeniza, foque em investimentos tokenizados e rentabilidade.
- Para leads Blue, foque em IR/tributação cripto e compliance.
- Para contexto de Customer Success, foque em retenção, saúde do cliente, ações proativas para reduzir churn e expandir receita.`;

type ContextType = 'LEAD' | 'DEAL' | 'PIPELINE' | 'GERAL' | 'CUSTOMER';

interface CopilotRequest {
  messages: Array<{ role: string; content: string }>;
  contextType: ContextType;
  contextId?: string;
  empresa: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages, contextType, contextId, empresa } = await req.json() as CopilotRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Copilot] LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================
    // ENRIQUECIMENTO DE CONTEXTO
    // ========================================
    let contextBlock = '';

    try {
      switch (contextType) {
        case 'LEAD':
          contextBlock = await enrichLeadContext(supabase, contextId, empresa);
          break;
        case 'DEAL':
          contextBlock = await enrichDealContext(supabase, contextId);
          break;
        case 'PIPELINE':
          contextBlock = await enrichPipelineContext(supabase, empresa);
          break;
        case 'GERAL':
          contextBlock = await enrichGeralContext(supabase, empresa);
          break;
        case 'CUSTOMER':
          contextBlock = await enrichCustomerContext(supabase, contextId);
          break;
      }
    } catch (enrichError) {
      console.warn('[Copilot] Erro no enriquecimento:', enrichError);
      contextBlock = '⚠️ Não foi possível carregar dados do CRM para este contexto.';
    }

    const systemContent = contextBlock
      ? `${SYSTEM_PROMPT}\n\n--- DADOS DO CRM ---\n${contextBlock}`
      : SYSTEM_PROMPT;

    const aiMessages = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    console.log(`[Copilot] Chamando IA — contexto: ${contextType}, msgs: ${messages.length}`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: aiMessages,
        stream: false,
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit atingido. Tente novamente em alguns segundos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Copilot] Erro da IA Gateway:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || 'Sem resposta da IA.';
    const tokensInput = aiData.usage?.prompt_tokens || 0;
    const tokensOutput = aiData.usage?.completion_tokens || 0;
    const model = aiData.model || 'google/gemini-3-pro-preview';
    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ content, model, tokens_input: tokensInput, tokens_output: tokensOutput, latency_ms: latencyMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Copilot] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========================================
// FUNÇÕES DE ENRIQUECIMENTO
// ========================================

async function enrichLeadContext(supabase: any, leadId: string | undefined, empresa: string): Promise<string> {
  if (!leadId) return 'Nenhum lead selecionado.';

  const [classResult, msgsResult, stateResult, contactResult, intentsResult] = await Promise.all([
    supabase
      .from('lead_classifications')
      .select('icp, persona, temperatura, prioridade, score_interno, justificativa')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('classificado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lead_messages')
      .select('direcao, conteudo, canal, sender_type, created_at')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('lead_conversation_state')
      .select('estado_funil, framework_ativo, framework_data, perfil_disc, perfil_investidor, modo, idioma_preferido')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .maybeSingle(),
    supabase
      .from('lead_contacts')
      .select('nome, primeiro_nome, email, telefone, empresa')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .maybeSingle(),
    // BLOCO 5: Intents recentes do lead
    supabase
      .from('lead_message_intents')
      .select('intent, intent_confidence, intent_summary, acao_recomendada, sentimento, created_at')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const parts: string[] = [];

  if (contactResult.data) {
    const c = contactResult.data;
    parts.push(`**Lead**: ${c.nome || c.primeiro_nome || 'Sem nome'} | Tel: ${c.telefone || '-'} | Email: ${c.email || '-'}`);
  }

  if (classResult.data) {
    const cl = classResult.data;
    parts.push(`**Classificação**: ICP=${cl.icp}, Persona=${cl.persona || '-'}, Temp=${cl.temperatura}, Prioridade=${cl.prioridade}, Score=${cl.score_interno || '-'}`);
    if (cl.justificativa) {
      parts.push(`**Justificativa**: ${JSON.stringify(cl.justificativa)}`);
    }
  }

  if (stateResult.data) {
    const st = stateResult.data;
    parts.push(`**Estado Conversa**: Funil=${st.estado_funil}, Framework=${st.framework_ativo}, DISC=${st.perfil_disc || '-'}, Perfil Investidor=${st.perfil_investidor || '-'}, Modo=${st.modo || 'SDR_IA'}, Idioma=${st.idioma_preferido}`);
    if (st.framework_data && Object.keys(st.framework_data).length > 0) {
      parts.push(`**Framework Data**: ${JSON.stringify(st.framework_data)}`);
    }
  }

  // BLOCO 5: Custom fields do contato vinculado ao lead
  if (contactResult.data?.telefone) {
    const { data: linkedContact } = await supabase
      .from('contacts')
      .select('id, organization_id, organizations(nome, website, setor, notas)')
      .eq('telefone', contactResult.data.telefone)
      .eq('empresa', empresa)
      .maybeSingle();

    if (linkedContact?.organizations) {
      const org = linkedContact.organizations;
      parts.push(`**Organização**: ${org.nome || '-'} | Setor: ${org.setor || '-'} | Site: ${org.website || '-'}`);
    }

    // Custom field values do contato
    if (linkedContact?.id) {
      const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('value_text, value_number, value_boolean, value_date, custom_field_definitions(label)')
        .eq('entity_id', linkedContact.id)
        .eq('entity_type', 'CONTACT');

      if (cfValues && cfValues.length > 0) {
        const fields = cfValues.map((f: any) => {
          const label = f.custom_field_definitions?.label || 'Campo';
          const value = f.value_text || f.value_number || f.value_date || f.value_boolean;
          return `- ${label}: ${value ?? '-'}`;
        }).join('\n');
        parts.push(`**Campos Customizados (Contato)**:\n${fields}`);
      }
    }
  }

  // BLOCO 5: Intents recentes
  if (intentsResult.data && intentsResult.data.length > 0) {
    const intents = intentsResult.data.map((i: any) =>
      `- [${i.intent}] conf=${i.intent_confidence} | ${i.intent_summary?.substring(0, 80) || '-'}${i.sentimento ? ` | Sent=${i.sentimento}` : ''}`
    ).join('\n');
    parts.push(`**Últimos intents**:\n${intents}`);
  }

  if (msgsResult.data && msgsResult.data.length > 0) {
    const msgs = msgsResult.data.reverse();
    const formatted = msgs.map((m: any) => {
      const dir = m.direcao === 'INBOUND' ? '← Lead' : `→ ${m.sender_type}`;
      return `[${dir}] ${m.conteudo.substring(0, 200)}`;
    }).join('\n');
    parts.push(`**Últimas ${msgs.length} mensagens**:\n${formatted}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este lead.';
}

async function enrichDealContext(supabase: any, dealId: string | undefined): Promise<string> {
  if (!dealId) return 'Nenhum deal selecionado.';

  const [dealResult, activitiesResult, customFieldsResult] = await Promise.all([
    supabase
      .from('deals_full_detail')
      .select('*')
      .eq('id', dealId)
      .maybeSingle(),
    supabase
      .from('deal_activities')
      .select('tipo, descricao, metadata, created_at, tarefa_concluida, tarefa_prazo')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('custom_field_values')
      .select('value_text, value_number, value_boolean, value_date, value_json, field_id, custom_field_definitions(label, value_type)')
      .eq('entity_id', dealId)
      .eq('entity_type', 'DEAL'),
  ]);

  const parts: string[] = [];
  let contactId: string | null = null;

  if (dealResult.data) {
    const d = dealResult.data;
    contactId = d.contact_id;
    parts.push(`**Deal**: ${d.titulo || '-'}`);
    parts.push(`**Status**: ${d.status} | Valor: R$ ${d.valor || 0} | Temperatura: ${d.temperatura || '-'}`);
    if (d.stage_nome) parts.push(`**Estágio**: ${d.stage_nome} (Pipeline: ${d.pipeline_nome || '-'})`);
    if (d.contact_nome) parts.push(`**Contato**: ${d.contact_nome} | ${d.contact_email || '-'} | ${d.contact_telefone || '-'}`);
    if (d.org_nome) parts.push(`**Organização**: ${d.org_nome}`);
    if (d.motivo_perda) parts.push(`**Motivo Perda**: ${d.motivo_perda}`);
    if (d.notas) parts.push(`**Notas**: ${d.notas.substring(0, 300)}`);
  }

  if (customFieldsResult.data && customFieldsResult.data.length > 0) {
    const fields = customFieldsResult.data.map((f: any) => {
      const label = f.custom_field_definitions?.label || 'Campo';
      const value = f.value_text || f.value_number || f.value_date || f.value_boolean || (f.value_json ? JSON.stringify(f.value_json) : null);
      return `- ${label}: ${value ?? '-'}`;
    }).join('\n');
    parts.push(`**Campos Customizados (Deal)**:\n${fields}`);
  }

  if (contactId) {
    const [contactCfResult, orgResult] = await Promise.all([
      supabase
        .from('custom_field_values')
        .select('value_text, value_number, value_boolean, value_date, value_json, custom_field_definitions(label)')
        .eq('entity_id', contactId)
        .eq('entity_type', 'CONTACT'),
      supabase
        .from('contacts')
        .select('organization_id, organizations(nome, website, setor, notas)')
        .eq('id', contactId)
        .maybeSingle(),
    ]);

    if (contactCfResult.data && contactCfResult.data.length > 0) {
      const fields = contactCfResult.data.map((f: any) => {
        const label = f.custom_field_definitions?.label || 'Campo';
        const value = f.value_text || f.value_number || f.value_date || f.value_boolean || (f.value_json ? JSON.stringify(f.value_json) : null);
        return `- ${label}: ${value ?? '-'}`;
      }).join('\n');
      parts.push(`**Campos Customizados (Contato)**:\n${fields}`);
    }

    if (orgResult.data?.organizations) {
      const org = orgResult.data.organizations;
      parts.push(`**Organização Detalhada**: ${org.nome || '-'} | Setor: ${org.setor || '-'} | Site: ${org.website || '-'}`);
      if (org.notas) parts.push(`**Notas Org**: ${org.notas.substring(0, 200)}`);
    }
  }

  if (activitiesResult.data && activitiesResult.data.length > 0) {
    const acts = activitiesResult.data.map((a: any) =>
      `- [${a.tipo}] ${a.descricao || '-'} (${new Date(a.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n');
    parts.push(`**Últimas atividades**:\n${acts}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este deal.';
}

async function enrichPipelineContext(supabase: any, empresa: string): Promise<string> {
  const [pipelinesResult, slaResult] = await Promise.all([
    supabase
      .from('workbench_pipeline_summary')
      .select('*')
      .eq('pipeline_empresa', empresa)
      .limit(10),
    supabase
      .from('workbench_sla_alerts')
      .select('*')
      .limit(10),
  ]);

  const parts: string[] = [];

  if (pipelinesResult.data && pipelinesResult.data.length > 0) {
    const summary = pipelinesResult.data.map((p: any) =>
      `- ${p.pipeline_nome}: ${p.deals_abertos || 0} deals abertos, R$ ${p.valor_aberto || 0} aberto, R$ ${p.valor_ganho || 0} ganho`
    ).join('\n');
    parts.push(`**Pipelines**:\n${summary}`);
  }

  if (slaResult.data && slaResult.data.length > 0) {
    parts.push(`**SLA Estourados**: ${slaResult.data.length} deals com SLA estourado`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados de pipeline disponíveis.';
}

async function enrichGeralContext(supabase: any, empresa: string): Promise<string> {
  const [pipelinesRes, slaRes] = await Promise.all([
    supabase
      .from('workbench_pipeline_summary')
      .select('*')
      .eq('pipeline_empresa', empresa)
      .limit(5),
    supabase
      .from('workbench_sla_alerts')
      .select('deal_id')
      .limit(50),
  ]);

  const parts: string[] = [];

  if (pipelinesRes.data && pipelinesRes.data.length > 0) {
    const totalAbertos = pipelinesRes.data.reduce((s: number, p: any) => s + (p.deals_abertos || 0), 0);
    const totalValorAberto = pipelinesRes.data.reduce((s: number, p: any) => s + (p.valor_aberto || 0), 0);
    const totalValorGanho = pipelinesRes.data.reduce((s: number, p: any) => s + (p.valor_ganho || 0), 0);

    const summary = pipelinesRes.data.map((p: any) =>
      `- ${p.pipeline_nome}: ${p.deals_abertos || 0} abertos, R$ ${p.valor_aberto || 0}`
    ).join('\n');

    parts.push(`**Resumo Geral**: ${totalAbertos} deals abertos, R$ ${totalValorAberto.toLocaleString('pt-BR')} em pipeline, R$ ${totalValorGanho.toLocaleString('pt-BR')} ganho`);
    parts.push(`**Pipelines**:\n${summary}`);
  }

  if (slaRes.data && slaRes.data.length > 0) {
    parts.push(`**SLA Estourados**: ${slaRes.data.length} deals`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Contexto geral — sem dados específicos carregados.';
}

async function enrichCustomerContext(supabase: any, customerId: string | undefined): Promise<string> {
  if (!customerId) return 'Nenhum cliente CS selecionado.';

  const [customerRes, incidentsRes, healthLogRes, dealsRes] = await Promise.all([
    supabase
      .from('cs_customers')
      .select('*, contacts(nome, email, telefone)')
      .eq('id', customerId)
      .maybeSingle(),
    supabase
      .from('cs_incidents')
      .select('titulo, gravidade, status, created_at')
      .eq('customer_id', customerId)
      .in('status', ['ABERTA', 'EM_ANDAMENTO'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('cs_health_log')
      .select('score, status, dimensoes, motivo_mudanca, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Deals linked to this contact
    supabase
      .from('cs_customers')
      .select('contact_id')
      .eq('id', customerId)
      .single(),
  ]);

  const parts: string[] = [];

  if (customerRes.data) {
    const c = customerRes.data;
    const contact = c.contacts;
    parts.push(`**Cliente CS**: ${contact?.nome || '-'} | Email: ${contact?.email || '-'} | Tel: ${contact?.telefone || '-'}`);
    parts.push(`**Health Score**: ${c.health_score ?? 'N/A'}/100 (${c.health_status || 'N/A'})`);

    if (healthLogRes.data?.dimensoes) {
      const d = healthLogRes.data.dimensoes as any;
      parts.push(`**Dimensões**: NPS=${d.nps ?? '-'}, CSAT=${d.csat ?? '-'}, Engajamento=${d.engajamento ?? '-'}, Financeiro=${d.financeiro ?? '-'}, Tempo=${d.tempo ?? '-'}, Sentimento=${d.sentimento ?? '-'}`);
    }

    if (c.ultimo_nps != null) {
      const cat = c.nps_categoria || '-';
      parts.push(`**Último NPS**: ${c.ultimo_nps} (${cat})`);
    }
    if (c.ultimo_csat != null) {
      parts.push(`**Último CSAT**: ${c.ultimo_csat} | Média: ${c.media_csat ?? '-'}`);
    }

    parts.push(`**MRR**: R$ ${c.valor_mrr?.toLocaleString('pt-BR') || '0'} | Renovação: ${c.proxima_renovacao ? new Date(c.proxima_renovacao).toLocaleDateString('pt-BR') : 'N/A'}`);

    if (c.notas_csm) {
      parts.push(`**Notas CSM**: "${c.notas_csm.substring(0, 300)}"`);
    }
    if (c.tags && c.tags.length > 0) {
      parts.push(`**Tags**: ${c.tags.join(', ')}`);
    }
  }

  if (incidentsRes.data && incidentsRes.data.length > 0) {
    const byGrav: Record<string, number> = {};
    incidentsRes.data.forEach((i: any) => { byGrav[i.gravidade] = (byGrav[i.gravidade] || 0) + 1; });
    const summary = Object.entries(byGrav).map(([g, n]) => `${n} ${g}`).join(', ');
    parts.push(`**Incidências Abertas**: ${incidentsRes.data.length} (${summary})`);

    const list = incidentsRes.data.slice(0, 5).map((i: any) =>
      `- [${i.gravidade}] ${i.titulo} (${new Date(i.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n');
    parts.push(list);
  }

  // Fetch deals for this contact
  if (dealsRes.data?.contact_id) {
    const { data: deals } = await supabase
      .from('deals')
      .select('titulo, status, valor, created_at')
      .eq('contact_id', dealsRes.data.contact_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (deals && deals.length > 0) {
      const dealsList = deals.map((d: any) =>
        `- ${d.titulo || 'Sem título'} | ${d.status} | R$ ${d.valor || 0}`
      ).join('\n');
      parts.push(`**Deals vinculados**:\n${dealsList}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este cliente CS.';
}
