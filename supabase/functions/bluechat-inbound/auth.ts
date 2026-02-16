// ========================================
// bluechat-inbound/auth.ts — Autenticação do webhook
// ========================================

import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { EmpresaTipo } from "../_shared/types.ts";

const log = createLogger('bluechat-inbound');

export function validateAuth(req: Request): { valid: boolean; empresaFromKey?: EmpresaTipo } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');

  const bluechatApiKeyTokeniza = getOptionalEnv('BLUECHAT_API_KEY');
  const bluechatApiKeyBlue = getOptionalEnv('BLUECHAT_API_KEY_BLUE');

  if (!bluechatApiKeyTokeniza && !bluechatApiKeyBlue) {
    log.error('Nenhuma BLUECHAT_API_KEY configurada');
    return { valid: false };
  }

  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  log.debug('Auth check', {
    hasAuth: !!authHeader,
    hasApiKey: !!apiKeyHeader,
    tokenPreview: token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'NENHUM',
    tokenLength: token?.length || 0,
  });

  if (token && bluechatApiKeyTokeniza && token.trim() === bluechatApiKeyTokeniza.trim()) {
    return { valid: true, empresaFromKey: 'TOKENIZA' };
  }

  if (token && bluechatApiKeyBlue && token.trim() === bluechatApiKeyBlue.trim()) {
    return { valid: true, empresaFromKey: 'BLUE' };
  }

  log.warn('Token inválido para Blue Chat');
  return { valid: false };
}
