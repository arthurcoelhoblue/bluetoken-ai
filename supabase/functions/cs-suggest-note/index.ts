import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { assertEmpresa } from "../_shared/tenant.ts";

const log = createLogger('cs-suggest-note');

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const { customer_id } = await req.json();
    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch customer + context in parallel
    const [customerRes, surveysRes, incidentsRes, healthRes] = await Promise.all([
      supabase.from('cs_customers').select('id, empresa, notas_csm, health_score, health_status, valor_mrr, risco_churn_pct, contact:contact_id(nome, email)').eq('id', customer_id).single(),
      supabase.from('cs_surveys').select('tipo, nota, feedback_texto, enviado_em').eq('customer_id', customer_id).order('enviado_em', { ascending: false }).limit(5),
      supabase.from('cs_incidents').select('titulo, descricao, gravidade, status, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(5),
      supabase.from('cs_health_log').select('score, status, motivo_mudanca, created_at').eq('customer_id', customer_id).order('created_at', { ascending: false }).limit(3),
    ]);

    const customer = customerRes.data;
    if (!customer) {
      return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate tenant
    assertEmpresa(customer.empresa);

    const surveys = surveysRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const healthLog = healthRes.data ?? [];

    // Build context
    const contextParts: string[] = [];
    contextParts.push(`Cliente: ${(customer.contact as Record<string, unknown>)?.nome || 'N/A'}, Health: ${customer.health_score} (${customer.health_status}), MRR: R$${customer.valor_mrr}, Churn: ${customer.risco_churn_pct}%`);
    if (customer.notas_csm) contextParts.push(`Notas atuais do CSM: ${customer.notas_csm}`);
    if (surveys.length > 0) {
      contextParts.push('Pesquisas recentes: ' + surveys.map((s: Record<string, unknown>) => `${s.tipo} nota=${s.nota ?? 'pendente'} ${s.feedback_texto ? `"${(s.feedback_texto as string).slice(0, 100)}"` : ''}`).join(' | '));
    }
    if (incidents.length > 0) {
      contextParts.push('Incidências recentes: ' + incidents.map((i: Record<string, unknown>) => `[${i.gravidade}/${i.status}] ${i.titulo}`).join(' | '));
    }
    if (healthLog.length > 0) {
      contextParts.push('Health log: ' + healthLog.map((h: Record<string, unknown>) => `Score ${h.score} (${h.status}) - ${h.motivo_mudanca || 'recalculado'}`).join(' | '));
    }

    const prompt = `Baseado nos dados do cliente abaixo, sugira uma nota de acompanhamento em 2-3 frases que o CSM pode registrar. A nota deve ser prática, mencionar dados concretos e sugerir próximos passos.

${contextParts.join('\n')}

Responda APENAS com a sugestão de nota, sem prefixos ou explicações.`;

    // Use shared AI provider (auto-logs telemetry)
    const aiResult = await callAI({
      system: 'Você é um assistente de Customer Success que gera notas de acompanhamento práticas e acionáveis.',
      prompt,
      functionName: 'cs-suggest-note',
      empresa: customer.empresa,
      temperature: 0.3,
      maxTokens: 300,
      supabase,
    });

    const sugestao = aiResult.content || 'Não foi possível gerar sugestão no momento. Tente novamente.';

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
