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

    const { trigger_type, customer_id, context } = await req.json();

    if (!trigger_type || !customer_id) {
      return new Response(JSON.stringify({ error: 'trigger_type and customer_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PlaybookRunner] trigger=${trigger_type} customer=${customer_id}`);

    // Get customer info
    const { data: customer } = await supabase
      .from('cs_customers')
      .select('id, empresa, contact_id, contacts(nome, primeiro_nome, telefone, email)')
      .eq('id', customer_id)
      .single();

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find active playbooks matching trigger_type and empresa
    const { data: playbooks } = await supabase
      .from('cs_playbooks')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', trigger_type)
      .eq('empresa', customer.empresa);

    if (!playbooks || playbooks.length === 0) {
      console.log(`[PlaybookRunner] No active playbooks for trigger=${trigger_type} empresa=${customer.empresa}`);
      return new Response(JSON.stringify({ executed: 0, message: 'No matching playbooks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contact = (customer as any).contacts;
    const results: any[] = [];

    for (const playbook of playbooks) {
      const steps = (playbook.steps || []) as any[];
      console.log(`[PlaybookRunner] Executing playbook "${playbook.nome}" with ${steps.length} steps`);

      for (const step of steps) {
        try {
          switch (step.type) {
            case 'notification': {
              // Create in-app notification
              const targetUserId = step.user_id || customer.csm_id;
              if (targetUserId) {
                await supabase.from('notifications').insert({
                  user_id: targetUserId,
                  empresa: customer.empresa,
                  tipo: 'CS_PLAYBOOK',
                  titulo: step.title || `Playbook: ${playbook.nome}`,
                  mensagem: step.message || `Ação necessária para ${contact?.nome || customer_id}`,
                  link: `/cs/clientes/${customer_id}`,
                });
              }
              break;
            }

            case 'whatsapp': {
              if (contact?.telefone) {
                const whatsappUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-send`;
                const message = (step.template || step.message || '')
                  .replace('{{nome}}', contact.primeiro_nome || contact.nome || 'Cliente')
                  .replace('{{empresa}}', customer.empresa);

                await fetch(whatsappUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    telefone: contact.telefone,
                    mensagem: message,
                    empresa: customer.empresa,
                  }),
                });
              }
              break;
            }

            case 'email': {
              if (contact?.email) {
                const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-send`;
                await fetch(emailUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    to: contact.email,
                    subject: step.subject || `Ação: ${playbook.nome}`,
                    body: (step.body || step.message || '')
                      .replace('{{nome}}', contact.primeiro_nome || contact.nome || 'Cliente'),
                    empresa: customer.empresa,
                  }),
                });
              }
              break;
            }

            case 'survey': {
              // Trigger NPS/CSAT
              const surveyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cs-nps-auto`;
              await fetch(surveyUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  customer_id,
                  tipo: step.survey_type || 'CSAT',
                }),
              });
              break;
            }

            case 'health_recalc': {
              const healthUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cs-health-calculator`;
              await fetch(healthUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({ customer_id }),
              });
              break;
            }

            default:
              console.warn(`[PlaybookRunner] Unknown step type: ${step.type}`);
          }

          results.push({ playbook: playbook.nome, step: step.type, status: 'ok' });
        } catch (stepErr) {
          console.error(`[PlaybookRunner] Step error:`, stepErr);
          results.push({ playbook: playbook.nome, step: step.type, status: 'error', error: String(stepErr) });
        }

        // Small delay between steps
        if (step.delay_seconds) {
          await new Promise(r => setTimeout(r, Math.min(step.delay_seconds * 1000, 30000)));
        }
      }
    }

    return new Response(JSON.stringify({
      executed: playbooks.length,
      steps_total: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PlaybookRunner] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
