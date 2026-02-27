import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, getOptionalEnv, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('whatsapp-send');
const corsHeaders = getWebhookCorsHeaders();

// API Mensageria
const WHATSAPP_API_URL = 'https://dev-mensageria.grupoblue.com.br/api/whatsapp/send-message';

// Número de teste deve vir de system_settings (sem fallback hardcoded)
const DEFAULT_TEST_PHONE: string | null = null;

interface WhatsAppSendRequest {
  leadId?: string;
  contactId?: string;
  telefone: string;
  mensagem: string;
  empresa: string;
  runId?: string;
  stepOrdem?: number;
  templateCodigo?: string;
  to?: string;
  message?: string;
  isAutoResponse?: boolean;
  // Meta Cloud template fields
  metaTemplateName?: string;
  metaLanguage?: string;
  metaComponents?: Array<{
    type: string;
    parameters: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
  // Media fields
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
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
// ROTEAMENTO: Mensageria (fluxo original)
// ========================================

async function sendViaMensageria(
  supabase: SupabaseClient,
  opts: {
    phoneToSend: string;
    mensagem: string;
    messageId: string;
    apiKey?: string;
    connectionName?: string;
  }
): Promise<{ success: boolean; error?: string; whatsappMessageId?: string }> {
  const { phoneToSend, mensagem, messageId } = opts;

  const resolvedApiKey = opts.apiKey || getOptionalEnv('MENSAGERIA_API_KEY');
  if (!resolvedApiKey) {
    return { success: false, error: 'API Key da Mensageria não configurada para esta empresa' };
  }

  const resolvedConnName = opts.connectionName || 'arthur';

  // Mensageria espera connectionName minúsculo e telefone sem '+'
  const phoneSanitized = phoneToSend.replace(/^\+/, '');
  const payloadToSend = {
    connectionName: resolvedConnName.toLowerCase(),
    to: phoneSanitized,
    message: mensagem,
  };

  log.info('Chamando API Mensageria', { url: WHATSAPP_API_URL });
  log.debug('Mensageria payload', { to: payloadToSend.to });

  const whatsappResponse = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': resolvedApiKey,
    },
    body: JSON.stringify(payloadToSend),
  });

  const responseText = await whatsappResponse.text();
  log.info('Mensageria response', { status: whatsappResponse.status });

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
    const supabase = createServiceClient();

    const body: WhatsAppSendRequest = await req.json();

    // Normalizar campos
    let leadId = body.leadId || '';
    const contactId = body.contactId || '';
    const telefone = body.telefone || body.to || '';
    const mensagem = body.mensagem || body.message || '';
    const empresa = body.empresa;
    const runId = body.runId;
    const stepOrdem = body.stepOrdem;
    const templateCodigo = body.templateCodigo;
    const metaTemplateName = body.metaTemplateName;
    const metaLanguage = body.metaLanguage;
    const metaComponents = body.metaComponents;
    const mediaType = body.mediaType;
    const mediaUrl = body.mediaUrl;
    const mediaCaption = body.mediaCaption;
    const mediaFilename = body.mediaFilename;

    const isTemplateSend = !!metaTemplateName;
    const isMediaSend = !!mediaType && !!mediaUrl;

    // Validações - precisa de pelo menos leadId ou contactId
    if (!leadId && !contactId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: leadId ou contactId, telefone, empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!telefone || !empresa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: telefone, empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se temos contactId mas não leadId, tentar resolver legacy_lead_id
    if (!leadId && contactId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('legacy_lead_id')
        .eq('id', contactId)
        .maybeSingle();
      if (contactData?.legacy_lead_id) {
        leadId = contactData.legacy_lead_id;
        log.info('Resolved leadId from contact', { contactId, leadId });
      } else {
        log.info('Contact sem legacy_lead_id, usando contactId', { contactId });
      }
    }
    if (!isTemplateSend && !mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: mensagem (ou metaTemplateName para template)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar canal ativo para esta empresa
    const { data: channelConfigs } = await supabase
      .from('integration_company_config')
      .select('channel, enabled, api_key, connection_name')
      .eq('empresa', empresa)
      .eq('enabled', true);

    const hasActiveChannel = channelConfigs && channelConfigs.length > 0;

    if (!hasActiveChannel) {
      log.warn('Nenhum canal habilitado', { empresa });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Nenhum canal de comunicação habilitado para ${empresa}`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeChannel = channelConfigs[0].channel;
    log.info('Canal ativo', { empresa, canal: activeChannel });

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
      log.error('Modo teste ativo sem numero_teste configurado');
      return new Response(
        JSON.stringify({ success: false, error: 'Modo teste ativo mas nenhum número de teste configurado. Configure em system_settings(category=whatsapp, key=modo_teste).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log.info('Configuração', { testMode: TEST_MODE, canal: activeChannel });

    // Verificar opt-out (via contacts se contactId disponível, senão via lead_contacts)
    let optOut = false;
    if (contactId) {
      const { data: contactRecord } = await supabase
        .from('contacts')
        .select('opt_out')
        .eq('id', contactId)
        .maybeSingle();
      optOut = contactRecord?.opt_out === true;
    } else if (leadId) {
      const { data: legacyContact } = await supabase
        .from('lead_contacts')
        .select('opt_out, opt_out_em')
        .eq('lead_id', leadId)
        .eq('empresa', empresa)
        .limit(1)
        .maybeSingle();
      optOut = legacyContact?.opt_out === true;
    }

    if (optOut) {
      log.warn('Bloqueado - opt-out', { leadId, contactId });

      await supabase.from('lead_messages').insert({
        lead_id: leadId || null,
        contact_id: contactId || null,
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

    log.info('Enviando', { leadId, phone: phoneClean, phoneToSend });

    // Typing delay
    const typingDelayMs = Math.min(Math.max(mensagem.length * 15, 300), 1500);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // Inserir mensagem com estado PENDENTE
    const { data: messageRecord, error: insertError } = await supabase
      .from('lead_messages')
      .insert({
        lead_id: leadId || null,
        contact_id: contactId || null,
        empresa: empresa,
        canal: 'WHATSAPP',
        direcao: 'OUTBOUND',
        conteudo: mensagem || mediaCaption || `[${mediaType || 'text'}]`,
        estado: 'PENDENTE',
        run_id: runId || null,
        step_ordem: stepOrdem || null,
        template_codigo: templateCodigo || null,
        tipo_midia: mediaType || 'text',
        media_url: mediaUrl || null,
        media_mime_type: null,
        media_filename: mediaFilename || null,
        media_caption: mediaCaption || null,
      })
      .select()
      .single();

    if (insertError) {
      log.error('Erro ao inserir mensagem', { error: insertError.message });
      throw new Error(`Erro ao registrar mensagem: ${insertError.message}`);
    }

    const messageId = messageRecord.id;
    log.info('Mensagem registrada', { messageId });

    // ========================================
    // ROTEAMENTO POR CANAL
    // ========================================

    let sendResult: { success: boolean; error?: string };

    if (activeChannel === 'meta_cloud') {
      log.info('Roteando via META CLOUD', { empresa, isTemplateSend, isMediaSend });
      const { resolveMetaCloudConfig, sendTextViaMetaCloud, sendTemplateViaMetaCloud, sendImageViaMetaCloud, sendDocumentViaMetaCloud, sendAudioViaMetaCloud, sendVideoViaMetaCloud } = await import('../_shared/channel-resolver.ts');
      const metaConfig = await resolveMetaCloudConfig(supabase, empresa);

      if (metaConfig.mode !== 'META_CLOUD') {
        sendResult = { success: false, error: `Meta Cloud não configurado para ${empresa}` };
      } else if (isTemplateSend) {
        // ── TEMPLATE SEND ──
        log.info('Enviando template Meta Cloud', { template: metaTemplateName });
        const metaResult = await sendTemplateViaMetaCloud(metaConfig, phoneToSend, {
          templateName: metaTemplateName!,
          languageCode: metaLanguage || 'pt_BR',
          components: metaComponents,
        });
        if (metaResult.success) {
          await supabase.from('lead_messages').update({
            estado: 'ENVIADO',
            enviado_em: new Date().toISOString(),
            whatsapp_message_id: metaResult.messageId || null,
            template_codigo: templateCodigo || metaTemplateName,
          }).eq('id', messageId);
        } else {
          await supabase.from('lead_messages').update({
            estado: 'ERRO',
            erro_detalhe: metaResult.error || 'Erro Meta Cloud Template',
          }).eq('id', messageId);
        }
        sendResult = metaResult;
      } else if (isMediaSend) {
        // ── MEDIA SEND (requires 24h window) ──
        const { data: convState2 } = await supabase
          .from('lead_conversation_state')
          .select('last_inbound_at, ultimo_contato_em')
          .eq('lead_id', leadId)
          .eq('empresa', empresa)
          .maybeSingle();
        const lastInbound2 = convState2?.last_inbound_at || convState2?.ultimo_contato_em;
        const hoursAgo2 = lastInbound2 ? (Date.now() - new Date(lastInbound2).getTime()) / (1000 * 60 * 60) : Infinity;

        if (hoursAgo2 > 24) {
          await supabase.from('lead_messages').update({
            estado: 'ERRO',
            erro_detalhe: 'Fora da janela de 24h do Meta Cloud. Use um template aprovado para reabrir.',
          }).eq('id', messageId);
          sendResult = { success: false, error: 'Janela de 24h expirada.' };
        } else {
          let metaMediaResult: { success: boolean; error?: string; messageId?: string };
          switch (mediaType) {
            case 'image':
              metaMediaResult = await sendImageViaMetaCloud(metaConfig, phoneToSend, mediaUrl!, mediaCaption);
              break;
            case 'document':
              metaMediaResult = await sendDocumentViaMetaCloud(metaConfig, phoneToSend, mediaUrl!, mediaFilename, mediaCaption);
              break;
            case 'audio':
              metaMediaResult = await sendAudioViaMetaCloud(metaConfig, phoneToSend, mediaUrl!);
              break;
            case 'video':
              metaMediaResult = await sendVideoViaMetaCloud(metaConfig, phoneToSend, mediaUrl!, mediaCaption);
              break;
            default:
              metaMediaResult = { success: false, error: `Tipo de mídia não suportado: ${mediaType}` };
          }
          if (metaMediaResult.success) {
            await supabase.from('lead_messages').update({
              estado: 'ENVIADO',
              enviado_em: new Date().toISOString(),
              whatsapp_message_id: metaMediaResult.messageId || null,
            }).eq('id', messageId);
          } else {
            await supabase.from('lead_messages').update({
              estado: 'ERRO',
              erro_detalhe: metaMediaResult.error || 'Erro Meta Cloud Media',
            }).eq('id', messageId);
          }
          sendResult = metaMediaResult;
        }
      } else {
        // ── FREE TEXT SEND (requires 24h window) ──
        // Check 24h window
        const { data: convState } = await supabase
          .from('lead_conversation_state')
          .select('last_inbound_at, ultimo_contato_em')
          .eq('lead_id', leadId)
          .eq('empresa', empresa)
          .maybeSingle();

        const lastInbound = convState?.last_inbound_at || convState?.ultimo_contato_em;
        const hoursAgo = lastInbound
          ? (Date.now() - new Date(lastInbound).getTime()) / (1000 * 60 * 60)
          : Infinity;

        if (hoursAgo > 24) {
          log.warn('Fora da janela 24h Meta Cloud', { hoursAgo, leadId });
          await supabase.from('lead_messages').update({
            estado: 'ERRO',
            erro_detalhe: 'Fora da janela de 24h do Meta Cloud. Use um template aprovado para iniciar a conversa.',
          }).eq('id', messageId);
          sendResult = { success: false, error: 'Janela de 24h expirada. Envie um template aprovado para reabrir a conversa.' };
        } else {
          const metaResult = await sendTextViaMetaCloud(metaConfig, phoneToSend, mensagem);
          if (metaResult.success) {
            await supabase.from('lead_messages').update({
              estado: 'ENVIADO',
              enviado_em: new Date().toISOString(),
              whatsapp_message_id: metaResult.messageId || null,
            }).eq('id', messageId);
          } else {
            await supabase.from('lead_messages').update({
              estado: 'ERRO',
              erro_detalhe: metaResult.error || 'Erro Meta Cloud',
            }).eq('id', messageId);
          }
          sendResult = metaResult;
        }
      }
    } else {
      const mensageriaConfig = channelConfigs?.find((c: any) => c.channel === 'mensageria');
      log.info('Roteando via MENSAGERIA', { empresa, connectionName: mensageriaConfig?.connection_name });
      sendResult = await sendViaMensageria(supabase, {
        phoneToSend,
        mensagem,
        messageId,
        apiKey: mensageriaConfig?.api_key || undefined,
        connectionName: mensageriaConfig?.connection_name || undefined,
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
    log.error('Erro', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
