import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// ========================================
// CORS Headers
// ========================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// Tipos
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';

interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  // Contexto para logging
  lead_id?: string;
  empresa?: EmpresaTipo;
  run_id?: string;
  step_ordem?: number;
  template_codigo?: string;
}

interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ========================================
// Configurações SMTP
// ========================================
const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || '';

// Modo de teste - se true, não envia de verdade
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true';

// ========================================
// Função Principal
// ========================================
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[EmailSend] Recebendo requisição...');

  try {
    // Validar configurações SMTP
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      console.error('[EmailSend] Configurações SMTP incompletas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configurações SMTP não configuradas',
        } as EmailSendResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse do body
    const body: EmailSendRequest = await req.json();
    console.log('[EmailSend] Request:', {
      to: body.to,
      subject: body.subject,
      lead_id: body.lead_id,
      empresa: body.empresa,
      test_mode: TEST_MODE,
    });

    // Validações básicas
    if (!body.to || !body.subject || !body.html) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campos obrigatórios: to, subject, html',
        } as EmailSendResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      console.error('[EmailSend] E-mail inválido:', body.to);
      return new Response(
        JSON.stringify({
          success: false,
          error: `E-mail inválido: ${body.to}`,
        } as EmailSendResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase para logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Registrar mensagem como PENDENTE
    let messageId: string | undefined;
    if (body.lead_id && body.empresa) {
      const { data: msgData, error: msgError } = await supabase
        .from('lead_messages')
        .insert({
          lead_id: body.lead_id,
          empresa: body.empresa,
          canal: 'EMAIL',
          direcao: 'OUTBOUND',
          conteudo: body.html,
          estado: 'PENDENTE',
          run_id: body.run_id,
          step_ordem: body.step_ordem,
          template_codigo: body.template_codigo,
        })
        .select('id')
        .single();

      if (msgError) {
        console.error('[EmailSend] Erro ao registrar mensagem:', msgError);
      } else {
        messageId = msgData?.id;
        console.log('[EmailSend] Mensagem registrada:', messageId);
      }
    }

    // Modo de teste - simula envio
    if (TEST_MODE) {
      console.log('[EmailSend] [TEST_MODE] Simulando envio de e-mail...');
      const fakeMessageId = `test-${Date.now()}`;

      // Atualizar status para ENVIADO
      if (messageId) {
        await supabase
          .from('lead_messages')
          .update({
            estado: 'ENVIADO',
            enviado_em: new Date().toISOString(),
            email_message_id: fakeMessageId,
          })
          .eq('id', messageId);
      }

      const duration = Date.now() - startTime;
      console.log(`[EmailSend] [TEST_MODE] Concluído em ${duration}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          messageId: fakeMessageId,
        } as EmailSendResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar e-mail real via SMTP
    console.log('[EmailSend] Conectando ao servidor SMTP...');
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: SMTP_PORT === 465,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    try {
      console.log('[EmailSend] Enviando e-mail...');
      const sendResult = await client.send({
        from: SMTP_FROM,
        to: body.to,
        subject: body.subject,
        content: body.text || '',
        html: body.html,
      });

      console.log('[EmailSend] E-mail enviado com sucesso:', sendResult);

      // Atualizar status para ENVIADO
      if (messageId) {
        await supabase
          .from('lead_messages')
          .update({
            estado: 'ENVIADO',
            enviado_em: new Date().toISOString(),
            email_message_id: `smtp-${Date.now()}`,
          })
          .eq('id', messageId);
      }

      await client.close();

      const duration = Date.now() - startTime;
      console.log(`[EmailSend] Concluído em ${duration}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          messageId: `smtp-${Date.now()}`,
        } as EmailSendResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (smtpError) {
      console.error('[EmailSend] Erro SMTP:', smtpError);
      
      // Atualizar status para ERRO
      if (messageId) {
        await supabase
          .from('lead_messages')
          .update({
            estado: 'ERRO',
            erro_detalhe: smtpError instanceof Error ? smtpError.message : 'Erro SMTP desconhecido',
          })
          .eq('id', messageId);
      }

      try {
        await client.close();
      } catch {
        // Ignorar erro ao fechar
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: smtpError instanceof Error ? smtpError.message : 'Erro ao enviar e-mail',
        } as EmailSendResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[EmailSend] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      } as EmailSendResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
