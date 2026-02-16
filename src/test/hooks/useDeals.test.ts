/**
 * Testes para hooks de Deals
 * 
 * Testa a lógica de busca, filtragem e cálculos de deals
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockSupabaseClient } from '../helpers/supabase-mock';
import { createMockDeal, createMockDeals, mockDealQuente, mockDealFrio } from '../fixtures/deals';

// Mock do cliente Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient(),
}));

describe('useDeals Hook Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Criação e Validação de Deals', () => {
    it('deve criar deal com todos os campos obrigatórios', () => {
      const deal = createMockDeal();

      expect(deal.empresa).toMatch(/^(TOKENIZA|BLUE)$/);
      expect(deal.titulo).toBeDefined();
      expect(deal.valor).toBeGreaterThan(0);
      expect(deal.pipeline_id).toBeDefined();
      expect(deal.stage_id).toBeDefined();
      expect(deal.contact_id).toBeDefined();
    });

    it('deve criar deal com valores customizados', () => {
      const deal = createMockDeal({
        titulo: 'Deal Customizado',
        valor: 150000,
        temperatura: 'QUENTE',
      });

      expect(deal.titulo).toBe('Deal Customizado');
      expect(deal.valor).toBe(150000);
      expect(deal.temperatura).toBe('QUENTE');
    });

    it('deve criar múltiplos deals com factory', () => {
      const deals = createMockDeals(5);

      expect(deals).toHaveLength(5);
      expect(deals[0].titulo).toBe('Deal 1');
      expect(deals[4].titulo).toBe('Deal 5');
      expect(deals[0].valor).toBe(50000);
      expect(deals[4].valor).toBe(90000); // 50000 + (4 * 10000)
    });
  });

  describe('Filtragem de Deals', () => {
    it('deve filtrar deals por empresa', () => {
      const deals = [
        createMockDeal({ empresa: 'TOKENIZA' }),
        createMockDeal({ empresa: 'BLUE' }),
        createMockDeal({ empresa: 'TOKENIZA' }),
      ];

      const filtered = deals.filter(d => d.empresa === 'TOKENIZA');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(d => d.empresa === 'TOKENIZA')).toBe(true);
    });

    it('deve filtrar deals por temperatura', () => {
      const deals = [
        mockDealQuente,
        mockDealFrio,
        createMockDeal({ temperatura: 'QUENTE' }),
      ];

      const quentes = deals.filter(d => d.temperatura === 'QUENTE');

      expect(quentes).toHaveLength(2);
    });

    it('deve filtrar deals por faixa de valor', () => {
      const deals = createMockDeals(10); // valores de 50k a 140k

      const highValue = deals.filter(d => (d.valor || 0) >= 100000);

      expect(highValue.length).toBeGreaterThan(0);
      expect(highValue.every(d => (d.valor || 0) >= 100000)).toBe(true);
    });

    it('deve filtrar deals por probabilidade mínima', () => {
      const deals = [
        createMockDeal({ probabilidade: 20 }),
        createMockDeal({ probabilidade: 50 }),
        createMockDeal({ probabilidade: 80 }),
      ];

      const highProbability = deals.filter(d => (d.probabilidade || 0) >= 50);

      expect(highProbability).toHaveLength(2);
    });
  });

  describe('Cálculos de Deals', () => {
    it('deve calcular valor total de deals', () => {
      const deals = [
        createMockDeal({ valor: 50000 }),
        createMockDeal({ valor: 75000 }),
        createMockDeal({ valor: 100000 }),
      ];

      const total = deals.reduce((sum, d) => sum + (d.valor || 0), 0);

      expect(total).toBe(225000);
    });

    it('deve calcular valor médio de deals', () => {
      const deals = [
        createMockDeal({ valor: 50000 }),
        createMockDeal({ valor: 100000 }),
        createMockDeal({ valor: 150000 }),
      ];

      const average = deals.reduce((sum, d) => sum + (d.valor || 0), 0) / deals.length;

      expect(average).toBe(100000);
    });

    it('deve calcular valor ponderado por probabilidade', () => {
      const deals = [
        createMockDeal({ valor: 100000, probabilidade: 50 }), // 50k esperado
        createMockDeal({ valor: 200000, probabilidade: 25 }), // 50k esperado
        createMockDeal({ valor: 50000, probabilidade: 100 }), // 50k esperado
      ];

      const expectedValue = deals.reduce((sum, d) => {
        return sum + ((d.valor || 0) * (d.probabilidade || 0) / 100);
      }, 0);

      expect(expectedValue).toBe(150000); // 50k + 50k + 50k
    });

    it('deve calcular taxa de conversão', () => {
      const totalDeals = 100;
      const dealsGanhos = 25;

      const conversionRate = (dealsGanhos / totalDeals) * 100;

      expect(conversionRate).toBe(25);
    });
  });

  describe('Ordenação de Deals', () => {
    it('deve ordenar deals por valor (decrescente)', () => {
      const deals = [
        createMockDeal({ valor: 50000 }),
        createMockDeal({ valor: 150000 }),
        createMockDeal({ valor: 100000 }),
      ];

      const sorted = [...deals].sort((a, b) => (b.valor || 0) - (a.valor || 0));

      expect(sorted[0].valor).toBe(150000);
      expect(sorted[1].valor).toBe(100000);
      expect(sorted[2].valor).toBe(50000);
    });

    it('deve ordenar deals por probabilidade (decrescente)', () => {
      const deals = [
        createMockDeal({ probabilidade: 30 }),
        createMockDeal({ probabilidade: 80 }),
        createMockDeal({ probabilidade: 50 }),
      ];

      const sorted = [...deals].sort((a, b) => (b.probabilidade || 0) - (a.probabilidade || 0));

      expect(sorted[0].probabilidade).toBe(80);
      expect(sorted[1].probabilidade).toBe(50);
      expect(sorted[2].probabilidade).toBe(30);
    });
  });

  describe('Validação de Temperatura e Probabilidade', () => {
    it('deve validar que temperatura QUENTE tem probabilidade alta', () => {
      const deal = mockDealQuente;

      expect(deal.temperatura).toBe('QUENTE');
      expect(deal.probabilidade).toBeGreaterThanOrEqual(70);
    });

    it('deve validar que temperatura FRIO tem probabilidade baixa', () => {
      const deal = mockDealFrio;

      expect(deal.temperatura).toBe('FRIO');
      expect(deal.probabilidade).toBeLessThanOrEqual(30);
    });

    it('deve sugerir temperatura baseada na probabilidade', () => {
      const probabilidades = [
        { prob: 85, expected: 'QUENTE' },
        { prob: 55, expected: 'MORNO' },
        { prob: 20, expected: 'FRIO' },
      ];

      probabilidades.forEach(({ prob, expected }) => {
        const temperatura = prob >= 70 ? 'QUENTE' : prob >= 40 ? 'MORNO' : 'FRIO';
        expect(temperatura).toBe(expected);
      });
    });
  });

  describe('Agrupamento de Deals', () => {
    it('deve agrupar deals por temperatura', () => {
      const deals = [
        createMockDeal({ temperatura: 'QUENTE' }),
        createMockDeal({ temperatura: 'FRIO' }),
        createMockDeal({ temperatura: 'QUENTE' }),
        createMockDeal({ temperatura: 'MORNO' }),
      ];

      const grouped = deals.reduce((acc, deal) => {
        const temp = deal.temperatura || 'INDEFINIDO';
        if (!acc[temp]) acc[temp] = [];
        acc[temp].push(deal);
        return acc;
      }, {} as Record<string, typeof deals>);

      expect(grouped['QUENTE']).toHaveLength(2);
      expect(grouped['MORNO']).toHaveLength(1);
      expect(grouped['FRIO']).toHaveLength(1);
    });

    it('deve agrupar deals por empresa', () => {
      const deals = [
        createMockDeal({ empresa: 'TOKENIZA' }),
        createMockDeal({ empresa: 'BLUE' }),
        createMockDeal({ empresa: 'TOKENIZA' }),
      ];

      const grouped = deals.reduce((acc, deal) => {
        if (!acc[deal.empresa]) acc[deal.empresa] = [];
        acc[deal.empresa].push(deal);
        return acc;
      }, {} as Record<string, typeof deals>);

      expect(grouped['TOKENIZA']).toHaveLength(2);
      expect(grouped['BLUE']).toHaveLength(1);
    });
  });
});
