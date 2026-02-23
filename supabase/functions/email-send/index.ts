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

interface SmtpConfig {
  host: string;
  port: number;
  fromHeader: string;
  replyTo?: string;
}

// ========================================
// Secrets (fallback apenas)
// ========================================
const SMTP_HOST_SECRET = getOptionalEnvWithDefault('SMTP_HOST', '');
const SMTP_PORT_SECRET = parseInt(getOptionalEnvWithDefault('SMTP_PORT', '587'));
const SMTP_USER = getOptionalEnvWithDefault('SMTP_USER', '');
const SMTP_PASS = getOptionalEnvWithDefault('SMTP_PASS', '');
const SMTP_FROM_SECRET = getOptionalEnvWithDefault('SMTP_FROM', '');

// ========================================
// Resolver configuração SMTP (banco > secrets)
// ========================================
function resolveSmtpConfig(dbSmtp: Record<string, unknown> | null): SmtpConfig {
  const host = (dbSmtp?.host as string) || SMTP_HOST_SECRET;
  const port = (dbSmtp?.port as number) || SMTP_PORT_SECRET;
  const fromName = (dbSmtp?.from_name as string) || 'Blue CRM';
  const fromEmail = (dbSmtp?.from_email as string) || SMTP_FROM_SECRET;
  const replyTo = (dbSmtp?.reply_to as string) || undefined;

  // Montar header From com nome
  const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  return { host, port, fromHeader, replyTo };
}

