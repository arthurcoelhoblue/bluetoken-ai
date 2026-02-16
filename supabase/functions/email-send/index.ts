import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.25.76';
import { envConfig, getOptionalEnvWithDefault, createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('email-send');

const emailSendPayload = z.object({
  to: z.string().trim().email('E-mail inválido').max(255),
  subject: z.string().trim().min(1, 'Subject obrigatório').max(500),
  html: z.string().min(1, 'HTML obrigatório').max(100000),
  text: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  empresa: z.enum(['TOKENIZA', 'BLUE']).optional(),
  run_id: z.string().uuid().optional(),
  step_ordem: z.number().int().optional(),
  template_codigo: z.string().optional(),
});

// ========================================
// CORS Headers
// ========================================
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

// ========================================
// Tipos
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';

interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
// Configurações SMTP (via API HTTP)
// ========================================
const SMTP_HOST = getOptionalEnvWithDefault('SMTP_HOST', '');
const SMTP_PORT = parseInt(getOptionalEnvWithDefault('SMTP_PORT', '587'));
const SMTP_USER = getOptionalEnvWithDefault('SMTP_USER', '');
const SMTP_PASS = getOptionalEnvWithDefault('SMTP_PASS', '');
const SMTP_FROM = getOptionalEnvWithDefault('SMTP_FROM', '');

// Modo de teste agora é lido do banco de dados
// const TEST_MODE = true; // REMOVIDO - buscar do banco

// ========================================
// Função para enviar via SMTP usando base64 encoding
// ========================================
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  try {
    log.info('Conectando SMTP', { host: SMTP_HOST, port: SMTP_PORT });
    
    // Para Deno Edge Functions, precisamos usar TLS direto
    // Porta 587 com STARTTLS não é bem suportada em edge functions
    // Vamos tentar conectar com TLS direto independente da porta
    let conn: Deno.TlsConn;
    
    try {
      // Tentar conexão TLS direta (funciona para 465 e alguns 587 com TLS)
      conn = await Deno.connectTls({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
      });
      log.info('Conexão TLS estabelecida');
    } catch (tlsError) {
      log.warn('TLS direto falhou, tentando conexão normal');
      // Se TLS falhar, usar conexão normal (menos segura, mas funciona)
      const tcpConn = await Deno.connect({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
      }) as Deno.TcpConn;
      
      // Helper para ler resposta
      async function readTcpResponse(): Promise<string> {
        const buffer = new Uint8Array(4096);
        const n = await tcpConn.read(buffer);
        if (n === null) return '';
        return decoder.decode(buffer.subarray(0, n));
      }
      
      // Ler banner
      await readTcpResponse();
      await tcpConn.write(encoder.encode(`EHLO ${SMTP_HOST}\r\n`));
      await readTcpResponse();
      await tcpConn.write(encoder.encode('STARTTLS\r\n'));
      const starttlsResp = await readTcpResponse();
      
      if (starttlsResp.startsWith('220')) {
        conn = await Deno.startTls(tcpConn, { hostname: SMTP_HOST });
        log.info('STARTTLS upgrade completo');
      } else {
        tcpConn.close();
        return { success: false, error: `STARTTLS não suportado: ${starttlsResp}` };
      }
    }
    
    // Helper para ler resposta
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      const n = await conn.read(buffer);
      if (n === null) return '';
      return decoder.decode(buffer.subarray(0, n));
    }
    
    // Helper para enviar comando
    async function sendCommand(cmd: string): Promise<string> {
      log.debug('SMTP >', { cmd: cmd.includes('AUTH') || cmd.length > 50 ? cmd.substring(0, 20) + '...' : cmd.trim() });
      await conn.write(encoder.encode(cmd + '\r\n'));
      const response = await readResponse();
      log.debug('SMTP <', { response: response.trim().substring(0, 100) });
      return response;
    }
    
    // Ler banner inicial (se conexão TLS direta)
    let response = await readResponse();
    log.debug('SMTP Banner', { banner: response.trim().substring(0, 100) });
    
    // EHLO
    response = await sendCommand(`EHLO ${SMTP_HOST}`);
    
    // AUTH LOGIN
    response = await sendCommand('AUTH LOGIN');
    if (response.startsWith('334')) {
      // Enviar username em base64
      const userB64 = btoa(SMTP_USER);
      response = await sendCommand(userB64);
      
      if (response.startsWith('334')) {
        // Enviar password em base64
        const passB64 = btoa(SMTP_PASS);
        response = await sendCommand(passB64);
      }
    }
    
    if (!response.startsWith('235')) {
      conn.close();
      return { success: false, error: `Autenticação falhou: ${response}` };
    }
    
    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${SMTP_FROM.replace(/.*<|>.*/g, '')}>`);
    if (!response.startsWith('250')) {
      conn.close();
      return { success: false, error: `MAIL FROM falhou: ${response}` };
    }
    
    // RCPT TO
    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      conn.close();
      return { success: false, error: `RCPT TO falhou: ${response}` };
    }
    
    // DATA
    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      conn.close();
      return { success: false, error: `DATA falhou: ${response}` };
    }
    
    // Construir mensagem MIME
    const boundary = `----=_Part_${Date.now()}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${SMTP_HOST}>`;
    
    const emailContent = [
      `From: ${SMTP_FROM}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      text || html.replace(/<[^>]*>/g, ''),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      `.`,
    ].join('\r\n');
    
    await conn.write(encoder.encode(emailContent + '\r\n'));
    response = await readResponse();
    log.debug('SMTP after DATA', { response: response.trim() });
    
    if (!response.startsWith('250')) {
      conn.close();
      return { success: false, error: `Envio falhou: ${response}` };
    }
    
    // QUIT
    await sendCommand('QUIT');
    conn.close();
    
    return { success: true, messageId };
    
  } catch (error) {
    log.error('Erro SMTP', { error: error instanceof Error ? error.message : String(error) });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro SMTP desconhecido' 
    };
  }
}

