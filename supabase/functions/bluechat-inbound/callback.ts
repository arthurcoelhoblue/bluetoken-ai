// ========================================
// bluechat-inbound/callback.ts — Envio de resposta ao Blue Chat
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { EmpresaTipo } from "../_shared/types.ts";

const log = createLogger('bluechat-inbound');

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
  }
): Promise<void> {
  try {
    // Buscar URL da API do Blue Chat por empresa em system_settings
    const settingsKey = data.empresa === 'BLUE' ? 'bluechat_blue' : 'bluechat_tokeniza';
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

    // Usar API key correta por empresa
    const bluechatApiKey = data.empresa === 'BLUE'
      ? getOptionalEnv('BLUECHAT_API_KEY_BLUE')
      : getOptionalEnv('BLUECHAT_API_KEY');
    if (!bluechatApiKey) {
      log.warn(`BLUECHAT_API_KEY não configurada para ${data.empresa}`);
      return;
    }

    const baseUrl = apiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': bluechatApiKey,
    };

    // 1. Enviar mensagem de resposta via POST /messages
    const messagesUrl = `${baseUrl}/messages`;
    log.info('Enviando mensagem para Blue Chat', { url: messagesUrl });

    const msgResponse = await fetch(messagesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversation_id: data.conversation_id,
        content: data.text,
        source: 'AMELIA_SDR',
      }),
    });

    if (!msgResponse.ok) {
      log.error('Erro ao enviar mensagem', { status: msgResponse.status });
    } else {
      log.info('Mensagem enviada ao Blue Chat com sucesso');
    }

    // 2. Se ação é ESCALATE, transferir o ticket para humano
    if (data.action === 'ESCALATE' && data.ticket_id) {
      const transferUrl = `${baseUrl}/tickets/${data.ticket_id}/transfer`;
      log.info('Transferindo ticket', { url: transferUrl, department: data.department || 'Comercial' });

      const transferResponse = await fetch(transferUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: 'Lead qualificado - escalar para closer',
          source: 'AMELIA_SDR',
          department: data.department || 'Comercial',
        }),
      });

      if (!transferResponse.ok) {
        log.error('Erro ao transferir ticket', { status: transferResponse.status });
      } else {
        log.info('Ticket transferido com sucesso', { department: data.department || 'Comercial' });
      }
    }

    // 3. Se ação é RESOLVE, resolver o ticket no Blue Chat
    if (data.action === 'RESOLVE' && data.ticket_id && data.resolution) {
      const resolveUrl = `${baseUrl}/tickets/${data.ticket_id}/resolve`;
      log.info('Resolvendo ticket', { url: resolveUrl });

      const resolveResponse = await fetch(resolveUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summary: data.resolution.summary,
          reason: data.resolution.reason,
          source: 'AMELIA_SDR',
        }),
      });

      if (!resolveResponse.ok) {
        log.error('Erro ao resolver ticket', { status: resolveResponse.status });
      } else {
        log.info('Ticket resolvido com sucesso');
      }
    }
  } catch (error) {
    // Não bloqueia o fluxo principal
    log.error('Erro ao enviar callback', { error: error instanceof Error ? error.message : String(error) });
  }
}
