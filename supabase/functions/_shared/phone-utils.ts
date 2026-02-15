// ========================================
// _shared/phone-utils.ts — Utilitários de telefone e email para dedup
// ========================================

// DDIs conhecidos para validação
export const DDI_CONHECIDOS = ['55', '1', '34', '351', '33', '49', '44', '39', '81', '86'];

// Padrões de emails placeholder que devem ser ignorados na dedup
export const PLACEHOLDER_EMAILS_DEDUP = [
  'sememail@', 'sem-email@', 'noemail@', 'sem@', 'nao-informado@',
  'teste@teste', 'email@email', 'x@x', 'a@a',
  'placeholder', '@exemplo.', '@example.', 'test@test', 'nao@tem',
];

/**
 * Verifica se um email é placeholder e deve ser ignorado na dedup
 */
export function isPlaceholderEmailForDedup(email: string | null): boolean {
  if (!email) return true;
  const lowered = email.trim().toLowerCase();
  return PLACEHOLDER_EMAILS_DEDUP.some(p => lowered.includes(p));
}

/**
 * Gera variações de telefone para busca de duplicatas
 * Cobre com/sem DDI 55 e com/sem nono dígito
 */
export function generatePhoneVariationsForSearch(phone: string | null): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];

  const variations: string[] = [`+${digits}`];
  const withoutDDI = digits.startsWith('55') ? digits.slice(2) : digits;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);

  variations.push(`+55${withoutDDI}`);

  // Sem nono dígito → com nono dígito
  if (number.length === 8) {
    variations.push(`+55${ddd}9${number}`);
  }

  // Com nono dígito → sem nono dígito
  if (number.length === 9 && number.startsWith('9')) {
    variations.push(`+55${ddd}${number.slice(1)}`);
  }

  return [...new Set(variations.filter(v => v.length >= 10))];
}

/**
 * Resultado da normalização de telefone para E.164
 */
export interface PhoneNormalized {
  e164: string;
  ddi: string;
  nacional: string;
  internacional: boolean;
}

/**
 * Normaliza telefone para formato E.164
 * Retorna null se inválido ou lixo
 */
export function normalizePhoneE164(raw: string | null): PhoneNormalized | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;

  // Detectar sequências lixo (000000, 111111, 98989898, etc.)
  const uniqueDigits = new Set(digits.split(''));
  if (uniqueDigits.size <= 2) {
    console.log('[Sanitization] Telefone lixo detectado:', raw);
    return null;
  }

  // Remove 00 do início se presente (formato internacional antigo)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Processar DDI brasileiro
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return {
      e164: `+${digits}`,
      ddi: '55',
      nacional: digits.slice(2),
      internacional: false,
    };
  }

  // Assumir BR se 10-11 dígitos (DDD + número)
  if (digits.length === 10 || digits.length === 11) {
    return {
      e164: `+55${digits}`,
      ddi: '55',
      nacional: digits,
      internacional: false,
    };
  }

  // Verificar DDIs conhecidos
  for (const ddi of DDI_CONHECIDOS) {
    if (digits.startsWith(ddi) && digits.length > ddi.length + 6) {
      return {
        e164: `+${digits}`,
        ddi,
        nacional: digits.slice(ddi.length),
        internacional: ddi !== '55',
      };
    }
  }

  // Se ainda tem tamanho razoável, marca como internacional desconhecido
  if (digits.length >= 10) {
    console.log('[Sanitization] DDI não reconhecido, marcando como suspeito:', raw);
    return null; // Será marcado como DADO_SUSPEITO
  }

  return null;
}
