import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders, getWebhookCorsHeaders } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { assertEmpresa, EMPRESAS } from "../_shared/tenant.ts";

const log = createLogger('cs-ai-actions');

// ── suggest-note handler ──────────────────────────────────────────────
async function handleSuggestNote(supabase: ReturnType<typeof createServiceClient>, params: Record<string, unknown>, corsHeaders: Record<string, string>) {
  const { customer_id } = params;
  if (!customer_id) return new Response(JSON.stringify({ error: 'customer_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const [customerRes, surveysRes, incidentsRes, healthRes] = await Promise.all([
    supabase.from('cs_customers').select('id, empresa, notas_csm, health_score, health_status, valor_mrr, risco_churn_pct, contact:contact_id(nome, email)').eq('id', customer_id).single(),
    supabase.from('cs_surveys').select('tipo, nota, feedback_texto, enviado_em').eq('customer_id', customer_id).order('enviado_em', { ascending: false }).limit(5),
    supabase.from('cs_incidents').select('titulo, descricao, gravidade, status, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(5),
    supabase.from('cs_health_log').select('score, status, motivo_mudanca, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(3),
  ]);

  const customer = customerRes.data;
  if (!customer) return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  assertEmpresa(customer.empresa);

  const surveys = surveysRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const healthLog = healthRes.data ?? [];

  const contextParts: string[] = [];
  contextParts.push(`Cliente: ${(customer.contact as Record<string, unknown>)?.nome || 'N/A'}, Health: ${customer.health_score} (${customer.health_status}), MRR: R$${customer.valor_mrr}, Churn: ${customer.risco_churn_pct}%`);
  if (customer.notas_csm) contextParts.push(`Notas atuais do CSM: ${customer.notas_csm}`);
  if (surveys.length > 0) contextParts.push('Pesquisas recentes: ' + surveys.map((s: Record<string, unknown>) => `${s.tipo} nota=${s.nota ?? 'pendente'} ${s.feedback_texto ? `"${(s.feedback_texto as string).slice(0, 100)}"` : ''}`).join(' | '));
  if (incidents.length > 0) contextParts.push('Incidências recentes: ' + incidents.map((i: Record<string, unknown>) => `[${i.gravidade}/${i.status}] ${i.titulo}`).join(' | '));
  if (healthLog.length > 0) contextParts.push('Health log: ' + healthLog.map((h: Record<string, unknown>) => `Score ${h.score} (${h.status}) - ${h.motivo_mudanca || 'recalculado'}`).join(' | '));

  const prompt = `Baseado nos dados do cliente abaixo, sugira uma nota de acompanhamento em 2-3 frases que o CSM pode registrar. A nota deve ser prática, mencionar dados concretos e sugerir próximos passos.\n\n${contextParts.join('\n')}\n\nResponda APENAS com a sugestão de nota, sem prefixos ou explicações.`;

  const aiResult = await callAI({
    system: 'Você é um assistente de Customer Success que gera notas de acompanhamento práticas e acionáveis.',
    prompt,
    functionName: 'cs-ai-actions/suggest-note',
    empresa: customer.empresa,
    temperature: 0.3,
    maxTokens: 300,
    supabase,
  });

  return new Response(JSON.stringify({ sugestao: aiResult.content || 'Não foi possível gerar sugestão no momento.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── churn-predict handler ─────────────────────────────────────────────
async function handleChurnPredict(supabase: ReturnType<typeof createServiceClient>, _params: Record<string, unknown>, corsHeaders: Record<string, string>) {
  // forEachEmpresa: buscar customers isolados por tenant
  const allCustomers: Array<Record<string, unknown>> = [];
  for (const empresa of EMPRESAS) {
    const { data, error } = await supabase
      .from('cs_customers')
      .select('id, health_score, health_status, ultimo_nps, ultimo_contato_em, csm_id, empresa, valor_mrr, risco_churn_pct')
      .eq('is_active', true)
      .eq('empresa', empresa);
    if (error) throw error;
    if (data) allCustomers.push(...data);
  }

  const customers = allCustomers;
  if (customers.length === 0) return new Response(JSON.stringify({ updated: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let updated = 0, alertsSent = 0;

  for (const customer of customers) {
    let riskScore = 0;

    const { data: healthLogs } = await supabase.from('cs_health_log').select('score, status').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(3);

    if (healthLogs && healthLogs.length >= 2) {
      const trend = healthLogs[0].score - healthLogs[healthLogs.length - 1].score;
      if (trend < -20) riskScore += 30;
      else if (trend < -10) riskScore += 20;
      else if (trend < 0) riskScore += 10;
    } else {
      const statusRisk: Record<string, number> = { 'CRITICO': 25, 'EM_RISCO': 18, 'ATENCAO': 8, 'SAUDAVEL': 2 };
      riskScore += statusRisk[customer.health_status ?? 'ATENCAO'] ?? 10;
    }

    if (customer.ultimo_nps != null) {
      if (customer.ultimo_nps <= 6) riskScore += 20;
      else if (customer.ultimo_nps <= 7) riskScore += 12;
      else if (customer.ultimo_nps <= 8) riskScore += 5;
    } else riskScore += 10;

    if (customer.ultimo_contato_em) {
      const days = Math.floor((Date.now() - new Date(customer.ultimo_contato_em).getTime()) / (1000 * 60 * 60 * 24));
      if (days > 60) riskScore += 25;
      else if (days > 30) riskScore += 18;
      else if (days > 14) riskScore += 8;
    } else riskScore += 15;

    const { count: openIncidents } = await supabase.from('cs_incidents').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id).in('status', ['ABERTA', 'EM_ANDAMENTO']);
    const incCount = openIncidents ?? 0;
    if (incCount >= 3) riskScore += 25;
    else if (incCount >= 2) riskScore += 18;
    else if (incCount >= 1) riskScore += 10;

    riskScore = Math.min(100, Math.max(0, riskScore));

    await supabase.from('cs_customers').update({ risco_churn_pct: riskScore, updated_at: new Date().toISOString() }).eq('id', customer.id);
    updated++;

    if (riskScore > 70 && customer.csm_id && (customer.risco_churn_pct ?? 0) <= 70) {
      await supabase.from('notifications').insert({
        user_id: customer.csm_id, empresa: customer.empresa, tipo: 'CS_CHURN_RISK',
        titulo: '⚠️ Cliente com alto risco de churn',
        mensagem: `Cliente com risco de churn de ${riskScore}%. Health score: ${customer.health_score ?? 'N/A'}`,
        referencia_tipo: 'cs_customer', referencia_id: customer.id,
      });
      alertsSent++;
    }
  }

  return new Response(JSON.stringify({ updated, alertsSent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── detect-incidents handler ──────────────────────────────────────────
async function handleDetectIncidents(supabase: ReturnType<typeof createServiceClient>, _params: Record<string, unknown>, corsHeaders: Record<string, string>) {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  let detected = 0;

  // forEachEmpresa: buscar customers isolados por tenant
  const allCustomers: Array<Record<string, unknown>> = [];
  for (const empresa of EMPRESAS) {
    const { data } = await supabase
      .from('cs_customers').select('id, contact_id, csm_id, empresa, contacts(nome, legacy_lead_id)')
      .eq('is_active', true).eq('empresa', empresa);
    if (data) allCustomers.push(...data);
  }
  const customers = allCustomers;

  if (customers.length === 0) return new Response(JSON.stringify({ detected: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  for (const customer of customers) {
    const leadId = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.legacy_lead_id as string : null;
    if (!leadId) continue;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentIncidents } = await supabase.from('cs_incidents').select('id').eq('customer_id', customer.id).eq('detectado_por_ia', true).gte('created_at', twentyFourHoursAgo).limit(1);
    if (recentIncidents && recentIncidents.length > 0) continue;

    const { data: intents } = await supabase.from('lead_message_intents').select('sentimento, intent_summary, created_at').eq('lead_id', leadId).eq('empresa', customer.empresa).gte('created_at', fortyEightHoursAgo).order('created_at', { ascending: false }).limit(10);
    if (!intents || intents.length < 2) continue;

    let consecutiveNeg = 0;
    for (const intent of intents) { if (intent.sentimento === 'NEGATIVO') consecutiveNeg++; else break; }
    if (consecutiveNeg < 2) continue;

    const gravidade = consecutiveNeg >= 3 ? 'ALTA' : 'MEDIA';
    const contactName = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.nome as string || 'Cliente' : 'Cliente';

    await supabase.from('cs_incidents').insert({
      customer_id: customer.id, empresa: customer.empresa, tipo: 'RECLAMACAO', gravidade,
      titulo: `Sentimento negativo detectado: ${contactName}`,
      descricao: `IA detectou ${consecutiveNeg} mensagens consecutivas com sentimento negativo nas últimas 48h. Última: "${intents[0]?.intent_summary?.substring(0, 200) || '-'}"`,
      origem: 'IA_DETECTOR', status: 'ABERTA', responsavel_id: customer.csm_id, detectado_por_ia: true, impacto_health: consecutiveNeg >= 3 ? -15 : -10,
    });

    if (customer.csm_id) {
      await supabase.from('notifications').insert({
        user_id: customer.csm_id, empresa: customer.empresa,
        titulo: `⚠️ Sentimento negativo: ${contactName}`,
        mensagem: `${consecutiveNeg} mensagens negativas consecutivas detectadas. Gravidade: ${gravidade}.`,
        tipo: 'CS_INCIDENT_AUTO', referencia_tipo: 'CS_CUSTOMER', referencia_id: customer.id,
      });
    }
    detected++;
  }

  return new Response(JSON.stringify({ detected }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Main router ───────────────────────────────────────────────────────
serve(async (req) => {
  // Support both authenticated (frontend) and webhook (CRON) CORS
  const isOptions = req.method === 'OPTIONS';
  const corsHeaders = req.headers.get('origin') ? getCorsHeaders(req) : getWebhookCorsHeaders();
  if (isOptions) return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body as { action?: string; [key: string]: unknown };

    if (!action) {
      return new Response(JSON.stringify({ error: 'action é obrigatório. Valores: suggest-note, churn-predict, detect-incidents' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    switch (action) {
      case 'suggest-note':
        return await handleSuggestNote(supabase, params, corsHeaders);
      case 'churn-predict':
        return await handleChurnPredict(supabase, params, corsHeaders);
      case 'detect-incidents':
        return await handleDetectIncidents(supabase, params, corsHeaders);
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