// ========================================
// Função para enviar via SMTP usando base64 encoding
// ========================================
async function sendEmailViaSMTP(
  smtpCfg: SmtpConfig,
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  try {
    log.info('Conectando SMTP', { host: smtpCfg.host, port: smtpCfg.port });
    
    let conn: Deno.TlsConn;
    
    try {
      conn = await Deno.connectTls({
        hostname: smtpCfg.host,
        port: smtpCfg.port,
      });
      log.info('Conexão TLS estabelecida');
    } catch (tlsError) {
      log.warn('TLS direto falhou, tentando conexão normal');
      const tcpConn = await Deno.connect({
        hostname: smtpCfg.host,
        port: smtpCfg.port,
      }) as Deno.TcpConn;
      
      async function readTcpResponse(): Promise<string> {
        const buffer = new Uint8Array(4096);
        const n = await tcpConn.read(buffer);
        if (n === null) return '';
        return decoder.decode(buffer.subarray(0, n));
      }
      
      await readTcpResponse();
      await tcpConn.write(encoder.encode(`EHLO ${smtpCfg.host}\r\n`));
      await readTcpResponse();
      await tcpConn.write(encoder.encode('STARTTLS\r\n'));
      const starttlsResp = await readTcpResponse();
      
      if (starttlsResp.startsWith('220')) {
        conn = await Deno.startTls(tcpConn, { hostname: smtpCfg.host });
        log.info('STARTTLS upgrade completo');
      } else {
        tcpConn.close();
        return { success: false, error: `STARTTLS não suportado: ${starttlsResp}` };
      }
    }
    
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      const n = await conn.read(buffer);
      if (n === null) return '';
      return decoder.decode(buffer.subarray(0, n));
    }
    
    async function sendCommand(cmd: string): Promise<string> {
      log.debug('SMTP >', { cmd: cmd.includes('AUTH') || cmd.length > 50 ? cmd.substring(0, 20) + '...' : cmd.trim() });
      await conn.write(encoder.encode(cmd + '\r\n'));
      const response = await readResponse();
      log.debug('SMTP <', { response: response.trim().substring(0, 100) });
      return response;
    }
    
    let response = await readResponse();
    log.debug('SMTP Banner', { banner: response.trim().substring(0, 100) });
    
    response = await sendCommand(`EHLO ${smtpCfg.host}`);
    
    // AUTH LOGIN
    response = await sendCommand('AUTH LOGIN');
    if (response.startsWith('334')) {
      const userB64 = btoa(SMTP_USER);
      response = await sendCommand(userB64);
      
      if (response.startsWith('334')) {
        const passB64 = btoa(SMTP_PASS);
        response = await sendCommand(passB64);
      }
    }
    
    if (!response.startsWith('235')) {
      conn.close();
      return { success: false, error: `Autenticação falhou: ${response}` };
    }
    
    // Extrair apenas o email do fromHeader para MAIL FROM
    const fromEmailOnly = smtpCfg.fromHeader.replace(/.*<|>.*/g, '');
    
    response = await sendCommand(`MAIL FROM:<${fromEmailOnly}>`);
    if (!response.startsWith('250')) {
      conn.close();
      return { success: false, error: `MAIL FROM falhou: ${response}` };
    }
    
    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      conn.close();
      return { success: false, error: `RCPT TO falhou: ${response}` };
    }
    
    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      conn.close();
      return { success: false, error: `DATA falhou: ${response}` };
    }
    
    const boundary = `----=_Part_${Date.now()}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${smtpCfg.host}>`;
    
    const headers = [
      `From: ${smtpCfg.fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    // Adicionar Reply-To se configurado
    if (smtpCfg.replyTo) {
      headers.push(`Reply-To: ${smtpCfg.replyTo}`);
    }

    const emailContent = [
      ...headers,
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  log.info('Recebendo requisição');

  try {
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

    // Inicializar Supabase
    const supabase = createServiceClient();

    // ========================================
    // Buscar configurações do banco
    // ========================================
    const [testConfigResult, smtpDbResult] = await Promise.all([
      supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'email')
        .eq('key', 'modo_teste')
        .single(),
      supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'email')
        .eq('key', 'smtp_config')
        .single(),
    ]);

    const testConfig = testConfigResult.data;
    const smtpDbConfig = smtpDbResult.data;

    const TEST_MODE = (testConfig?.value as { ativo?: boolean; email_teste?: string })?.ativo ?? true;
    const TEST_EMAIL = (testConfig?.value as { ativo?: boolean; email_teste?: string })?.email_teste || 'admin@grupoblue.com.br';

    const dbSmtp = (smtpDbConfig?.value as Record<string, unknown>) ?? null;
    const smtpCfg = resolveSmtpConfig(dbSmtp);

    log.info('Config resolvida', {
      host: smtpCfg.host,
      port: smtpCfg.port,
      from: smtpCfg.fromHeader,
      replyTo: smtpCfg.replyTo,
      testMode: TEST_MODE,
    });

    // Validar que temos config SMTP mínima
    if (!smtpCfg.host || !SMTP_USER || !SMTP_PASS || !smtpCfg.fromHeader) {
      log.error('Configurações SMTP incompletas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configurações SMTP não configuradas',
        } as EmailSendResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // Validar limite diário (max_per_day)
    // ========================================
    const maxPerDay = (dbSmtp?.max_per_day as number) || 0;
    if (maxPerDay > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count, error: countError } = await supabase
        .from('lead_messages')
        .select('id', { count: 'exact', head: true })
        .eq('canal', 'EMAIL')
        .eq('direcao', 'OUTBOUND')
        .eq('estado', 'ENVIADO')
        .gte('enviado_em', todayStart.toISOString());

      if (!countError && count !== null && count >= maxPerDay) {
        log.warn('Limite diário atingido', { count, maxPerDay });
        return new Response(
          JSON.stringify({
            success: false,
            error: `Limite diário de ${maxPerDay} e-mails atingido (${count} enviados hoje)`,
          } as EmailSendResponse),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========================================
    // Validar intervalo mínimo (interval_seconds)
    // ========================================
    const intervalSeconds = (dbSmtp?.interval_seconds as number) || 0;
    if (intervalSeconds > 0) {
      const minTime = new Date(Date.now() - intervalSeconds * 1000).toISOString();

      const { data: recentMsg } = await supabase
        .from('lead_messages')
        .select('enviado_em')
        .eq('canal', 'EMAIL')
        .eq('direcao', 'OUTBOUND')
        .eq('estado', 'ENVIADO')
        .gte('enviado_em', minTime)
        .order('enviado_em', { ascending: false })
        .limit(1)
        .single();

      if (recentMsg) {
        const waitSec = Math.ceil(intervalSeconds - (Date.now() - new Date(recentMsg.enviado_em).getTime()) / 1000);
        log.warn('Intervalo mínimo não respeitado', { intervalSeconds, waitSec });
        return new Response(
          JSON.stringify({
            success: false,
            error: `Intervalo mínimo entre e-mails: aguarde ${waitSec}s`,
          } as EmailSendResponse),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se modo teste, redirecionar email
    const finalTo = TEST_MODE ? TEST_EMAIL : body.to;
    log.info('Modo teste', { ativo: TEST_MODE, email: TEST_MODE ? TEST_EMAIL : undefined });

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
          simulated: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar e-mail via SMTP com config do banco
    log.info('Enviando via SMTP nativo');
    const result = await sendEmailViaSMTP(smtpCfg, finalTo, body.subject, body.html, body.text);
    
    if (result.success) {
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
