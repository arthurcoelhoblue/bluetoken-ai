export const BLUECHAT_BASE_URL = 'https://chat.grupoblue.com.br';

export const EMPRESA_TO_SLUG: Record<string, string> = {
  TOKENIZA: 'tokeniza',
  BLUE: 'blue-consult',
  MPUPPE: 'mpuppe',
  AXIA: 'axia',
};

export function buildBluechatDeepLink(empresa: string, telefone: string): string | null {
  const slug = EMPRESA_TO_SLUG[empresa];
  if (!slug || !telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${BLUECHAT_BASE_URL}/open/${slug}/${digits}`;
}
