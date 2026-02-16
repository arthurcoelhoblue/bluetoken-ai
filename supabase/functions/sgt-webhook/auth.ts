// ========================================
// sgt-webhook/auth.ts — Autenticação do webhook
// Extraído do index.ts (Fase D)
// ========================================

export function validateWebhookToken(req: Request): boolean {
  const secret = Deno.env.get('SGT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[SGT Webhook] SGT_WEBHOOK_SECRET não configurado');
    return false;
  }

  // 1. Prioridade: x-webhook-secret (não é interceptado pelo platform)
  const webhookSecret = req.headers.get('x-webhook-secret');
  if (webhookSecret) {
    console.log('[SGT Webhook] Autenticando via x-webhook-secret');
    return webhookSecret === secret;
  }

  // 2. Fallback: Authorization Bearer (pode ser interceptado pelo Lovable Cloud)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      console.log('[SGT Webhook] Autenticando via Authorization Bearer (fallback)');
      return match[1] === secret;
    }
  }

  console.error('[SGT Webhook] Nenhum token de autenticação encontrado (x-webhook-secret ou Authorization)');
  return false;
}
