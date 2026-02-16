import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";
import { envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { assertEmpresa } from "../_shared/tenant.ts";

interface CopilotInsight {
  categoria: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  deal_id: string | null;
  lead_id: string | null;
}

interface DealRow {
  id: string;
  titulo: string;
  valor: number | null;
  status: string;
  temperatura: string | null;
  updated_at: string;
  stage_id: string | null;
  pipeline_id: string | null;
  contact_id: string | null;
}

interface ActivityRow { tipo: string; descricao: string | null; created_at: string; deal_id: string }
interface SlaRow { deal_id: string; deal_titulo: string; sla_percentual: number; sla_estourado: boolean; stage_nome: string }
interface TarefaRow { deal_id: string; descricao: string | null; tarefa_prazo: string | null; deal_titulo: string }
interface MetaRow { valor_meta: number; valor_realizado: number }
interface MessageRow { lead_id: string; direcao: string; conteudo: string; created_at: string }

const COACHING_PROMPT = `Você é a Amélia no modo COACHING ATIVO.
Analise os dados completos do vendedor abaixo e gere 3-5 insights acionáveis.

PRIORIZE:
1. Deals parados há mais de 3 dias sem atividade
2. SLA estourados ou próximos de estourar
3. Follow-ups urgentes (lead respondeu mas vendedor não retornou)
4. Riscos de meta (projeção vs meta)
5. Inclua SEMPRE um feedback positivo quando houver melhoria
6. Observe o que o usuário tem feito nos últimos minutos (navegação e ações) e adapte seus insights ao contexto de uso atual

FORMATO DE RESPOSTA: JSON array puro (sem markdown), cada item com:
{
  "categoria": "DEAL_PARADO" | "SLA_RISCO" | "FOLLOW_UP" | "META_RISCO" | "PADRAO_POSITIVO" | "COACHING",
  "titulo": "título curto e direto",
  "descricao": "descrição acionável em 1-2 frases",
  "prioridade": "ALTA" | "MEDIA" | "BAIXA",
  "deal_id": "uuid ou null",
  "lead_id": "uuid ou null"
}

Responda APENAS o JSON array, sem texto extra.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('copilot-proactive');

  try {
    const { empresa } = await req.json();
    assertEmpresa(empresa);
    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: recentInsights } = await supabase
      .from('copilot_insights')
      .select('id')
      .eq('user_id', userId)
      .eq('empresa', empresa)
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);

    if (recentInsights && recentInsights.length > 0) {
      return new Response(JSON.stringify({ insights: [], cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === COLLECT VENDOR SNAPSHOT (filtered by empresa) ===
    // Get pipeline IDs for this empresa to scope deal queries
    const { data: pipelines } = await supabase.from('pipelines').select('id').eq('empresa', empresa);
    const pipelineIds = (pipelines ?? []).map(p => p.id);

    const contextParts: string[] = [];

    // Build deals query scoped to empresa pipelines
    let dealsQuery = supabase.from('deals')
      .select('id, titulo, valor, status, temperatura, updated_at, stage_id, pipeline_id, contact_id')
      .eq('owner_id', userId).eq('status', 'ABERTO').limit(50);
    if (pipelineIds.length > 0) {
      dealsQuery = dealsQuery.in('pipeline_id', pipelineIds);
    }

    const [dealsRes, activitiesRes, slaRes, tarefasRes, metasRes, msgsRes, cadencesRes, activityLogRes] = await Promise.all([
      dealsQuery,
      supabase.from('deal_activities')
        .select('tipo, descricao, created_at, deal_id')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('workbench_sla_alerts')
        .select('deal_id, deal_titulo, sla_percentual, sla_estourado, stage_nome')
        .eq('owner_id', userId).limit(20),
      supabase.from('workbench_tarefas')
        .select('deal_id, descricao, tarefa_prazo, deal_titulo')
        .eq('owner_id', userId).eq('tarefa_concluida', false).limit(20),
      supabase.from('metas_vendedor')
        .select('valor_meta, valor_realizado')
        .eq('user_id', userId).eq('empresa', empresa)
        .eq('ano', new Date().getFullYear()).eq('mes', new Date().getMonth() + 1)
        .maybeSingle(),
      supabase.from('lead_messages')
        .select('lead_id, direcao, conteudo, created_at')
        .eq('empresa', empresa).eq('direcao', 'INBOUND')
        .order('created_at', { ascending: false }).limit(15),
      supabase.from('lead_cadence_runs')
        .select('id, lead_id, status, next_run_at')
        .eq('empresa', empresa).eq('status', 'ATIVA').limit(20),
      supabase.from('user_activity_log')
        .select('action_type, action_detail, created_at')
        .eq('user_id', userId).eq('empresa', empresa)
        .order('created_at', { ascending: false }).limit(20),
    ]);

    if (dealsRes.data && dealsRes.data.length > 0) {
      const dealsSummary = (dealsRes.data as DealRow[]).map((d) => {
        const diasParado = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);
        return `- ${d.titulo}: R$ ${d.valor || 0}, temp=${d.temperatura || '-'}, ${diasParado} dias parado`;
      }).join('\n');
      contextParts.push(`**Deals Abertos (${dealsRes.data.length})**:\n${dealsSummary}`);
    }

    if (activitiesRes.data && activitiesRes.data.length > 0) {
      const acts = (activitiesRes.data as ActivityRow[]).slice(0, 10).map((a) =>
        `- [${a.tipo}] ${a.descricao || '-'} (${new Date(a.created_at).toLocaleDateString('pt-BR')})`
      ).join('\n');
      contextParts.push(`**Últimas Atividades**:\n${acts}`);
    }

    if (slaRes.data && slaRes.data.length > 0) {
      const sla = (slaRes.data as SlaRow[]).map((s) =>
        `- ${s.deal_titulo}: SLA ${s.sla_percentual}% ${s.sla_estourado ? '⚠️ ESTOURADO' : ''} (${s.stage_nome})`
      ).join('\n');
      contextParts.push(`**SLA Alerts**:\n${sla}`);
    }

    if (tarefasRes.data && tarefasRes.data.length > 0) {
      const tarefas = (tarefasRes.data as TarefaRow[]).map((t) =>
        `- ${t.deal_titulo}: ${t.descricao || 'Sem desc'} (prazo: ${t.tarefa_prazo || 'sem prazo'})`
      ).join('\n');
      contextParts.push(`**Tarefas Pendentes (${tarefasRes.data.length})**:\n${tarefas}`);
    }

    if (metasRes.data) {
      const m = metasRes.data as MetaRow;
      const pct = m.valor_meta > 0
        ? Math.round((m.valor_realizado / m.valor_meta) * 100)
        : 0;
      contextParts.push(`**Meta do Mês**: ${pct}% (R$ ${m.valor_realizado} / R$ ${m.valor_meta})`);
    }

    if (msgsRes.data && msgsRes.data.length > 0) {
      const msgs = (msgsRes.data as MessageRow[]).slice(0, 5).map((m) =>
        `- Lead ${m.lead_id?.substring(0, 8)}: "${m.conteudo.substring(0, 80)}" (${new Date(m.created_at).toLocaleString('pt-BR')})`
      ).join('\n');
      contextParts.push(`**Mensagens Inbound Recentes**:\n${msgs}`);
    }

    if (cadencesRes.data && cadencesRes.data.length > 0) {
      contextParts.push(`**Cadências Ativas**: ${cadencesRes.data.length} leads em cadência`);
    }

    if (activityLogRes.data && activityLogRes.data.length > 0) {
      const activities = activityLogRes.data.map((a: { action_type: string; action_detail: Record<string, unknown>; created_at: string }) => {
        const detail = a.action_detail ? JSON.stringify(a.action_detail) : '';
        return `- [${a.action_type}] ${detail} (${new Date(a.created_at).toLocaleString('pt-BR')})`;
      }).join('\n');
      contextParts.push(`**Navegação/Ações Recentes do Usuário**:\n${activities}`);
    }

    const fullContext = contextParts.join('\n\n');

    if (!fullContext) {
      return new Response(JSON.stringify({ insights: [], empty: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await callAI({
      system: COACHING_PROMPT,
      prompt: `Dados do vendedor:\n\n${fullContext}\n\nData/hora atual: ${new Date().toLocaleString('pt-BR')}`,
      functionName: 'copilot-proactive',
      empresa,
      userId,
      maxTokens: 1500,
      supabase,
    });

    if (!aiResult.content) {
      return new Response(JSON.stringify({ insights: [], error: 'AI unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedInsights: CopilotInsight[] = [];
    try {
      const jsonMatch = aiResult.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedInsights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      log.error('Failed to parse AI response', { error: String(parseErr) });
      return new Response(JSON.stringify({ insights: [], parse_error: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('copilot_insights')
      .delete()
      .eq('user_id', userId)
      .eq('empresa', empresa)
      .eq('dispensado', false);

    const insightsToInsert = parsedInsights.slice(0, 5).map((ins) => ({
      user_id: userId,
      empresa,
      categoria: ins.categoria || 'COACHING',
      titulo: ins.titulo || 'Insight',
      descricao: ins.descricao || '',
      prioridade: ins.prioridade || 'MEDIA',
      deal_id: ins.deal_id || null,
      lead_id: ins.lead_id || null,
    }));

    if (insightsToInsert.length > 0) {
      await supabase.from('copilot_insights').insert(insightsToInsert);
    }

    return new Response(JSON.stringify({ insights: insightsToInsert, count: insightsToInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const log = createLogger('copilot-proactive');
    log.error('Erro geral', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