// ========================================
// Função Principal
// ========================================
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  log.info('Recebendo requisição');

  try {
    // Validar configurações SMTP
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      log.error('Configurações SMTP incompletas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configurações SMTP não configuradas',
        } as EmailSendResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse e validar body com Zod
    const rawBody = await req.json();
    const parsed = emailSendPayload.safeParse(rawBody);
    if (!parsed.success) {
      log.warn('Validação falhou', { errors: parsed.error.errors });
      return new Response(
        JSON.stringify({
          success: false,
          error: parsed.error.errors[0]?.message || 'Payload inválido',
        } as EmailSendResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parsed.data;
    log.info('Request', { to: body.to, subject: body.subject, lead_id: body.lead_id, empresa: body.empresa });

    // Inicializar Supabase para logging
    const supabase = createServiceClient();

    // Buscar configuração de modo teste do banco
    const { data: testConfig } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'email')
      .eq('key', 'modo_teste')
      .single();

    const TEST_MODE = (testConfig?.value as { ativo?: boolean; email_teste?: string })?.ativo ?? true;
    const TEST_EMAIL = (testConfig?.value as { ativo?: boolean; email_teste?: string })?.email_teste || 'admin@grupoblue.com.br';

    log.info('Modo teste', { ativo: TEST_MODE, email: TEST_MODE ? TEST_EMAIL : undefined });

    // Se modo teste, redirecionar email
    const finalTo = TEST_MODE ? TEST_EMAIL : body.to;

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
        log.error('Erro ao registrar mensagem', { error: msgError.message });
      } else {
        messageId = msgData?.id;
        log.info('Mensagem registrada', { messageId });
      }
    }

    // Modo de teste - simula envio
    if (TEST_MODE) {
      log.info('[TEST_MODE] Simulando envio de e-mail');
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
      log.info('[TEST_MODE] Concluído', { durationMs: duration });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: fakeMessageId,
        } as EmailSendResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar e-mail via SMTP
    log.info('Enviando via SMTP nativo');
    const result = await sendEmailViaSMTP(body.to, body.subject, body.html, body.text);
    
    if (result.success) {
      // Atualizar status para ENVIADO
      if (messageId) {
        await supabase
          .from('lead_messages')
          .update({
            estado: 'ENVIADO',
            enviado_em: new Date().toISOString(),
            email_message_id: result.messageId || `smtp-${Date.now()}`,
          })
          .eq('id', messageId);
      }

      const duration = Date.now() - startTime;
      log.info('Concluído', { durationMs: duration });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId,
        } as EmailSendResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Atualizar status para ERRO
      if (messageId) {
        await supabase
          .from('lead_messages')
          .update({
            estado: 'ERRO',
            erro_detalhe: result.error,
          })
          .eq('id', messageId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
        } as EmailSendResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    log.error('Erro geral', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      } as EmailSendResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
