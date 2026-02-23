// ========================================
// bluechat-inbound/auth.ts — Autenticação do webhook (por empresa ou env fallback)
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveBluechatWebhookSecret, resolveAllWebhookSecrets } from "../_shared/channel-resolver.ts";

const log = createLogger('bluechat-inbound');

/**
 * Validate webhook auth async. Supports three methods:
 * 1. Bearer token / X-API-Key (direct comparison)
 * 2. x-webhook-signature (HMAC-SHA256 of body)
 * 3. Fallback to BLUECHAT_API_KEY env
 */
export async function validateAuthAsync(
  req: Request,
  supabase: SupabaseClient,
  empresa: string,
  bodyText?: string,
): Promise<{ valid: boolean }> {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const webhookSignature = req.headers.get('x-webhook-signature');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  // Method 1: Direct token (Authorization/X-API-Key)
  if (token) {
    const expectedSecret = await resolveBluechatWebhookSecret(supabase, empresa);
    if (expectedSecret && token.trim() === expectedSecret.trim()) {
      return { valid: true };
    }

    // Cross-check: try secrets from ALL registered companies
    const allSecrets = await resolveAllWebhookSecrets(supabase);
    for (const [emp, secret] of allSecrets) {
      if (secret && token.trim() === secret.trim()) {
        log.info('Token validado via cross-empresa', { payloadEmpresa: empresa, tokenEmpresa: emp });
        return { valid: true };
      }
    }

    const envKey = getOptionalEnv('BLUECHAT_API_KEY');
    if (envKey && token.trim() === envKey.trim()) {
      return { valid: true };
    }
  }

  // Method 2: HMAC signature (x-webhook-signature)
  if (webhookSignature && bodyText) {
    // Try empresa-specific secret first
    const secret = await resolveBluechatWebhookSecret(supabase, empresa);
    if (secret) {
      const computed = await computeHmac(secret, bodyText);
      if (computed === webhookSignature) {
        log.info('Autenticação HMAC validada com sucesso', { empresa });
        return { valid: true };
      }
    }

    // Cross-check HMAC against all company secrets
    const allSecrets = await resolveAllWebhookSecrets(supabase);
    for (const [emp, s] of allSecrets) {
      if (!s) continue;
      const computed = await computeHmac(s, bodyText);
      if (computed === webhookSignature) {
        log.info('HMAC validado via cross-empresa', { payloadEmpresa: empresa, tokenEmpresa: emp });
        return { valid: true };
      }
    }

    // Fallback env HMAC
    const envKey = getOptionalEnv('BLUECHAT_API_KEY');
    if (envKey) {
      const computed = await computeHmac(envKey, bodyText);
      if (computed === webhookSignature) {
        log.info('HMAC validado via env fallback', { empresa });
        return { valid: true };
      }
    }

    log.warn('HMAC signature não confere com nenhum secret', { empresa });
  }

  // No valid method
  if (token) {
    log.warn('Token inválido para Blue Chat (nenhum match cross-empresa)', {
      empresa,
      tokenPreview: `${token.substring(0, 8)}...${token.substring(token.length - 4)}`,
    });
  }
  return { valid: false };
}

/** Compute HMAC-SHA256 hex digest */
async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sync validation — checks if ANY auth method is present.
 * The actual secret/HMAC validation is done in validateAuthAsync.
 */
export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const webhookSignature = req.headers.get('x-webhook-signature');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (!token && !webhookSignature) {
    log.warn('Nenhum token recebido na requisição Blue Chat');
    return { valid: false };
  }

  // Pass through — real validation in validateAuthAsync
  return { valid: true };
}
