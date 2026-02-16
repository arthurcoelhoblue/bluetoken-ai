/**
 * Testes Unitários: phone-utils
 * 
 * Testa as funções de normalização e validação de telefone
 * 
 * NOTA: Este arquivo testa a lógica que está em supabase/functions/_shared/phone-utils.ts
 * Como não podemos importar diretamente de Deno, replicamos a lógica aqui para teste.
 */

import { describe, it, expect } from 'vitest';

// ========================================
// Replicação das funções para teste
// ========================================

const DDI_CONHECIDOS = ['55', '1', '34', '351', '33', '49', '44', '39', '81', '86'];

const PLACEHOLDER_EMAILS_DEDUP = [
  'sememail@', 'sem-email@', 'noemail@', 'sem@', 'nao-informado@',
  'teste@teste', 'email@email', 'x@x', 'a@a',
  'placeholder', '@exemplo.', '@example.', 'test@test', 'nao@tem',
];

function isPlaceholderEmailForDedup(email: string | null): boolean {
  if (!email) return true;
  const lowered = email.trim().toLowerCase();
  return PLACEHOLDER_EMAILS_DEDUP.some(p => lowered.includes(p));
}

function generatePhoneVariationsForSearch(phone: string | null): string[] {
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

interface PhoneNormalized {
  e164: string;
  ddi: string;
  nacional: string;
  internacional: boolean;
}

function normalizePhoneE164(raw: string | null): PhoneNormalized | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;

  // Detectar sequências lixo (000000, 111111, 98989898, etc.)
  const uniqueDigits = new Set(digits.split(''));
  if (uniqueDigits.size <= 2) {
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
    return null; // Será marcado como DADO_SUSPEITO
  }

  return null;
}

// ========================================
// Testes
// ========================================

describe('phone-utils: Validação de Email Placeholder', () => {
  describe('isPlaceholderEmailForDedup', () => {
    it('deve identificar email null como placeholder', () => {
      expect(isPlaceholderEmailForDedup(null)).toBe(true);
    });

    it('deve identificar emails placeholder comuns', () => {
      const placeholders = [
        'sememail@example.com',
        'sem-email@test.com',
        'noemail@domain.com',
        'teste@teste.com',
        'email@email.com',
        'x@x.com',
        'a@a.com',
        'test@test.com',
      ];

      placeholders.forEach(email => {
        expect(isPlaceholderEmailForDedup(email)).toBe(true);
      });
    });

    it('deve aceitar emails válidos sem palavras placeholder', () => {
      const validEmails = [
        'joao.silva@company.com',
        'maria@empresa.com.br',
        'pedro.costa@startup.io',
      ];

      validEmails.forEach(email => {
        expect(isPlaceholderEmailForDedup(email)).toBe(false);
      });
    });

    it('deve ser case-insensitive', () => {
      expect(isPlaceholderEmailForDedup('SEMEMAIL@EXAMPLE.COM')).toBe(true);
      expect(isPlaceholderEmailForDedup('SemEmail@Example.Com')).toBe(true);
    });
  });
});

