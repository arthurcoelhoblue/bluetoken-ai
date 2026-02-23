// ========================================
// bluechat-inbound/callback.ts — Envio de resposta ao Blue Chat
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { EmpresaTipo } from "../_shared/types.ts";

const log = createLogger('bluechat-inbound');

/** Retry helper com backoff exponencial (apenas para erros 5xx) */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  label = 'request'
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.ok || response.status < 500) {
      return response;
    }

    lastResponse = response;

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
      log.warn(`${label}: tentativa ${attempt + 1} falhou com ${response.status}, retry em ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return lastResponse!;
}

/** Loga detalhes do erro de uma resposta HTTP */
async function logResponseError(response: Response, label: string): Promise<void> {
  try {
    const body = await response.text();
    log.error(`${label} falhou`, {
      status: response.status,
      statusText: response.statusText,
      responseBody: body.substring(0, 500),
    });
  } catch {
    log.error(`${label} falhou`, { status: response.status });
  }
}

/**
 * Envia resposta de volta ao Blue Chat via API (callback assíncrono)
 */
export async function sendResponseToBluechat(
  supabase: SupabaseClient,
  data: {
    conversation_id: string;
    ticket_id?: string;
    message_id: string;
    text: string;
    action: string;
    resolution?: { summary: string; reason: string };
    empresa: EmpresaTipo;
    department?: string | null;
    phone?: string;
  }
): Promise<void> {
  try {
    // Buscar URL da API do Blue Chat por empresa em system_settings
    const SETTINGS_KEY_MAP: Record<string, string> = {
      'BLUE': 'bluechat_blue',
      'TOKENIZA': 'bluechat_tokeniza',
      'MPUPPE': 'bluechat_mpuppe',
      'AXIA': 'bluechat_axia',
    };
    const settingsKey = SETTINGS_KEY_MAP[data.empresa] || 'bluechat_tokeniza';
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', settingsKey)
      .maybeSingle();

    // Fallback para config legada 'bluechat' se não encontrar config por empresa
    let apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
    if (!apiUrl) {
      const { data: legacySetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'integrations')
        .eq('key', 'bluechat')
        .maybeSingle();
      apiUrl = (legacySetting?.value as Record<string, unknown>)?.api_url as string | undefined;
    }

    if (!apiUrl) {
      log.warn(`URL da API Blue Chat não configurada para ${data.empresa}`);
      return;
    }

    // API key por empresa (buscar do settings, fallback para env)
    const settingValue = (setting?.value as Record<string, unknown>);
    let bluechatApiKey = settingValue?.api_key as string | undefined;
    if (!bluechatApiKey) {
      // Fallback para env (compatibilidade)
      bluechatApiKey = getOptionalEnv('BLUECHAT_API_KEY') || undefined;
    }
    if (!bluechatApiKey) {
      log.warn(`API Key do Blue Chat não configurada para ${data.empresa}`);
      return;
    }

    log.info('Callback Blue Chat iniciado', {
      empresa: data.empresa,
      keyPreview: `${bluechatApiKey.substring(0, 6)}...${bluechatApiKey.substring(bluechatApiKey.length - 4)}`,
      apiUrl: apiUrl.substring(0, 50),
    });

    const baseUrl = apiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': bluechatApiKey,
    };

    // 1. Enviar mensagem de resposta via POST /messages
    const messagesUrl = `${baseUrl}/messages`;
    log.info('Enviando mensagem para Blue Chat', { url: messagesUrl });

    const msgResponse = await fetchWithRetry(
      messagesUrl,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversation_id: data.conversation_id,
          ticketId: data.ticket_id || data.conversation_id,
          content: data.text,
          source: 'AMELIA_SDR',
          phone: data.phone,
        }),
      },
      2,
      'POST /messages'
    );

    if (!msgResponse.ok) {
      await logResponseError(msgResponse, 'POST /messages');
    } else {
      log.info('Mensagem enviada ao Blue Chat com sucesso');
    }

    // 2. Se ação é ESCALATE, transferir o ticket para humano
    if (data.action === 'ESCALATE' && data.ticket_id) {
      const transferUrl = `${baseUrl}/tickets/${data.ticket_id}/transfer`;
      log.info('Transferindo ticket', { url: transferUrl, department: data.department || 'Comercial' });

      const transferResponse = await fetchWithRetry(
        transferUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reason: 'Lead qualificado - escalar para closer',
            source: 'AMELIA_SDR',
            department: data.department || 'Comercial',
          }),
        },
        2,
        'POST /tickets/transfer'
      );

      if (!transferResponse.ok) {
        await logResponseError(transferResponse, 'POST /tickets/transfer');
      } else {
        log.info('Ticket transferido com sucesso', { department: data.department || 'Comercial' });
      }
    }

    // 3. Se ação é RESOLVE, resolver o ticket no Blue Chat
    if (data.action === 'RESOLVE' && data.ticket_id && data.resolution) {
      const resolveUrl = `${baseUrl}/tickets/${data.ticket_id}/resolve`;
      log.info('Resolvendo ticket', { url: resolveUrl });

      const resolveResponse = await fetchWithRetry(
        resolveUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            summary: data.resolution.summary,
            reason: data.resolution.reason,
            source: 'AMELIA_SDR',
          }),
        },
        2,
        'POST /tickets/resolve'
      );

      if (!resolveResponse.ok) {
        await logResponseError(resolveResponse, 'POST /tickets/resolve');
      } else {
        log.info('Ticket resolvido com sucesso');
      }
    }
  } catch (error) {
    // Não bloqueia o fluxo principal
    log.error('Erro ao enviar callback', { error: error instanceof Error ? error.message : String(error) });
  }
}
