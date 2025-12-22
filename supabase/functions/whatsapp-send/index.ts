import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5G-C - WhatsApp Send com Bloqueio Opt-Out
// Atualizado: Nova API Mensageria (dev-mensageria.grupoblue.com.br)
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nova API do Mensageria - endpoint correto conforme documentação
const WHATSAPP_API_URL = 'https://dev-mensageria.grupoblue.com.br/api/whatsapp/send-message';

// Modo de teste: se true, não envia para leads reais
const TEST_MODE = true;
const TEST_PHONE = '5561998317422'; // Número de teste - Arthur

interface WhatsAppSendRequest {
  leadId: string;
  telefone: string;
  mensagem: string;
  empresa: string;
  runId?: string;
  stepOrdem?: number;
  templateCodigo?: string;
  // Alternativas para compatibilidade
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usa a nova MENSAGERIA_API_KEY
    const apiKey = Deno.env.get('MENSAGERIA_API_KEY');
    if (!apiKey) {
      throw new Error('MENSAGERIA_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WhatsAppSendRequest = await req.json();
    
    // Normalizar campos (compatibilidade com chamadas do sdr-ia-interpret)
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

    // PATCH 5G-C Fase 6: Verificar opt-out antes de enviar
    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('opt_out, opt_out_em')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .limit(1)
      .maybeSingle();

    if (contact?.opt_out === true) {
      console.log(`[whatsapp-send] BLOQUEADO - Lead ${leadId} está em opt-out desde ${contact.opt_out_em}`);
      
      // Registrar tentativa bloqueada
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

      const response: WhatsAppSendResponse = {
        success: false,
        error: 'Lead em opt-out - envio bloqueado',
        optOutBlocked: true,
      };

      return new Response(
        JSON.stringify(response),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formata telefone (remove caracteres não numéricos)
    const phoneClean = telefone.replace(/\D/g, '');
    
    // Em modo teste, usa número de teste
    const phoneToSend = TEST_MODE ? TEST_PHONE : phoneClean;
    
    console.log(`[whatsapp-send] Enviando mensagem para lead ${leadId}`);
    console.log(`[whatsapp-send] Telefone original: ${phoneClean}, Enviando para: ${phoneToSend}`);
    console.log(`[whatsapp-send] Modo teste: ${TEST_MODE}`);

    // Insere registro na lead_messages com estado PENDENTE
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

    // Log interno para rastreabilidade (não vai pro cliente)
    if (TEST_MODE) {
      console.log(`[whatsapp-send] 🧪 MODO TESTE ATIVO - Lead original: ${leadId}, telefone real: ${phoneClean}`);
    }

    // PATCH: Delay proporcional ao tamanho da mensagem para parecer humano
    // Fórmula: ~30ms por caractere, min 800ms, max 4000ms
    const typingDelayMs = Math.min(Math.max(mensagem.length * 30, 800), 4000);
    console.log(`[whatsapp-send] Simulando digitação: ${typingDelayMs}ms para ${mensagem.length} caracteres`);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // Envia via nova API Mensageria - formato correto conforme documentação
    const payloadToSend = {
      connectionName: 'mensageria',  // Obrigatório conforme docs
      to: phoneToSend,               // Campo correto é "to", não "phone"
      message: mensagem,
    };
    
    console.log('[whatsapp-send] Chamando API:', WHATSAPP_API_URL);
    console.log('[whatsapp-send] Payload:', JSON.stringify(payloadToSend));
    console.log('[whatsapp-send] Headers: X-API-Key presente:', !!apiKey);
    
    const whatsappResponse = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,  // Case-sensitive conforme documentação
      },
      body: JSON.stringify(payloadToSend),
    });

    // Captura resposta como texto primeiro para diagnosticar erros HTML
    const responseText = await whatsappResponse.text();
    console.log('[whatsapp-send] Status:', whatsappResponse.status);
    console.log('[whatsapp-send] Resposta bruta (primeiros 500 chars):', responseText.substring(0, 500));
    
    // Tenta parsear como JSON
    let whatsappData;
    try {
      whatsappData = JSON.parse(responseText);
      console.log('[whatsapp-send] Resposta JSON:', whatsappData);
    } catch (parseError) {
      console.error('[whatsapp-send] Resposta não é JSON válido. Pode ser página de erro HTML.');
      
      // Atualiza estado para ERRO com detalhes
      await supabase
        .from('lead_messages')
        .update({
          estado: 'ERRO',
          erro_detalhe: `API retornou HTML/texto (status ${whatsappResponse.status}): ${responseText.substring(0, 200)}`,
        })
        .eq('id', messageId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `API retornou resposta inválida (status ${whatsappResponse.status}). Verifique se a URL e API Key estão corretas.`,
          messageId,
          statusCode: whatsappResponse.status,
          responsePreview: responseText.substring(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!whatsappResponse.ok) {
      // Atualiza estado para ERRO
      await supabase
        .from('lead_messages')
        .update({
          estado: 'ERRO',
          erro_detalhe: JSON.stringify(whatsappData),
        })
        .eq('id', messageId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: whatsappData.message || 'Erro ao enviar via WhatsApp',
          messageId,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualiza estado para ENVIADO
    await supabase
      .from('lead_messages')
      .update({
        estado: 'ENVIADO',
        enviado_em: new Date().toISOString(),
        whatsapp_message_id: whatsappData.messageId || whatsappData.id || null,
      })
      .eq('id', messageId);

    console.log(`[whatsapp-send] Mensagem enviada com sucesso: ${messageId}`);

    const response: WhatsAppSendResponse = {
      success: true,
      messageId,
      testMode: TEST_MODE,
      originalPhone: TEST_MODE ? phoneClean : undefined,
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