describe('phone-utils: Normalização de Telefone', () => {
  describe('normalizePhoneE164', () => {
    it('deve normalizar telefone brasileiro com DDI', () => {
      const result = normalizePhoneE164('+5511999887766');

      expect(result).not.toBeNull();
      expect(result?.e164).toBe('+5511999887766');
      expect(result?.ddi).toBe('55');
      expect(result?.nacional).toBe('11999887766');
      expect(result?.internacional).toBe(false);
    });

    it('deve normalizar telefone brasileiro sem DDI (11 dígitos)', () => {
      const result = normalizePhoneE164('11999887766');

      expect(result).not.toBeNull();
      expect(result?.e164).toBe('+5511999887766');
      expect(result?.ddi).toBe('55');
      expect(result?.nacional).toBe('11999887766');
    });

    it('deve normalizar telefone brasileiro sem DDI (10 dígitos)', () => {
      const result = normalizePhoneE164('1133334444');

      expect(result).not.toBeNull();
      expect(result?.e164).toBe('+551133334444');
      expect(result?.ddi).toBe('55');
      expect(result?.nacional).toBe('1133334444');
    });

    it('deve normalizar telefone com formatação', () => {
      const inputs = [
        '(11) 99988-7766',
        '11 9 9988-7766',
        '+55 11 99988-7766',
        '55 (11) 99988-7766',
      ];

      inputs.forEach(input => {
        const result = normalizePhoneE164(input);
        expect(result?.e164).toBe('+5511999887766');
      });
    });

    it('deve remover prefixo 00 de formato internacional antigo', () => {
      const result = normalizePhoneE164('005511999887766');

      expect(result).not.toBeNull();
      expect(result?.e164).toBe('+5511999887766');
    });

    it('deve rejeitar telefones muito curtos', () => {
      const invalid = ['123', '12345', '123456'];

      invalid.forEach(phone => {
        expect(normalizePhoneE164(phone)).toBeNull();
      });
    });

    it('deve rejeitar telefones lixo (sequências repetitivas)', () => {
      const lixo = [
        '00000000000',
        '11111111111',
        '98989898989',
        '12121212121',
      ];

      lixo.forEach(phone => {
        expect(normalizePhoneE164(phone)).toBeNull();
      });
    });

    it('deve processar telefones internacionais', () => {
      // A lógica atual prioriza DDI 55 (Brasil)
      // Telefones internacionais são tratados se começarem com DDI conhecido
      const result = normalizePhoneE164('+351211234567'); // Portugal
      expect(result).not.toBeNull();
      if (result) {
        expect(result.e164).toContain('+');
        expect(result.ddi).toBeDefined();
      }
    });

    it('deve retornar null para telefone null ou vazio', () => {
      expect(normalizePhoneE164(null)).toBeNull();
      expect(normalizePhoneE164('')).toBeNull();
      expect(normalizePhoneE164('   ')).toBeNull();
    });
  });
});

describe('phone-utils: Geração de Variações para Dedup', () => {
  describe('generatePhoneVariationsForSearch', () => {
    it('deve gerar variações para telefone com 9º dígito', () => {
      const variations = generatePhoneVariationsForSearch('11999887766');

      expect(variations).toContain('+5511999887766'); // Com DDI e 9º dígito
      expect(variations).toContain('+551199887766'); // Sem 9º dígito
      expect(variations.length).toBeGreaterThan(0);
    });

    it('deve gerar variações para telefone sem 9º dígito', () => {
      const variations = generatePhoneVariationsForSearch('1133334444');

      expect(variations).toContain('+551133334444'); // Original com DDI
      expect(variations).toContain('+5511933334444'); // Com 9º dígito adicionado
    });

    it('deve gerar variações para telefone já com DDI', () => {
      const variations = generatePhoneVariationsForSearch('+5511999887766');

      expect(variations).toContain('+5511999887766');
      expect(variations).toContain('+551199887766'); // Sem 9º dígito
    });

    it('deve retornar array vazio para telefone null', () => {
      expect(generatePhoneVariationsForSearch(null)).toEqual([]);
    });

    it('deve retornar array vazio para telefone muito curto', () => {
      expect(generatePhoneVariationsForSearch('123')).toEqual([]);
      expect(generatePhoneVariationsForSearch('1234567')).toEqual([]);
    });

    it('deve remover duplicatas das variações', () => {
      const variations = generatePhoneVariationsForSearch('11999887766');

      const uniqueVariations = [...new Set(variations)];
      expect(variations.length).toBe(uniqueVariations.length);
    });

    it('deve filtrar variações muito curtas (< 10 caracteres)', () => {
      const variations = generatePhoneVariationsForSearch('1199887766');

      variations.forEach(v => {
        expect(v.length).toBeGreaterThanOrEqual(10);
      });
    });
  });
});
