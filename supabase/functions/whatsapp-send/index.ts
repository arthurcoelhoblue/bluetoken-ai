import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_API_URL = 'https://mensageria.grupoblue.com.br/api/whatsapp/send';
const CONNECTION_NAME = 'mensageria';

// Modo de teste: se true, não envia para leads reais
const TEST_MODE = true;
const TEST_PHONE = '5561986266334'; // Número de teste

interface WhatsAppSendRequest {
  leadId: string;
  telefone: string;
  mensagem: string;
  empresa: string;
  runId?: string;
  stepOrdem?: number;
  templateCodigo?: string;
}

interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  testMode?: boolean;
  originalPhone?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('WHATSAPP_API_KEY');
    if (!apiKey) {
      throw new Error('WHATSAPP_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WhatsAppSendRequest = await req.json();
    const { leadId, telefone, mensagem, empresa, runId, stepOrdem, templateCodigo } = body;

    // Validações
    if (!leadId || !telefone || !mensagem || !empresa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: leadId, telefone, mensagem, empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        direcao: 'SAIDA',
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

    // Envia via API WhatsApp
    const whatsappResponse = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        connectionName: CONNECTION_NAME,
        to: phoneToSend,
        message: TEST_MODE 
          ? `[TESTE - Lead: ${leadId}]\n\n${mensagem}` 
          : mensagem,
      }),
    });

    const whatsappData = await whatsappResponse.json();
    console.log('[whatsapp-send] Resposta API:', whatsappData);

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
