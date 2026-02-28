import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";
import { envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('copilot-chat');

// ========================================
// PATCH 7 — Copilot Chat (Amélia IA)
// ========================================

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `Você é a Amélia, consultora estratégica de vendas e sucesso do cliente do Amélia CRM (Grupo Blue).
Você é a mesma Amélia que atende leads no WhatsApp — sua voz, personalidade e inteligência são consistentes em todos os canais.

## Personalidade
- Tom profissional mas acolhedor, direto ao ponto, sem ser robótica.
- Usa linguagem natural brasileira (pode usar "olha", "veja", "bora" quando apropriado).
- Nunca usa muletas robóticas como "Perfeito!", "Entendi!", "Ótima pergunta!".
- Demonstra escuta ativa referenciando dados concretos do CRM.
- Quando não sabe, diz claramente: "Não tenho essa informação no contexto atual."

## Diretrizes Operacionais
- Responda SEMPRE em português brasileiro, de forma direta e acionável.
- Use os dados do CRM injetados no contexto para dar respostas personalizadas.
- NÃO invente dados — use apenas o que foi fornecido no contexto.
- Seja concisa: prefira bullets e respostas curtas (máx 3-4 parágrafos).
- Foque em ações práticas que o vendedor/CSM pode tomar AGORA.
- Quando sugerir mensagens, adapte ao perfil DISC e estágio do funil se disponíveis.

## Contexto de Negócio
- Para leads/deals Tokeniza: foque em investimentos tokenizados, rentabilidade e oportunidades de alocação.
- Para leads/deals Blue: foque em IR/tributação cripto, compliance e planejamento tributário.
- Para Customer Success: foque em retenção, saúde do cliente, ações proativas para reduzir churn e identificar oportunidades de expansão (upsell/cross-sell).

## Adaptação por Perfil DISC
- D (Dominância): Seja objetiva, vá direto ao resultado e ROI.
- I (Influência): Seja entusiasta, destaque benefícios sociais e cases de sucesso.
- S (Estabilidade): Seja paciente, transmita segurança e previsibilidade.
- C (Conformidade): Seja detalhista, apresente dados e evidências.

## Restrições
- IMPORTANTE: Responda APENAS com base nos dados fornecidos no contexto. Se um módulo não aparece nos dados, diga "Não tenho acesso a essas informações no seu perfil."
- Mantenha o foco 100% profissional e no contexto de trabalho.
- Nunca compartilhe dados de um cliente com outro.`;

type ContextType = 'LEAD' | 'DEAL' | 'PIPELINE' | 'GERAL' | 'CUSTOMER';

interface CopilotRequest {
  messages: Array<{ role: string; content: string }>;
  contextType: ContextType;
  contextId?: string;
  empresa: string;
}

interface PromptVersion {
  id: string;
  content: string;
  ab_weight: number | null;
}

interface CustomFieldRow {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json?: Record<string, unknown> | null;
  field_id?: string;
  custom_field_definitions: { label: string; value_type?: string } | null;
}

interface RoleRow { role: string }
interface UserAccessAssignment { access_profile_id: string | null }
interface AccessProfileRow { permissions: Record<string, { view: boolean; edit: boolean }> | null }

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, contextType, contextId, empresa } = await req.json() as CopilotRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try loading dynamic prompt from prompt_versions with A/B testing
    let dynamicPrompt = '';
    let selectedPromptVersionId: string | null = null;
    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data: pvList } = await supabase
        .from('prompt_versions')
        .select('id, content, ab_weight')
        .eq('function_name', 'copilot-chat')
        .eq('prompt_key', 'system')
        .eq('is_active', true)
        .gt('ab_weight', 0);

      if (pvList && pvList.length > 0) {
        const totalWeight = pvList.reduce((sum: number, p: PromptVersion) => sum + (p.ab_weight || 100), 0);
        let rand = Math.random() * totalWeight;
        let selected = pvList[0];
        for (const pv of pvList) {
          rand -= (pv.ab_weight || 100);
          if (rand <= 0) { selected = pv; break; }
        }
        dynamicPrompt = selected.content;
        selectedPromptVersionId = selected.id;
        log.info('A/B selected prompt version', { versionId: selected.id, weight: selected.ab_weight });
      }
    } catch (pvErr) { log.warn('prompt_versions lookup failed', { error: String(pvErr) }); }

    const ACTIVE_SYSTEM_PROMPT = dynamicPrompt || SYSTEM_PROMPT;

    // ========================================
    // EXTRAIR USER_ID E PERMISSÕES
    // ========================================
    let userPermissions: Record<string, { view: boolean; edit: boolean }> | null = null;
    let isAdmin = false;
    let userId: string | undefined;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;

      if (userId) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        isAdmin = roles?.some((r: RoleRow) => r.role === 'ADMIN') ?? false;

        if (!isAdmin) {
          const { data: assignment } = await supabase
            .from('user_access_assignments')
            .select('access_profile_id')
            .eq('user_id', userId)
            .maybeSingle();

          if ((assignment as UserAccessAssignment | null)?.access_profile_id) {
            const { data: profile } = await supabase
              .from('access_profiles')
              .select('permissions')
              .eq('id', (assignment as UserAccessAssignment).access_profile_id)
              .single();

            if (profile?.permissions) {
              userPermissions = profile.permissions as Record<string, { view: boolean; edit: boolean }>;
            }
          }
        }
      }
    }

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
          contextBlock = await enrichGeralContext(supabase, empresa, isAdmin, userPermissions, userId);
          break;
        case 'CUSTOMER':
          contextBlock = await enrichCustomerContext(supabase, contextId);
          break;
      }
    } catch (enrichError) {
      log.warn('Erro no enriquecimento', { error: String(enrichError) });
      contextBlock = '⚠️ Não foi possível carregar dados do CRM para este contexto.';
    }

    const systemContent = contextBlock
      ? `${ACTIVE_SYSTEM_PROMPT}\n\n--- DADOS DO CRM ---\n${contextBlock}`
      : ACTIVE_SYSTEM_PROMPT;

    log.info('Chamando IA', { contexto: contextType, msgs: messages.length });

    const aiResult = await callAI({
      system: systemContent,
      prompt: '',
      functionName: 'copilot-chat',
      empresa,
      temperature: 0.4,
      maxTokens: 2048,
      promptVersionId: selectedPromptVersionId || undefined,
      supabase,
      messages,
      model: 'claude-haiku',
    });

    let content = aiResult.content;
    if (!content) {
      content = 'Desculpe, não foi possível processar sua solicitação no momento. Tente novamente em alguns instantes.';
    }

    return new Response(
      JSON.stringify({ content, model: aiResult.model, tokens_input: aiResult.tokensInput, tokens_output: aiResult.tokensOutput, latency_ms: aiResult.latencyMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('Erro geral', { error: String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========================================
// FUNÇÕES DE ENRIQUECIMENTO
// ========================================

function formatCustomField(f: CustomFieldRow): string {
  const label = f.custom_field_definitions?.label || 'Campo';
  const value = f.value_text || f.value_number || f.value_date || f.value_boolean || (f.value_json ? JSON.stringify(f.value_json) : null);
  return `- ${label}: ${value ?? '-'}`;
}

interface IntentRow {
  intent: string;
  intent_confidence: number;
  intent_summary: string | null;
  sentimento: string | null;
  created_at: string;
}

interface MessageRow {
  direcao: string;
  conteudo: string;
  canal: string;
  sender_type: string;
  created_at: string;
}

interface DealActivityRow {
  tipo: string;
  descricao: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  tarefa_concluida: boolean | null;
  tarefa_prazo: string | null;
}

interface IncidentRow {
  titulo: string;
  gravidade: string;
  status: string;
  created_at: string;
}

interface PipelineSummaryRow {
  pipeline_nome: string;
  deals_abertos: number | null;
  valor_aberto: number | null;
  valor_ganho: number | null;
}

interface DealRow {
  id: string;
  titulo: string | null;
  valor: number | null;
  status: string;
  temperatura: string | null;
  updated_at: string;
  stage_id: string | null;
}

interface SlaAlertRow {
  deal_id: string;
  deal_titulo: string;
  sla_percentual: number;
  sla_estourado: boolean;
  stage_nome: string;
  owner_id?: string;
}

interface TarefaRow {
  deal_id: string;
  descricao: string | null;
  tarefa_prazo: string | null;
  deal_titulo: string;
}

interface MetaRow {
  nome_vendedor: string | null;
  valor_meta: number;
  valor_realizado: number;
  user_id: string;
}

async function enrichLeadContext(supabase: SupabaseClient, leadId: string | undefined, empresa: string): Promise<string> {
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
    if (st.framework_data && Object.keys(st.framework_data as Record<string, unknown>).length > 0) {
      parts.push(`**Framework Data**: ${JSON.stringify(st.framework_data)}`);
    }
  }

  if (contactResult.data?.telefone) {
    const { data: linkedContact } = await supabase
      .from('contacts')
      .select('id, organization_id, organizations(nome, website, setor, notas)')
      .eq('telefone', contactResult.data.telefone)
      .eq('empresa', empresa)
      .maybeSingle();

    if (linkedContact?.organizations) {
      const org = linkedContact.organizations as Record<string, string | null>;
      parts.push(`**Organização**: ${org.nome || '-'} | Setor: ${org.setor || '-'} | Site: ${org.website || '-'}`);
    }

    if (linkedContact?.id) {
      const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('value_text, value_number, value_boolean, value_date, custom_field_definitions(label)')
        .eq('entity_id', linkedContact.id)
        .eq('entity_type', 'CONTACT');

      if (cfValues && cfValues.length > 0) {
        const fields = (cfValues as unknown as CustomFieldRow[]).map(formatCustomField).join('\n');
        parts.push(`**Campos Customizados (Contato)**:\n${fields}`);
      }
    }
  }

  if (intentsResult.data && intentsResult.data.length > 0) {
    const intents = (intentsResult.data as IntentRow[]).map((i) =>
      `- [${i.intent}] conf=${i.intent_confidence} | ${i.intent_summary?.substring(0, 80) || '-'}${i.sentimento ? ` | Sent=${i.sentimento}` : ''}`
    ).join('\n');
    parts.push(`**Últimos intents**:\n${intents}`);
  }

  if (msgsResult.data && msgsResult.data.length > 0) {
    const msgs = (msgsResult.data as MessageRow[]).reverse();
    const formatted = msgs.map((m) => {
      const dir = m.direcao === 'INBOUND' ? '← Lead' : `→ ${m.sender_type}`;
      return `[${dir}] ${m.conteudo.substring(0, 200)}`;
    }).join('\n');
    parts.push(`**Últimas ${msgs.length} mensagens**:\n${formatted}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este lead.';
}

async function enrichDealContext(supabase: SupabaseClient, dealId: string | undefined): Promise<string> {
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
    const fields = (customFieldsResult.data as unknown as CustomFieldRow[]).map(formatCustomField).join('\n');
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
      const fields = (contactCfResult.data as unknown as CustomFieldRow[]).map(formatCustomField).join('\n');
      parts.push(`**Campos Customizados (Contato)**:\n${fields}`);
    }

    if (orgResult.data?.organizations) {
      const org = orgResult.data.organizations as Record<string, string | null>;
      parts.push(`**Organização Detalhada**: ${org.nome || '-'} | Setor: ${org.setor || '-'} | Site: ${org.website || '-'}`);
      if (org.notas) parts.push(`**Notas Org**: ${org.notas.substring(0, 200)}`);
    }
  }

  if (activitiesResult.data && activitiesResult.data.length > 0) {
    const acts = (activitiesResult.data as DealActivityRow[]).map((a) =>
      `- [${a.tipo}] ${a.descricao || '-'} (${new Date(a.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n');
    parts.push(`**Últimas atividades**:\n${acts}`);
  }

  // Enrich with call transcriptions
  const callsResult = await supabase
    .from('calls')
    .select('direcao, duracao_segundos, transcription, summary_ia, sentiment, action_items, created_at')
    .eq('deal_id', dealId)
    .not('transcription', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (callsResult.data && callsResult.data.length > 0) {
    const callsSummary = callsResult.data.map((c: { direcao: string; duracao_segundos: number; sentiment: string | null; summary_ia: string | null; transcription: string | null; action_items: string[] | null; created_at: string }) => {
      const mins = Math.round((c.duracao_segundos || 0) / 60);
      const sentiment = c.sentiment ? ` [${c.sentiment}]` : '';
      const summary = c.summary_ia ? `: ${c.summary_ia}` : '';
      const transcription = c.transcription ? `\n  Transcrição: ${c.transcription.substring(0, 500)}` : '';
      const actions = c.action_items && c.action_items.length > 0 ? `\n  Ações pendentes: ${c.action_items.join(', ')}` : '';
      return `- ${c.direcao} (${mins}min)${sentiment}${summary}${transcription}${actions} (${new Date(c.created_at).toLocaleDateString('pt-BR')})`;
    }).join('\n');
    parts.push(`**Chamadas Transcritas**:\n${callsSummary}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este deal.';
}

async function enrichPipelineContext(supabase: SupabaseClient, empresa: string): Promise<string> {
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
    const summary = (pipelinesResult.data as PipelineSummaryRow[]).map((p) =>
      `- ${p.pipeline_nome}: ${p.deals_abertos || 0} deals abertos, R$ ${p.valor_aberto || 0} aberto, R$ ${p.valor_ganho || 0} ganho`
    ).join('\n');
    parts.push(`**Pipelines**:\n${summary}`);
  }

  if (slaResult.data && slaResult.data.length > 0) {
    parts.push(`**SLA Estourados**: ${slaResult.data.length} deals com SLA estourado`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados de pipeline disponíveis.';
}

function canView(perms: Record<string, { view: boolean; edit: boolean }> | null, key: string): boolean {
  if (!perms) return false;
  return perms[key]?.view ?? false;
}

async function enrichGeralContext(
  supabase: SupabaseClient,
  empresa: string,
  isAdmin: boolean,
  userPermissions: Record<string, { view: boolean; edit: boolean }> | null,
  userId?: string,
): Promise<string> {
  const parts: string[] = [];
  const hasPipeline = isAdmin || canView(userPermissions, 'pipeline');
  const hasLeads = isAdmin || canView(userPermissions, 'leads');
  const hasCS = isAdmin || canView(userPermissions, 'cs_dashboard');
  const hasMetas = isAdmin || canView(userPermissions, 'metas');

  const queries: Promise<void>[] = [];

  if (hasPipeline) {
    queries.push((async () => {
      const [pipelinesRes, slaRes] = await Promise.all([
        supabase.from('workbench_pipeline_summary').select('*').eq('pipeline_empresa', empresa).limit(5),
        supabase.from('workbench_sla_alerts').select('*').eq('owner_id', userId || '').limit(20),
      ]);
      if (pipelinesRes.data && pipelinesRes.data.length > 0) {
        const rows = pipelinesRes.data as PipelineSummaryRow[];
        const totalAbertos = rows.reduce((s, p) => s + (p.deals_abertos || 0), 0);
        const totalValorAberto = rows.reduce((s, p) => s + (p.valor_aberto || 0), 0);
        const totalValorGanho = rows.reduce((s, p) => s + (p.valor_ganho || 0), 0);
        const summary = rows.map((p) =>
          `- ${p.pipeline_nome}: ${p.deals_abertos || 0} abertos, R$ ${p.valor_aberto || 0}`
        ).join('\n');
        parts.push(`**Resumo Pipeline**: ${totalAbertos} deals abertos, R$ ${totalValorAberto.toLocaleString('pt-BR')} em pipeline, R$ ${totalValorGanho.toLocaleString('pt-BR')} ganho`);
        parts.push(`**Pipelines**:\n${summary}`);
      }
      if (slaRes.data && slaRes.data.length > 0) {
        const slaDetails = (slaRes.data as SlaAlertRow[]).map((s) =>
          `- ${s.deal_titulo}: SLA ${s.sla_percentual}% ${s.sla_estourado ? '⚠️ ESTOURADO' : ''} (${s.stage_nome})`
        ).join('\n');
        parts.push(`**SLA Alerts (${slaRes.data.length})**:\n${slaDetails}`);
      }
    })());
  }

  if (userId) {
    queries.push((async () => {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, titulo, valor, status, temperatura, updated_at, stage_id')
        .eq('owner_id', userId)
        .eq('status', 'ABERTO')
        .limit(30);

      if (deals && deals.length > 0) {
        const dealsSummary = (deals as DealRow[]).map((d) => {
          const diasParado = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);
          return `- ${d.titulo}: R$ ${d.valor || 0}, temp=${d.temperatura || '-'}, ${diasParado}d parado`;
        }).join('\n');
        parts.push(`**Meus Deals Abertos (${deals.length})**:\n${dealsSummary}`);
      }
    })());
  }

  if (userId) {
    queries.push((async () => {
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('tipo, descricao, created_at, deal_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (activities && activities.length > 0) {
        const acts = (activities as DealActivityRow[]).map((a) =>
          `- [${a.tipo}] ${a.descricao || '-'} (${new Date(a.created_at).toLocaleDateString('pt-BR')})`
        ).join('\n');
        parts.push(`**Minhas Últimas Atividades**:\n${acts}`);
      }
    })());
  }

  queries.push((async () => {
    const { data: cadences } = await supabase
      .from('lead_cadence_runs')
      .select('id, lead_id, status, next_run_at, cadence_id')
      .eq('empresa', empresa)
      .eq('status', 'ATIVA')
      .limit(20);

    if (cadences && cadences.length > 0) {
      parts.push(`**Cadências Ativas**: ${cadences.length} leads em cadência`);
    }
  })());

  queries.push((async () => {
    const { data: msgs } = await supabase
      .from('lead_messages')
      .select('lead_id, direcao, conteudo, canal, created_at')
      .eq('empresa', empresa)
      .order('created_at', { ascending: false })
      .limit(15);

    if (msgs && msgs.length > 0) {
      const formatted = (msgs as MessageRow[]).map((m) => {
        const dir = m.direcao === 'INBOUND' ? '← Lead' : '→ SDR';
        return `[${dir}] ${m.conteudo?.substring(0, 100) || '-'} (${new Date(m.created_at).toLocaleString('pt-BR')})`;
      }).join('\n');
      parts.push(`**Conversas Recentes**:\n${formatted}`);
    }
  })());

  if (userId) {
    queries.push((async () => {
      const { data: tarefas } = await supabase
        .from('workbench_tarefas')
        .select('deal_id, descricao, tarefa_prazo, deal_titulo')
        .eq('owner_id', userId)
        .eq('tarefa_concluida', false)
        .limit(15);

      if (tarefas && tarefas.length > 0) {
        const list = (tarefas as TarefaRow[]).map((t) =>
          `- ${t.deal_titulo}: ${t.descricao || 'Sem desc'} (prazo: ${t.tarefa_prazo || 'sem prazo'})`
        ).join('\n');
        parts.push(`**Tarefas Pendentes (${tarefas.length})**:\n${list}`);
      }
    })());
  }

  if (hasLeads) {
    queries.push((async () => {
      const { count } = await supabase
        .from('lead_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('empresa', empresa)
        .eq('ativo', true);
      if (count != null) {
        parts.push(`**Leads Ativos**: ${count}`);
      }
    })());
  }

  queries.push((async () => {
    const { data: hotLeads } = await supabase
      .from('lead_classifications')
      .select('lead_id, temperatura, persona, score_interno')
      .eq('empresa', empresa)
      .in('temperatura', ['QUENTE', 'MORNO'])
      .order('classificado_em', { ascending: false })
      .limit(10);

    if (hotLeads && hotLeads.length > 0) {
      const list = hotLeads.map((l: { lead_id: string; temperatura: string; persona: string | null; score_interno: number | null }) =>
        `- Lead ${l.lead_id?.substring(0, 8)}: ${l.temperatura}, persona=${l.persona || '-'}, score=${l.score_interno || '-'}`
      ).join('\n');
      parts.push(`**Leads Quentes/Mornos (${hotLeads.length})**:\n${list}`);
    }
  })());

  if (hasCS) {
    queries.push((async () => {
      const { data: csData } = await supabase
        .from('cs_customers')
        .select('health_status, valor_mrr')
        .eq('empresa', empresa)
        .eq('is_active', true);
      if (csData && csData.length > 0) {
        const totalMRR = csData.reduce((s: number, c: { health_status: string; valor_mrr: number | null }) => s + (c.valor_mrr || 0), 0);
        const criticos = csData.filter((c: { health_status: string }) => c.health_status === 'CRITICO' || c.health_status === 'EM_RISCO').length;
        parts.push(`**CS**: ${csData.length} clientes ativos, MRR total R$ ${totalMRR.toLocaleString('pt-BR')}, ${criticos} em risco/crítico`);
      }
    })());
  }

  if (hasMetas) {
    queries.push((async () => {
      const now = new Date();
      const { data: metasData } = await supabase
        .from('metas_vendedor')
        .select('nome_vendedor, valor_meta, valor_realizado, user_id')
        .eq('empresa', empresa)
        .eq('ano', now.getFullYear())
        .eq('mes', now.getMonth() + 1)
        .limit(10);
      if (metasData && metasData.length > 0) {
        const summary = (metasData as MetaRow[]).map((m) => {
          const pct = m.valor_meta > 0 ? Math.round((m.valor_realizado / m.valor_meta) * 100) : 0;
          const isMe = m.user_id === userId ? ' (EU)' : '';
          return `- ${m.nome_vendedor || 'Vendedor'}${isMe}: ${pct}% da meta (R$ ${m.valor_realizado} / R$ ${m.valor_meta})`;
        }).join('\n');
        parts.push(`**Metas do Mês**:\n${summary}`);
      }
    })());
  }

  await Promise.all(queries);

  return parts.length > 0 ? parts.join('\n\n') : 'Contexto geral — sem dados específicos carregados.';
}

async function enrichCustomerContext(supabase: SupabaseClient, customerId: string | undefined): Promise<string> {
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
    supabase
      .from('cs_customers')
      .select('contact_id')
      .eq('id', customerId)
      .single(),
  ]);

  const parts: string[] = [];

  if (customerRes.data) {
    const c = customerRes.data;
    const contact = c.contacts as Record<string, string | null> | null;
    parts.push(`**Cliente CS**: ${contact?.nome || '-'} | Email: ${contact?.email || '-'} | Tel: ${contact?.telefone || '-'}`);
    parts.push(`**Health Score**: ${c.health_score ?? 'N/A'}/100 (${c.health_status || 'N/A'})`);

    if (healthLogRes.data?.dimensoes) {
      const d = healthLogRes.data.dimensoes as Record<string, number | null>;
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
    (incidentsRes.data as IncidentRow[]).forEach((i) => { byGrav[i.gravidade] = (byGrav[i.gravidade] || 0) + 1; });
    const summary = Object.entries(byGrav).map(([g, n]) => `${n} ${g}`).join(', ');
    parts.push(`**Incidências Abertas**: ${incidentsRes.data.length} (${summary})`);

    const list = (incidentsRes.data as IncidentRow[]).slice(0, 5).map((i) =>
      `- [${i.gravidade}] ${i.titulo} (${new Date(i.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n');
    parts.push(list);
  }

  if (dealsRes.data?.contact_id) {
    const { data: deals } = await supabase
      .from('deals')
      .select('titulo, status, valor, created_at')
      .eq('contact_id', dealsRes.data.contact_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (deals && deals.length > 0) {
      const dealsList = (deals as DealRow[]).map((d) =>
        `- ${d.titulo || 'Sem título'} | ${d.status} | R$ ${d.valor || 0}`
      ).join('\n');
      parts.push(`**Deals vinculados**:\n${dealsList}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este cliente CS.';
}
