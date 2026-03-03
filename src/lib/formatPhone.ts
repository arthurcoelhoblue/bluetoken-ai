/**
 * Format a Brazilian phone number for display.
 * Input: raw digits like "5511999887766" or "11999887766"
 * Output: "+55 (11) 99988-7766" or "(11) 99988-7766"
 */
export function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');

  // +55 DD XXXXX-XXXX (13 digits)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // DD XXXXX-XXXX (11 digits, mobile)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // DD XXXX-XXXX (10 digits, landline)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // Fallback: return as-is
  return raw;
}
