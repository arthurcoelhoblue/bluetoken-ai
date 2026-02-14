import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find customers with data_primeiro_ganho ~90 days ago who don't have NPS yet
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);

    const { data: customers } = await supabase
      .from('cs_customers')
      .select('id, contact_id, empresa, contacts(nome, primeiro_nome, telefone, email)')
      .eq('is_active', true)
      .gte('data_primeiro_ganho', ninetyOneDaysAgo.toISOString())
      .lte('data_primeiro_ganho', ninetyDaysAgo.toISOString());

    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;

    for (const customer of customers) {
      // Check if NPS already sent
      const { data: existingSurvey } = await supabase
        .from('cs_surveys')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('tipo', 'NPS')
        .limit(1);

      if (existingSurvey && existingSurvey.length > 0) continue;

      const contact = (customer as any).contacts;
      if (!contact) continue;

      const pergunta = `Olá ${contact.primeiro_nome || contact.nome || 'Cliente'}! Em uma escala de 0 a 10, o quanto você recomendaria nossos serviços para um amigo ou colega? Responda apenas com o número.`;

      // Create survey record
      await supabase.from('cs_surveys').insert({
        customer_id: customer.id,
        empresa: customer.empresa,
        tipo: 'NPS',
        canal_envio: contact.telefone ? 'WHATSAPP' : 'EMAIL',
        pergunta,
        enviado_em: new Date().toISOString(),
      });

      // Try to send via WhatsApp if phone available
      if (contact.telefone) {
        try {
          const whatsappUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-send`;
          await fetch(whatsappUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              telefone: contact.telefone,
              mensagem: pergunta,
              empresa: customer.empresa,
            }),
          });
        } catch (e) {
          console.warn(`[CS-NPS] Falha ao enviar WhatsApp para ${customer.id}:`, e);
        }
      }

      sent++;
    }

    return new Response(
      JSON.stringify({ sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CS-NPS-Auto] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
