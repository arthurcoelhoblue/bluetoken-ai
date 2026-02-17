import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-provider.ts";

const log = createLogger('cs-scheduled-jobs');
const corsHeaders = getWebhookCorsHeaders();

const EMPRESAS = ['BLUE', 'TOKENIZA'] as const;

// ── daily-briefing handler ────────────────────────────────────────────
interface CSCustomerRow { id: string; health_score: number | null; health_status: string | null; valor_mrr: number | null; empresa: string | null; contacts: { nome: string } | null; }
interface IncidentRow { titulo: string; gravidade: string; status: string; customer_id: string; }
interface RenewalRow { id: string; proxima_renovacao: string | null; valor_mrr: number | null; health_status: string | null; contacts: { nome: string } | null; }

async function handleDailyBriefing(supabase: ReturnType<typeof createServiceClient>) {
  const { data: csmRows } = await supabase.from('cs_customers').select('csm_id').eq('is_active', true).not('csm_id', 'is', null);
  const csmIds = [...new Set((csmRows ?? []).map((r) => r.csm_id))];
  if (csmIds.length === 0) return { briefings: 0 };

  let briefings = 0;
  for (const csmId of csmIds) {
    const [customersRes, renewalsRes] = await Promise.all([
      supabase.from('cs_customers').select('id, health_score, health_status, valor_mrr, empresa, contacts(nome)').eq('csm_id', csmId).eq('is_active', true),
      supabase.from('cs_customers').select('id, proxima_renovacao, valor_mrr, health_status, contacts(nome)').eq('csm_id', csmId).eq('is_active', true).gte('proxima_renovacao', new Date().toISOString()).lte('proxima_renovacao', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const customers = (customersRes.data ?? []) as unknown as CSCustomerRow[];
    if (customers.length === 0) continue;

    const csmEmpresa = customers[0]?.empresa;
    const customerIds = customers.map((c) => c.id);
    const { data: incidentsData } = await supabase.from('cs_incidents').select('titulo, gravidade, status, customer_id').in('status', ['ABERTA', 'EM_ANDAMENTO']).in('customer_id', customerIds).eq('empresa', csmEmpresa || '').limit(20);
    const incidents = (incidentsData ?? []) as unknown as IncidentRow[];
    const renewals = (renewalsRes.data ?? []) as unknown as RenewalRow[];

    const healthDist: Record<string, number> = {};
    let totalMrr = 0;
    customers.forEach((c) => { healthDist[c.health_status || 'N/A'] = (healthDist[c.health_status || 'N/A'] || 0) + 1; totalMrr += c.valor_mrr || 0; });

    const contextText = `Portfólio: ${customers.length} clientes, MRR total R$ ${totalMrr.toLocaleString('pt-BR')}\nDistribuição Health: ${Object.entries(healthDist).map(([k, v]) => `${k}=${v}`).join(', ')}\nIncidências abertas: ${incidents.length} (${incidents.filter((i) => i.gravidade === 'ALTA' || i.gravidade === 'CRITICA').length} alta/crítica)\nRenovações próximas (30 dias): ${renewals.length} totalizando R$ ${renewals.reduce((s: number, r) => s + (r.valor_mrr || 0), 0).toLocaleString('pt-BR')}\nClientes em risco: ${customers.filter((c) => c.health_status === 'EM_RISCO' || c.health_status === 'CRITICO').map((c) => c.contacts?.nome || 'N/A').join(', ') || 'Nenhum'}`;

    const aiResult = await callAI({
      system: 'Você é a Amélia, assistente de Customer Success. Gere um briefing diário conciso em português brasileiro com: 1) Resumo do portfólio, 2) Alertas urgentes, 3) Top 3 ações recomendadas para hoje. Use bullets, seja direta e acionável. Máximo 300 palavras.',
      prompt: contextText,
      functionName: 'cs-scheduled-jobs/daily-briefing',
      empresa: customers[0]?.empresa || null,
      temperature: 0.4,
      maxTokens: 1000,
      supabase,
    });

    if (aiResult.content) {
      await supabase.from('notifications').insert({ user_id: csmId, empresa: customers[0]?.empresa || 'BLUE', titulo: `📋 Briefing CS — ${new Date().toLocaleDateString('pt-BR')}`, mensagem: aiResult.content.substring(0, 1000), tipo: 'CS_BRIEFING', referencia_tipo: 'CS_BRIEFING', referencia_id: new Date().toISOString().split('T')[0] });
      briefings++;
    }
  }
  return { briefings };
}

// ── nps-auto handler ──────────────────────────────────────────────────
async function handleNpsAuto(supabase: ReturnType<typeof createServiceClient>, params: Record<string, unknown>) {
  const tipo = (params.tipo as string) ?? 'NPS';
  const targetCustomerId = params.customer_id as string | undefined;

  // CSAT mode: single customer
  if (tipo === 'CSAT' && targetCustomerId) {
    const { data: customer } = await supabase.from('cs_customers').select('id, empresa, contacts(nome, primeiro_nome, telefone, email)').eq('id', targetCustomerId).single();
    if (!customer) return { sent: 0, message: 'Customer not found' };

    const contact = (customer as { contacts?: { nome?: string; primeiro_nome?: string; telefone?: string; email?: string } }).contacts;
    if (!contact) return { sent: 0, message: 'No contact' };

    const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 1 a 5, como você avalia o atendimento que recebeu na resolução da sua solicitação? Responda apenas com o número.`;

    await supabase.from('cs_surveys').insert({ customer_id: customer.id, empresa: customer.empresa, tipo: 'CSAT', canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL', pergunta, enviado_em: new Date().toISOString() });

    if (contact.telefone) {
      try {
        await fetch(`${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ telefone: contact.telefone, mensagem: pergunta, empresa: customer.empresa }),
        });
      } catch (e) { log.warn(`Falha WhatsApp para ${customer.id}`, { error: String(e) }); }
    }
    return { sent: 1, tipo: 'CSAT' };
  }

  // NPS mode: batch
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // If specific customer_id provided for NPS
  if (targetCustomerId) {
    const { data: customer } = await supabase.from('cs_customers').select('id, contact_id, empresa, contacts(nome, primeiro_nome, telefone, email)').eq('id', targetCustomerId).single();
    if (!customer) return { sent: 0 };

    const contact = (customer as { contacts?: { nome?: string; primeiro_nome?: string; telefone?: string; email?: string } }).contacts;
    if (!contact) return { sent: 0 };

    const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 0 a 10, o quanto você recomendaria nossos serviços para um amigo ou colega? Responda apenas com o número.`;

    await supabase.from('cs_surveys').insert({ customer_id: customer.id, empresa: customer.empresa, tipo: 'NPS', canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL', pergunta, enviado_em: new Date().toISOString() });

    if (contact.telefone) {
      try {
        await fetch(`${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ telefone: contact.telefone, mensagem: pergunta, empresa: customer.empresa }),
        });
      } catch (e) { log.warn(`Falha WhatsApp para ${customer.id}`, { error: String(e) }); }
    }
    return { sent: 1, tipo: 'NPS' };
  }

  const { data: customers } = await supabase.from('cs_customers').select('id, contact_id, empresa, contacts(nome, primeiro_nome, telefone, email)').eq('is_active', true);
  if (!customers || customers.length === 0) return { sent: 0 };

  const eligibleCustomers: typeof customers = [];
  for (const customer of customers) {
    const { data: recentSurvey } = await supabase.from('cs_surveys').select('id').eq('customer_id', customer.id).eq('tipo', 'NPS').gte('enviado_em', ninetyDaysAgo).limit(1);
    if (!recentSurvey || recentSurvey.length === 0) eligibleCustomers.push(customer);
  }

  let sent = 0;
  for (const customer of eligibleCustomers) {
    const contact = (customer as { contacts?: { nome?: string; primeiro_nome?: string; telefone?: string; email?: string } }).contacts;
    if (!contact) continue;

    const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 0 a 10, o quanto você recomendaria nossos serviços para um amigo ou colega? Responda apenas com o número.`;

    await supabase.from('cs_surveys').insert({ customer_id: customer.id, empresa: customer.empresa, tipo: 'NPS', canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL', pergunta, enviado_em: new Date().toISOString() });

    if (contact.telefone) {
      try {
        await fetch(`${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ telefone: contact.telefone, mensagem: pergunta, empresa: customer.empresa }),
        });
      } catch (e) { log.warn(`Falha ao enviar WhatsApp para ${customer.id}`, { error: String(e) }); }
    }
    sent++;
  }
  return { sent, tipo: 'NPS' };
}

