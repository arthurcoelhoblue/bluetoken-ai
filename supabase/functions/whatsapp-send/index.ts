import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5G-D - WhatsApp Send com Roteamento por Canal
// Suporta Blue Chat e Mensageria conforme integration_company_config
// ========================================

import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

// API Mensageria
const WHATSAPP_API_URL = 'https://dev-mensageria.grupoblue.com.br/api/whatsapp/send-message';

// Número de teste deve vir de system_settings (sem fallback hardcoded)
const DEFAULT_TEST_PHONE: string | null = null;

interface WhatsAppSendRequest {
  leadId: string;
  telefone: string;
  mensagem: string;
  empresa: string;
  runId?: string;
  stepOrdem?: number;
  templateCodigo?: string;
  to?: string;
  message?: string;
  isAutoResponse?: boolean;
}

interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  testMode?: boolean;
  originalPhone?: string;
  optOutBlocked?: boolean;
  channel?: string;
}

// ========================================
// ROTEAMENTO: Blue Chat
// ========================================

async function sendViaBluechat(
  supabase: SupabaseClient,
  opts: {
    leadId: string;
    empresa: string;
    mensagem: string;
    messageId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { leadId, empresa, mensagem, messageId } = opts;

  // 1. Buscar config Blue Chat em system_settings
  const settingsKey = empresa === 'BLUE' ? 'bluechat_blue' : 'bluechat_tokeniza';
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  let apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
  if (!apiUrl) {
    // Fallback para config legada
    const { data: legacySetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', 'bluechat')
      .maybeSingle();
    apiUrl = (legacySetting?.value as Record<string, unknown>)?.api_url as string | undefined;
  }

  if (!apiUrl) {
    return { success: false, error: `URL da API Blue Chat não configurada para ${empresa}` };
  }

  // 2. Buscar API key correta por empresa
  const bluechatApiKey = empresa === 'BLUE'
    ? Deno.env.get('BLUECHAT_API_KEY_BLUE')
    : Deno.env.get('BLUECHAT_API_KEY');

  if (!bluechatApiKey) {
    return { success: false, error: `BLUECHAT_API_KEY não configurada para ${empresa}` };
  }

  // 3. Buscar conversation_id do lead_conversation_state.framework_data
  const { data: convState } = await supabase
    .from('lead_conversation_state')
    .select('framework_data')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .maybeSingle();

  const frameworkData = convState?.framework_data as Record<string, unknown> | null;
  const conversationId = (frameworkData?.bluechat_conversation_id as string) || null;

  if (!conversationId) {
    return { 
      success: false, 
      error: 'Nenhuma conversa Blue Chat ativa encontrada para este lead. O lead precisa ter iniciado uma conversa via Blue Chat primeiro.' 
    };
  }

  console.log(`[BlueChatSend] Enviando via Blue Chat para lead ${leadId}, conversation: ${conversationId}`);

  // 4. Enviar mensagem via API Blue Chat
  const baseUrl = apiUrl.replace(/\/$/, '');
  const messagesUrl = `${baseUrl}/messages`;

  const response = await fetch(messagesUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': bluechatApiKey,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      content: mensagem,
      source: 'MANUAL_SELLER',
    }),
  });

  const responseText = await response.text();
  console.log(`[BlueChatSend] Status: ${response.status}, Resposta: ${responseText.substring(0, 500)}`);

  if (!response.ok) {
    // Atualizar estado para ERRO
    await supabase
      .from('lead_messages')
      .update({
        estado: 'ERRO',
        erro_detalhe: `Blue Chat API erro (${response.status}): ${responseText.substring(0, 200)}`,
      })
      .eq('id', messageId);

    return { success: false, error: `Blue Chat API retornou ${response.status}: ${responseText.substring(0, 200)}` };
  }

  // 5. Atualizar estado para ENVIADO
  await supabase
    .from('lead_messages')
    .update({
      estado: 'ENVIADO',
      enviado_em: new Date().toISOString(),
      template_codigo: 'MANUAL_BLUECHAT',
    })
    .eq('id', messageId);

  console.log(`[BlueChatSend] Mensagem enviada com sucesso via Blue Chat: ${messageId}`);
  return { success: true };
}

