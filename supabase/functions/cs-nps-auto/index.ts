import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-nps-auto');
const corsHeaders = getWebhookCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo ?? 'NPS';
    const targetCustomerId = body.customer_id;

    // CSAT mode: send to a specific customer (triggered by incident resolution)
    if (tipo === 'CSAT' && targetCustomerId) {
      const { data: customer } = await supabase
        .from('cs_customers')
        .select('id, empresa, contacts(nome, primeiro_nome, telefone, email)')
        .eq('id', targetCustomerId)
        .single();

      if (!customer) {
        return new Response(JSON.stringify({ sent: 0, message: 'Customer not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const contact = (customer as { contacts?: { nome?: string; primeiro_nome?: string; telefone?: string; email?: string } }).contacts;
      if (!contact) {
        return new Response(JSON.stringify({ sent: 0, message: 'No contact' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 1 a 5, como você avalia o atendimento que recebeu na resolução da sua solicitação? Responda apenas com o número.`;

      await supabase.from('cs_surveys').insert({
        customer_id: customer.id,
        empresa: customer.empresa,
        tipo: 'CSAT',
        canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL',
        pergunta,
        enviado_em: new Date().toISOString(),
      });

      if (contact.telefone) {
        try {
          const whatsappUrl = `${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`;
          await fetch(whatsappUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              telefone: contact.telefone,
              mensagem: pergunta,
              empresa: customer.empresa,
            }),
          });
        } catch (e) {
          log.warn(`Falha WhatsApp para ${customer.id}`, { error: String(e) });
        }
      }

      return new Response(JSON.stringify({ sent: 1, tipo: 'CSAT' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NPS mode: find active customers who haven't received NPS in last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: customers } = await supabase
      .from('cs_customers')
      .select('id, contact_id, empresa, contacts(nome, primeiro_nome, telefone, email)')
      .eq('is_active', true);

    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out customers who already have NPS in last 90 days
    const eligibleCustomers: typeof customers = [];
    for (const customer of customers) {
      const { data: recentSurvey } = await supabase
        .from('cs_surveys')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('tipo', 'NPS')
        .gte('enviado_em', ninetyDaysAgo)
        .limit(1);

      if (!recentSurvey || recentSurvey.length === 0) {
        eligibleCustomers.push(customer);
      }
    }

    let sent = 0;

    for (const customer of eligibleCustomers) {
      const contact = (customer as { contacts?: { nome?: string; primeiro_nome?: string; telefone?: string; email?: string } }).contacts;
      if (!contact) continue;

      const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 0 a 10, o quanto você recomendaria nossos serviços para um amigo ou colega? Responda apenas com o número.`;

      await supabase.from('cs_surveys').insert({
        customer_id: customer.id,
        empresa: customer.empresa,
        tipo: 'NPS',
        canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL',
        pergunta,
        enviado_em: new Date().toISOString(),
      });

      if (contact.telefone) {
        try {
          const whatsappUrl = `${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`;
          await fetch(whatsappUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              telefone: contact.telefone,
              mensagem: pergunta,
              empresa: customer.empresa,
            }),
          });
        } catch (e) {
          log.warn(`Falha ao enviar WhatsApp para ${customer.id}`, { error: String(e) });
        }
      }

      sent++;
    }

    return new Response(
      JSON.stringify({ sent, tipo: 'NPS' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log.error('Erro', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