// ── renewal-alerts handler ────────────────────────────────────────────
async function handleRenewalAlerts(supabase: ReturnType<typeof createServiceClient>) {
  const now = new Date();
  const milestones = [60, 30, 15];
  let notified = 0;

  for (const days of milestones) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const dateStr = targetDate.toISOString().split('T')[0];

    const { data: customers } = await supabase.from('cs_customers')
      .select('id, csm_id, empresa, valor_mrr, health_score, health_status, contacts(nome)')
      .eq('is_active', true)
      .gte('proxima_renovacao', `${dateStr}T00:00:00`)
      .lt('proxima_renovacao', `${dateStr}T23:59:59`);

    if (!customers || customers.length === 0) continue;

    for (const customer of customers) {
      if (!customer.csm_id) continue;
      const { data: existing } = await supabase.from('notifications').select('id').eq('referencia_id', customer.id).eq('tipo', 'CS_RENEWAL_ALERT').like('mensagem', `%${days} dias%`).limit(1);
      if (existing && existing.length > 0) continue;

      const urgente = customer.health_status === 'EM_RISCO' || customer.health_status === 'CRITICO';
      const contactName = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.nome as string || 'Cliente' : 'Cliente';

      await supabase.from('notifications').insert({
        user_id: customer.csm_id, empresa: customer.empresa,
        titulo: `${urgente ? '🚨' : '📅'} Renovação em ${days} dias: ${contactName}`,
        mensagem: `Renovação em ${days} dias. MRR: R$ ${customer.valor_mrr || 0}. Health: ${customer.health_score || 'N/A'}/100 (${customer.health_status || 'N/A'}).`,
        tipo: 'CS_RENEWAL_ALERT', referencia_tipo: 'CS_CUSTOMER', referencia_id: customer.id,
      });
      notified++;
    }
  }
  return { notified, milestones };
}