// ========================================
// ROTEAMENTO: Mensageria (fluxo original)
// ========================================

async function sendViaMensageria(
  supabase: SupabaseClient,
  opts: {
    phoneToSend: string;
    mensagem: string;
    messageId: string;
  }
): Promise<{ success: boolean; error?: string; whatsappMessageId?: string }> {
  const { phoneToSend, mensagem, messageId } = opts;

  const apiKey = Deno.env.get('MENSAGERIA_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'MENSAGERIA_API_KEY não configurada' };
  }

  const payloadToSend = {
    connectionName: 'Arthur',
    to: phoneToSend,
    message: mensagem,
  };

  console.log('[MensageriaSend] Chamando API:', WHATSAPP_API_URL);
  console.log('[MensageriaSend] Payload:', JSON.stringify(payloadToSend));

  const whatsappResponse = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payloadToSend),
  });

  const responseText = await whatsappResponse.text();
  console.log('[MensageriaSend] Status:', whatsappResponse.status);
  console.log('[MensageriaSend] Resposta:', responseText.substring(0, 500));

  let whatsappData;
  try {
    whatsappData = JSON.parse(responseText);
  } catch {
    await supabase
      .from('lead_messages')
      .update({
        estado: 'ERRO',
        erro_detalhe: `API retornou HTML/texto (status ${whatsappResponse.status}): ${responseText.substring(0, 200)}`,
      })
      .eq('id', messageId);
    return { success: false, error: `API retornou resposta inválida (status ${whatsappResponse.status})` };
  }

  if (!whatsappResponse.ok) {
    await supabase
      .from('lead_messages')
      .update({
        estado: 'ERRO',
        erro_detalhe: JSON.stringify(whatsappData),
      })
      .eq('id', messageId);
    return { success: false, error: whatsappData.message || 'Erro ao enviar via Mensageria' };
  }

  await supabase
    .from('lead_messages')
    .update({
      estado: 'ENVIADO',
      enviado_em: new Date().toISOString(),
      whatsapp_message_id: whatsappData.messageId || whatsappData.id || null,
    })
    .eq('id', messageId);

  return { success: true, whatsappMessageId: whatsappData.messageId || whatsappData.id };
}

