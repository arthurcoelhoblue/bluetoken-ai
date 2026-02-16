// ========================================
// bluechat-inbound/sdr-bridge.ts — Chamada ao SDR IA Interpret
// ========================================

import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { TriageSummary } from "./types.ts";

const log = createLogger('bluechat-inbound');

/**
 * Chama SDR IA para interpretar a mensagem
 */
export async function callSdrIaInterpret(
  messageId: string,
  triageSummary?: TriageSummary | null
): Promise<{
  intent: string;
  confidence: number;
  leadReady: boolean;
  responseText?: string;
  escalation?: { needed: boolean; reason?: string; priority?: string };
  departamento_destino?: string | null;
} | null> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.info(`Chamando SDR IA (tentativa ${attempt + 1}/${MAX_RETRIES + 1})`, {
        messageId,
        temTriagem: !!triageSummary,
      });

      const requestBody: Record<string, unknown> = {
        messageId,
        source: 'BLUECHAT',
        mode: 'PASSIVE_CHAT',
      };

      if (triageSummary) {
        requestBody.triageSummary = {
          clienteNome: triageSummary.clienteNome,
          email: triageSummary.email,
          resumoTriagem: triageSummary.resumoTriagem,
          historico: triageSummary.historico,
        };
      }

      const response = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/sdr-ia-interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        log.info('SDR IA resultado', { intent: result.intent, confidence: result.confidence });

        return {
          intent: result.intent || 'OUTRO',
          confidence: result.confidence || 0.5,
          leadReady: result.leadReady || false,
          responseText: result.responseText,
          escalation: result.escalation,
          departamento_destino: result.departamento_destino || null,
        };
      }

      log.error(`SDR IA erro (tentativa ${attempt + 1})`, { status: response.status });
      if (attempt < MAX_RETRIES && [500, 502, 503, 504].includes(response.status)) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return null;
    } catch (error) {
      log.error(`SDR IA exceção (tentativa ${attempt + 1})`, { error: error instanceof Error ? error.message : String(error) });
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}