// ── trending-topics handler ───────────────────────────────────────────
async function handleTrendingTopics(supabase: ReturnType<typeof createServiceClient>) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const allResults: Record<string, unknown> = {};

  for (const empresa of EMPRESAS) {
    const { data: surveys, error } = await supabase.from('cs_surveys').select('tipo, nota, texto_resposta, empresa')
      .eq('empresa', empresa)
      .not('texto_resposta', 'is', null)
      .gte('respondido_em', ninetyDaysAgo)
      .limit(200);
    if (error) throw error;

    if (!surveys || surveys.length === 0) {
      allResults[empresa] = { topics: [], wordCloud: [], message: 'No survey responses found' };
      continue;
    }

    const responsesText = surveys.map((s) => `[${s.tipo}] Nota: ${s.nota ?? 'N/A'} — "${s.texto_resposta}"`).join('\n');

    const aiResult = await callAI({
      system: 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português. Retorne APENAS JSON válido sem markdown.',
      prompt: `Analise estas ${surveys.length} respostas:\n\n${responsesText}\n\nRetorne JSON: {"topics":[{"tema":"string","frequencia":number,"sentimento":"positivo|neutro|negativo","resumo":"string"}],"wordCloud":[{"palavra":"string","contagem":number}]}\n\nTop 5 temas e 20 palavras-chave.`,
      functionName: 'cs-scheduled-jobs/trending-topics',
      empresa,
      supabase,
    });

    let result = { topics: [], wordCloud: [] };
    if (aiResult.content) {
      try { result = JSON.parse(aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { /* ignore */ }
    }

    await supabase.from('system_settings').upsert(
      { key: `cs.trending_topics.${empresa}`, value: { ...result, updated_at: new Date().toISOString(), total_responses: surveys.length } },
      { onConflict: 'key' }
    );

    allResults[empresa] = result;
  }
  return allResults;
}

// ── Main router ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body as { action?: string; [key: string]: unknown };

    if (!action) {
      return new Response(JSON.stringify({ error: 'action é obrigatório. Valores: daily-briefing, nps-auto, renewal-alerts, trending-topics' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result: unknown;

    switch (action) {
      case 'daily-briefing':
        result = await handleDailyBriefing(supabase);
        break;
      case 'nps-auto':
        result = await handleNpsAuto(supabase, params);
        break;
      case 'renewal-alerts':
        result = await handleRenewalAlerts(supabase);
        break;
      case 'trending-topics':
        result = await handleTrendingTopics(supabase);
        break;
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
