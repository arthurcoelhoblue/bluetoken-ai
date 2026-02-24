export const BLUECHAT_BASE_URL = 'https://chat.grupoblue.com.br';

export const EMPRESA_TO_SLUG: Record<string, string> = {
  TOKENIZA: 'tokeniza',
  BLUE: 'blue-consult',
  MPUPPE: 'mpuppe',
  AXIA: 'axia',
};

/**
 * Build a deep link to open an existing conversation in Blue Chat by ticket/conversation ID.
 * Falls back to phone-based link if no conversation ID is available.
 */
export function buildBluechatDeepLink(
  empresa: string,
  telefone: string,
  bluechatConversationId?: string | null,
): string | null {
  const slug = EMPRESA_TO_SLUG[empresa];
  if (!slug) return null;

  // Always use phone-based format (only one supported by Blue Chat)
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${BLUECHAT_BASE_URL}/open/${slug}/${digits}`;
}
