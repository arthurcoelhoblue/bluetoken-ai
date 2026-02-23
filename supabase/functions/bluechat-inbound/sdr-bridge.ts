// ========================================
// bluechat-inbound/sdr-bridge.ts — Chamada ao SDR IA Interpret
// ========================================

import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { TriageSummary } from "./types.ts";

const log = createLogger('bluechat-inbound');

export interface SdrIaResult {
  intent: string;
  confidence: number;
  leadReady: boolean;
  responseText?: string;
  escalation?: { needed: boolean; reason?: string; priority?: string };
  departamento_destino?: string | null;
}

export interface SdrIaError {
  kind: 'infra_unavailable' | 'timeout' | 'client_error';
  status?: number;
  message: string;
}

export type SdrIaResponse =
  | { ok: true; data: SdrIaResult }
  | { ok: false; error: SdrIaError };

/**
 * Chama SDR IA para interpretar a mensagem.
 * Retorna resultado estruturado com distinção entre falha de infra vs. conteúdo.
 */
export async function callSdrIaInterpret(
  messageId: string,
  triageSummary?: TriageSummary | null
): Promise<SdrIaResponse> {
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
          ok: true,
          data: {
            intent: result.intent || 'OUTRO',
            confidence: result.confidence || 0.5,
            leadReady: result.leadReady || false,
            responseText: result.responseText,
            escalation: result.escalation,
            departamento_destino: result.departamento_destino || null,
          },
        };
      }

      log.error(`SDR IA erro (tentativa ${attempt + 1})`, { status: response.status, messageId });
      if (attempt < MAX_RETRIES && [500, 502, 503, 504].includes(response.status)) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      // Distinguish infra errors from client errors
      const kind = response.status >= 500 ? 'infra_unavailable' : 'client_error';
      return { ok: false, error: { kind, status: response.status, message: `SDR IA returned ${response.status}` } };
    } catch (error) {
      log.error(`SDR IA exceção (tentativa ${attempt + 1})`, { error: error instanceof Error ? error.message : String(error), messageId });
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return { ok: false, error: { kind: 'timeout', message: error instanceof Error ? error.message : String(error) } };
    }
  }
  return { ok: false, error: { kind: 'infra_unavailable', message: 'All retries exhausted' } };
}
