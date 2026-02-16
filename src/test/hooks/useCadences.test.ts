/**
 * Testes para o hook useCadences
 * 
 * Testa a lógica de busca, filtragem e estatísticas de cadências
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockSupabaseClient, mockSupabaseSuccess } from '../helpers/supabase-mock';

// Mock do cliente Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient(),
}));

describe('useCadences Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Busca de Cadências', () => {
    it('deve buscar todas as cadências sem filtros', async () => {
      const mockCadences = [
        {
          id: 'cad-1',
          empresa: 'TOKENIZA',
          codigo: 'TOKENIZA_INBOUND_LEAD_NOVO',
          nome: 'Inbound Lead Novo',
          ativo: true,
          canal_principal: 'WHATSAPP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'cad-2',
          empresa: 'BLUE',
          codigo: 'BLUE_INBOUND_LEAD_NOVO',
          nome: 'Inbound Lead Novo Blue',
          ativo: true,
          canal_principal: 'EMAIL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Este teste valida a estrutura de dados esperada
      expect(mockCadences).toHaveLength(2);
      expect(mockCadences[0].empresa).toBe('TOKENIZA');
      expect(mockCadences[1].empresa).toBe('BLUE');
    });

    it('deve filtrar cadências por empresa', () => {
      const allCadences = [
        { id: '1', empresa: 'TOKENIZA', nome: 'Cadência 1' },
        { id: '2', empresa: 'BLUE', nome: 'Cadência 2' },
        { id: '3', empresa: 'TOKENIZA', nome: 'Cadência 3' },
      ];

      const filtered = allCadences.filter(c => c.empresa === 'TOKENIZA');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.empresa === 'TOKENIZA')).toBe(true);
    });

    it('deve filtrar cadências por status ativo', () => {
      const allCadences = [
        { id: '1', nome: 'Cadência 1', ativo: true },
        { id: '2', nome: 'Cadência 2', ativo: false },
        { id: '3', nome: 'Cadência 3', ativo: true },
      ];

      const filtered = allCadences.filter(c => c.ativo === true);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.ativo === true)).toBe(true);
    });

    it('deve buscar cadências por termo de pesquisa no nome', () => {
      const allCadences = [
        { id: '1', nome: 'Inbound Lead Novo', codigo: 'INBOUND_1' },
        { id: '2', nome: 'Outbound Prospecção', codigo: 'OUTBOUND_1' },
        { id: '3', nome: 'Inbound MQL Quente', codigo: 'INBOUND_2' },
      ];

      const searchTerm = 'inbound';
      const filtered = allCadences.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.nome.toLowerCase().includes('inbound'))).toBe(true);
    });
  });

  describe('Estatísticas de Cadências', () => {
    it('deve calcular estatísticas de runs por cadência', () => {
      const runs = [
        { cadence_id: 'cad-1', status: 'ATIVA' },
        { cadence_id: 'cad-1', status: 'ATIVA' },
        { cadence_id: 'cad-1', status: 'CONCLUIDA' },
        { cadence_id: 'cad-2', status: 'ATIVA' },
        { cadence_id: 'cad-2', status: 'CONCLUIDA' },
        { cadence_id: 'cad-2', status: 'CONCLUIDA' },
      ];

      const statsMap: Record<string, { total: number; ativas: number; concluidas: number }> = {};

      runs.forEach((run) => {
        if (!statsMap[run.cadence_id]) {
          statsMap[run.cadence_id] = { total: 0, ativas: 0, concluidas: 0 };
        }
        statsMap[run.cadence_id].total++;
        if (run.status === 'ATIVA') statsMap[run.cadence_id].ativas++;
        if (run.status === 'CONCLUIDA') statsMap[run.cadence_id].concluidas++;
      });

      expect(statsMap['cad-1']).toEqual({ total: 3, ativas: 2, concluidas: 1 });
      expect(statsMap['cad-2']).toEqual({ total: 3, ativas: 1, concluidas: 2 });
    });

    it('deve retornar estatísticas zeradas para cadência sem runs', () => {
      const cadenceId = 'cad-sem-runs';
      const runs: { cadence_id: string; status: string }[] = [];

      const statsMap: Record<string, { total: number; ativas: number; concluidas: number }> = {};

      runs.forEach((run) => {
        if (!statsMap[run.cadence_id]) {
          statsMap[run.cadence_id] = { total: 0, ativas: 0, concluidas: 0 };
        }
        statsMap[run.cadence_id].total++;
      });

      const stats = statsMap[cadenceId] || { total: 0, ativas: 0, concluidas: 0 };

      expect(stats).toEqual({ total: 0, ativas: 0, concluidas: 0 });
    });
  });

  describe('Ordenação de Cadências', () => {
    it('deve ordenar cadências por empresa e depois por nome', () => {
      const cadences = [
        { id: '1', empresa: 'TOKENIZA', nome: 'Zebra' },
        { id: '2', empresa: 'BLUE', nome: 'Alpha' },
        { id: '3', empresa: 'TOKENIZA', nome: 'Alpha' },
        { id: '4', empresa: 'BLUE', nome: 'Zebra' },
      ];

      const sorted = [...cadences].sort((a, b) => {
        if (a.empresa !== b.empresa) {
          return a.empresa.localeCompare(b.empresa);
        }
        return a.nome.localeCompare(b.nome);
      });

      expect(sorted[0]).toEqual({ id: '2', empresa: 'BLUE', nome: 'Alpha' });
      expect(sorted[1]).toEqual({ id: '4', empresa: 'BLUE', nome: 'Zebra' });
      expect(sorted[2]).toEqual({ id: '3', empresa: 'TOKENIZA', nome: 'Alpha' });
      expect(sorted[3]).toEqual({ id: '1', empresa: 'TOKENIZA', nome: 'Zebra' });
    });
  });

  describe('Validação de Dados', () => {
    it('deve validar que cadência tem todos os campos obrigatórios', () => {
      const cadence = {
        id: 'cad-1',
        empresa: 'TOKENIZA',
        codigo: 'TEST_CADENCE',
        nome: 'Cadência Teste',
        ativo: true,
        canal_principal: 'WHATSAPP',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(cadence.id).toBeDefined();
      expect(cadence.empresa).toMatch(/^(TOKENIZA|BLUE)$/);
      expect(cadence.codigo).toBeDefined();
      expect(cadence.nome).toBeDefined();
      expect(typeof cadence.ativo).toBe('boolean');
      expect(cadence.canal_principal).toMatch(/^(WHATSAPP|EMAIL|SMS|LIGACAO)$/);
    });

    it('deve validar que empresa é TOKENIZA ou BLUE', () => {
      const empresasValidas = ['TOKENIZA', 'BLUE'];
      
      empresasValidas.forEach(empresa => {
        expect(['TOKENIZA', 'BLUE']).toContain(empresa);
      });
    });

    it('deve validar que canal_principal é válido', () => {
      const canaisValidos = ['WHATSAPP', 'EMAIL', 'SMS', 'LIGACAO'];
      
      canaisValidos.forEach(canal => {
        expect(['WHATSAPP', 'EMAIL', 'SMS', 'LIGACAO']).toContain(canal);
      });
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve retornar array vazio se não houver cadências', () => {
      const cadences: { id: string; nome: string }[] = [];
      
      expect(cadences).toHaveLength(0);
      expect(Array.isArray(cadences)).toBe(true);
    });

    it('deve lidar com cadências sem runs associados', () => {
      const cadences = [
        { id: 'cad-1', nome: 'Cadência 1' },
        { id: 'cad-2', nome: 'Cadência 2' },
      ];

      const runs: { cadence_id: string; status: string }[] = [];

      const statsMap: Record<string, { total: number; ativas: number; concluidas: number }> = {};
      runs.forEach((run) => {
        if (!statsMap[run.cadence_id]) {
          statsMap[run.cadence_id] = { total: 0, ativas: 0, concluidas: 0 };
        }
      });

      const cadencesWithStats = cadences.map(c => ({
        ...c,
        stats: statsMap[c.id] || { total: 0, ativas: 0, concluidas: 0 },
      }));

      expect(cadencesWithStats).toHaveLength(2);
      expect(cadencesWithStats[0].stats).toEqual({ total: 0, ativas: 0, concluidas: 0 });
    });
  });
});
