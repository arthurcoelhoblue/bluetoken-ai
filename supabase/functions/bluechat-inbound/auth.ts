// ========================================
// bluechat-inbound/auth.ts — Autenticação do webhook (API key única)
// ========================================

import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('bluechat-inbound');

export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');

  const bluechatApiKey = getOptionalEnv('BLUECHAT_API_KEY');

  if (!bluechatApiKey) {
    log.error('BLUECHAT_API_KEY não configurada');
    return { valid: false };
  }

  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  log.debug('Auth check', {
    hasAuth: !!authHeader,
    hasApiKey: !!apiKeyHeader,
    tokenPreview: token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'NENHUM',
    tokenLength: token?.length || 0,
  });

  if (token && token.trim() === bluechatApiKey.trim()) {
    return { valid: true };
  }

  log.warn('Token inválido para Blue Chat');
  return { valid: false };
}