// ========================================
// HANDLER PRINCIPAL
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WhatsAppSendRequest = await req.json();

    // Normalizar campos
    const leadId = body.leadId;
    const telefone = body.telefone || body.to || '';
    const mensagem = body.mensagem || body.message || '';
    const empresa = body.empresa;
    const runId = body.runId;
    const stepOrdem = body.stepOrdem;
    const templateCodigo = body.templateCodigo;

    // Validações
    if (!leadId || !telefone || !mensagem || !empresa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: leadId, telefone, mensagem, empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar canal ativo para esta empresa
    const { data: channelConfigs } = await supabase
      .from('integration_company_config')
      .select('channel, enabled')
      .eq('empresa', empresa)
      .eq('enabled', true);

    const hasActiveChannel = channelConfigs && channelConfigs.length > 0;

    if (!hasActiveChannel) {
      console.log(`[whatsapp-send] Nenhum canal habilitado para empresa ${empresa}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Nenhum canal de comunicação habilitado para ${empresa}`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeChannel = channelConfigs[0].channel;
    console.log(`[whatsapp-send] Canal ativo para ${empresa}: ${activeChannel}`);

    // Buscar configuração de modo teste
    const { data: testConfig } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'whatsapp')
      .eq('key', 'modo_teste')
      .maybeSingle();

    const TEST_MODE = (testConfig?.value as Record<string, unknown>)?.ativo ?? true;
    const TEST_PHONE = ((testConfig?.value as Record<string, unknown>)?.numero_teste as string) || DEFAULT_TEST_PHONE;

    // Se modo teste ativo mas sem número configurado, falhar explicitamente
    if (TEST_MODE && !TEST_PHONE) {
      console.error('[whatsapp-send] Modo teste ativo mas nenhum numero_teste configurado em system_settings');
      return new Response(
        JSON.stringify({ success: false, error: 'Modo teste ativo mas nenhum número de teste configurado. Configure em system_settings(category=whatsapp, key=modo_teste).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-send] Modo teste: ${TEST_MODE}, Canal: ${activeChannel}`);

    // Verificar opt-out
    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('opt_out, opt_out_em')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .limit(1)
      .maybeSingle();

    if (contact?.opt_out === true) {
      console.log(`[whatsapp-send] BLOQUEADO - Lead ${leadId} em opt-out`);

      await supabase.from('lead_messages').insert({
        lead_id: leadId,
        empresa: empresa,
        canal: 'WHATSAPP',
        direcao: 'OUTBOUND',
        conteudo: mensagem,
        estado: 'ERRO',
        erro_detalhe: 'Envio bloqueado: lead em opt-out',
        run_id: runId || null,
        step_ordem: stepOrdem || null,
        template_codigo: templateCodigo || null,
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Lead em opt-out - envio bloqueado', optOutBlocked: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar telefone E.164
    const phoneClean = telefone.replace(/\D/g, '');
    const phoneE164 = phoneClean.startsWith('+') ? phoneClean : `+${phoneClean}`;
    const testPhoneE164 = TEST_PHONE ? (TEST_PHONE.startsWith('+') ? TEST_PHONE : `+${TEST_PHONE}`) : '';
    const phoneToSend = TEST_MODE ? testPhoneE164 : phoneE164;

    console.log(`[whatsapp-send] Lead ${leadId}, telefone: ${phoneClean} → ${phoneToSend}`);

    // Typing delay
    const typingDelayMs = Math.min(Math.max(mensagem.length * 15, 300), 1500);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // Inserir mensagem com estado PENDENTE
    const { data: messageRecord, error: insertError } = await supabase
      .from('lead_messages')
      .insert({
        lead_id: leadId,
        empresa: empresa,
        canal: 'WHATSAPP',
        direcao: 'OUTBOUND',
        conteudo: mensagem,
        estado: 'PENDENTE',
        run_id: runId || null,
        step_ordem: stepOrdem || null,
        template_codigo: templateCodigo || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[whatsapp-send] Erro ao inserir mensagem:', insertError);
      throw new Error(`Erro ao registrar mensagem: ${insertError.message}`);
    }

    const messageId = messageRecord.id;
    console.log(`[whatsapp-send] Mensagem registrada: ${messageId}`);

    // ========================================
    // ROTEAMENTO POR CANAL
    // ========================================

    let sendResult: { success: boolean; error?: string };

    if (activeChannel === 'bluechat') {
      // Enviar via Blue Chat API
      console.log(`[whatsapp-send] Roteando via BLUE CHAT para ${empresa}`);
      sendResult = await sendViaBluechat(supabase, {
        leadId,
        empresa,
        mensagem,
        messageId,
      });
    } else {
      // Enviar via Mensageria (fluxo original)
      console.log(`[whatsapp-send] Roteando via MENSAGERIA para ${empresa}`);
      sendResult = await sendViaMensageria(supabase, {
        phoneToSend,
        mensagem,
        messageId,
      });
    }

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: sendResult.error,
          messageId,
          channel: activeChannel,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: WhatsAppSendResponse = {
      success: true,
      messageId,
      testMode: TEST_MODE,
      originalPhone: TEST_MODE ? phoneClean : undefined,
      channel: activeChannel,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[whatsapp-send] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
