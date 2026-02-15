import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

type EmpresaTipo = 'TOKENIZA' | 'BLUE';

/** Escape user-controlled strings before embedding in HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface NotifyCloserRequest {
  lead_id: string;
  empresa: EmpresaTipo;
  motivo: string;
  closer_email?: string;
  contexto?: {
    lead_nome?: string;
    intent?: string;
    temperatura?: string;
    telefone?: string;
    email?: string;
    ultimas_mensagens?: string[];
    framework_data?: Record<string, unknown>;
  };
}

interface NotifyCloserResponse {
  success: boolean;
  notification_id?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[NotifyCloser] Recebendo requisição...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyCloserRequest = await req.json();
    console.log('[NotifyCloser] Request:', body);

    // Validações básicas
    if (!body.lead_id || !body.empresa || !body.motivo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campos obrigatórios: lead_id, empresa, motivo',
        } as NotifyCloserResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar informações do lead se não fornecidas
    let leadInfo = body.contexto || {};
    if (!leadInfo.lead_nome || !leadInfo.telefone) {
      const { data: contact } = await supabase
        .from('lead_contacts')
        .select('nome, telefone, email, telefone_e164')
        .eq('lead_id', body.lead_id)
        .eq('empresa', body.empresa)
        .single();

      if (contact) {
        leadInfo = {
          ...leadInfo,
          lead_nome: contact.nome || 'Lead sem nome',
          telefone: contact.telefone_e164 || contact.telefone,
          email: contact.email,
        };
      }
    }

    // Buscar classificação do lead
    const { data: classification } = await supabase
      .from('lead_classifications')
      .select('temperatura, icp, persona')
      .eq('lead_id', body.lead_id)
      .eq('empresa', body.empresa)
      .single();

    if (classification) {
      leadInfo.temperatura = classification.temperatura;
    }

    // Buscar últimas mensagens
    const { data: messages } = await supabase
      .from('lead_messages')
      .select('conteudo, direcao')
      .eq('lead_id', body.lead_id)
      .eq('empresa', body.empresa)
      .order('created_at', { ascending: false })
      .limit(5);

    if (messages) {
      leadInfo.ultimas_mensagens = messages.map(m => 
        `${m.direcao === 'INBOUND' ? '👤' : '🤖'} ${escapeHtml((m.conteudo || '').substring(0, 100))}...`
      );
    }

    // Buscar estado de conversa (framework data)
    const { data: convState } = await supabase
      .from('lead_conversation_state')
      .select('framework_ativo, framework_data, estado_funil, perfil_disc')
      .eq('lead_id', body.lead_id)
      .eq('empresa', body.empresa)
      .single();

    if (convState) {
      leadInfo.framework_data = convState.framework_data as Record<string, unknown>;
    }

    // Determinar email do closer - buscar da system_settings por empresa
    let closerEmail = body.closer_email;
    if (!closerEmail) {
      const empresaKey = body.empresa.toLowerCase();
      const { data: closerConfig } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', empresaKey)
        .eq('key', 'closer_email')
        .maybeSingle();
      
      const configuredEmail = (closerConfig?.value as Record<string, unknown>)?.email as string | undefined;
      closerEmail = configuredEmail || `closer@${empresaKey === 'tokeniza' ? 'tokeniza.com.br' : 'grupoblue.com.br'}`;
      
      if (!configuredEmail) {
        console.warn(`[NotifyCloser] Nenhum closer_email configurado em system_settings para empresa ${body.empresa}. Usando fallback: ${closerEmail}. Configure via system_settings(category='${empresaKey}', key='closer_email').`);
      }
    }

    // Inserir notificação no banco
    const { data: notification, error: insertError } = await supabase
      .from('closer_notifications')
      .insert({
        lead_id: body.lead_id,
        empresa: body.empresa,
        closer_email: closerEmail,
        motivo: body.motivo,
        contexto: leadInfo,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[NotifyCloser] Erro ao inserir notificação:', insertError);
      throw insertError;
    }

    console.log('[NotifyCloser] Notificação criada:', notification.id);

    // Enviar email para o closer
    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: closerEmail,
          subject: `🔥 Lead Quente: ${leadInfo.lead_nome} - ${body.empresa}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626; margin-bottom: 20px;">🔥 Lead Quente Detectado!</h1>
              
              <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
               <h2 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(leadInfo.lead_nome || '')}</h2>
                <p style="margin: 5px 0; color: #666;">
                  <strong>Empresa:</strong> ${escapeHtml(body.empresa)}<br/>
                  <strong>Motivo:</strong> ${escapeHtml(body.motivo)}<br/>
                  <strong>Temperatura:</strong> ${escapeHtml(leadInfo.temperatura || 'N/A')}
                </p>
              </div>
              
              <h3 style="color: #333; margin-bottom: 10px;">Contato</h3>
              <p style="color: #666; margin-bottom: 20px;">
                📱 ${escapeHtml(leadInfo.telefone || 'Sem telefone')}<br/>
                📧 ${escapeHtml(leadInfo.email || 'Sem email')}
              </p>
              
              ${leadInfo.ultimas_mensagens?.length ? `
                <h3 style="color: #333; margin-bottom: 10px;">Últimas Mensagens</h3>
                <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  ${leadInfo.ultimas_mensagens.map(m => `<p style="margin: 5px 0; font-size: 14px;">${m}</p>`).join('')}
                </div>
              ` : ''}
              
              ${leadInfo.framework_data && Object.keys(leadInfo.framework_data).length > 0 ? `
                <h3 style="color: #333; margin-bottom: 10px;">Dados de Qualificação</h3>
                <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <pre style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(JSON.stringify(leadInfo.framework_data, null, 2))}</pre>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${supabaseUrl.replace('.supabase.co', '')}/leads/${body.lead_id}/${body.empresa}" 
                   style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Ver Lead Completo
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
                Notificação automática do SDR IA - ${new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          `,
        }),
      });

      const emailResult = await emailResponse.json();
      if (emailResult.success) {
        // Atualizar notificação com data de envio
        await supabase
          .from('closer_notifications')
          .update({ enviado_em: new Date().toISOString() })
          .eq('id', notification.id);

        console.log('[NotifyCloser] Email enviado com sucesso');
      } else {
        console.error('[NotifyCloser] Erro ao enviar email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('[NotifyCloser] Erro ao chamar email-send:', emailError);
      // Não falha a notificação por erro de email
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
      } as NotifyCloserResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NotifyCloser] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      } as NotifyCloserResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
