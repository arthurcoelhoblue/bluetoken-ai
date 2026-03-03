/**
 * Formata um número de telefone brasileiro para o padrão +55 (DDD) XXXXX-XXXX
 * Aceita números com ou sem código de país, com ou sem formatação prévia.
 *
 * Exemplos de entrada → saída:
 *   "5511999887766"      → "+55 (11) 99988-7766"
 *   "+5511999887766"     → "+55 (11) 99988-7766"
 *   "11999887766"        → "+55 (11) 99988-7766"
 *   "999887766"          → "+55 (99) 98877-66" (fallback, trata como DDD + número)
 *   "551134567890"       → "+55 (11) 3456-7890" (fixo 8 dígitos)
 *   qualquer outro       → retorna original sem alteração
 */
export function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return '';

  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '');

  let ddd: string;
  let number: string;

  if (digits.startsWith('55') && digits.length >= 12) {
    // Com código de país: 55 + DDD(2) + número(8-9)
    ddd = digits.slice(2, 4);
    number = digits.slice(4);
  } else if (digits.length >= 10 && digits.length <= 11) {
    // Sem código de país: DDD(2) + número(8-9)
    ddd = digits.slice(0, 2);
    number = digits.slice(2);
  } else {
    // Formato não reconhecido — retorna original
    return raw;
  }

  // Formata o número local
  if (number.length === 9) {
    // Celular: XXXXX-XXXX
    return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  } else if (number.length === 8) {
    // Fixo: XXXX-XXXX
    return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  // Fallback
  return raw;
}

/**
 * Exibe o número formatado para display, mantendo o raw para discagem.
 * Útil em inputs onde o valor interno é o raw mas o display é formatado.
 */
export function displayPhone(raw: string | null | undefined): string {
  return formatPhoneBR(raw);
}
