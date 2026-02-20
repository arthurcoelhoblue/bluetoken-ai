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
 * Legacy sync validation (kept for backward compat).
 * IMPORTANT: Only checks if a token is present. The actual secret validation
 * is always done asynchronously in validateAuthAsync (per-company lookup).
 * This avoids rejecting requests with company-specific keys when BLUECHAT_API_KEY
 * env var exists but holds a different (generic) value.
 */
export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (!token) {
    log.warn('Nenhum token recebido na requisição Blue Chat');
    return { valid: false };
  }

  // Always pass through — the real validation is done in validateAuthAsync
  // which checks per-company api_key stored in system_settings first,
  // then falls back to BLUECHAT_API_KEY env.
  return { valid: true };
}
