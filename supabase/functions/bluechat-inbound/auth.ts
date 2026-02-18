// ========================================
// bluechat-inbound/auth.ts — Autenticação do webhook (por empresa ou env fallback)
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveBluechatApiKey } from "../_shared/channel-resolver.ts";

const log = createLogger('bluechat-inbound');

/**
 * Validate webhook auth. Tries per-empresa api_key from system_settings first,
 * then falls back to BLUECHAT_API_KEY env.
 */
export async function validateAuthAsync(
  req: Request,
  supabase: SupabaseClient,
  empresa: string,
): Promise<{ valid: boolean }> {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (!token) {
    log.warn('Nenhum token recebido');
    return { valid: false };
  }

  // 1. Try per-empresa key from system_settings
  const expectedKey = await resolveBluechatApiKey(supabase, empresa);

  if (expectedKey && token.trim() === expectedKey.trim()) {
    return { valid: true };
  }

  // 2. Fallback: try env directly (covers case where resolveBluechatApiKey already tried env)
  const envKey = getOptionalEnv('BLUECHAT_API_KEY');
  if (envKey && token.trim() === envKey.trim()) {
    return { valid: true };
  }

  log.warn('Token inválido para Blue Chat', {
    empresa,
    tokenPreview: `${token.substring(0, 8)}...${token.substring(token.length - 4)}`,
  });
  return { valid: false };
}

/**
 * Legacy sync validation (kept for backward compat, uses env only).
 */
export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');

  const bluechatApiKey = getOptionalEnv('BLUECHAT_API_KEY');

  if (!bluechatApiKey) {
    // If no env key, we can't validate synchronously — caller should use validateAuthAsync
    log.warn('BLUECHAT_API_KEY não configurada no env, tentando validação assíncrona');
    return { valid: true }; // Allow through, async validation will handle it
  }

  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (token && token.trim() === bluechatApiKey.trim()) {
    return { valid: true };
  }

  log.warn('Token inválido para Blue Chat (sync)');
  return { valid: false };
}
