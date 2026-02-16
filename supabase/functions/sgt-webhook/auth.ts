// ========================================
// sgt-webhook/auth.ts — Autenticação do webhook
// Extraído do index.ts (Fase D)
// ========================================

import { createLogger } from '../_shared/logger.ts';

const log = createLogger('sgt-webhook/auth');

export function validateWebhookToken(req: Request): boolean {
  const secret = Deno.env.get('SGT_WEBHOOK_SECRET');
  if (!secret) {
    log.error('SGT_WEBHOOK_SECRET não configurado');
    return false;
  }

  // 1. Prioridade: x-webhook-secret (não é interceptado pelo platform)
  const webhookSecret = req.headers.get('x-webhook-secret');
  if (webhookSecret) {
    log.info('Autenticando via x-webhook-secret');
    return webhookSecret === secret;
  }

  // 2. Fallback: Authorization Bearer (pode ser interceptado pelo Lovable Cloud)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      log.info('Autenticando via Authorization Bearer (fallback)');
      return match[1] === secret;
    }
  }

  log.error('Nenhum token de autenticação encontrado (x-webhook-secret ou Authorization)');
  return false;
}
