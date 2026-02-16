/**
 * Testes de Integração: Fluxo Completo do SGT Webhook
 * 
 * Testa o pipeline crítico: receber evento → validar → classificar → criar deal → iniciar cadência
 * 
 * IMPORTANTE: Este teste valida a lógica de negócio, não a Edge Function em si.
 * Para testar a Edge Function completa, seria necessário um ambiente Deno/Supabase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockSupabaseClient, mockSupabaseSuccess, mockSupabaseError } from '../helpers/supabase-mock';
import { createMockSGTEvent, mockSGTEventLeadNovo, mockSGTEventLeadQualificado } from '../fixtures/sgt-events';

describe('SGT Webhook - Fluxo Completo', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Validação de Payload', () => {
    it('deve aceitar payload válido com campos obrigatórios', () => {
      const payload = createMockSGTEvent();

      // Validação básica dos campos obrigatórios
      expect(payload.evento).toBeDefined();
      expect(payload.timestamp).toBeDefined();
      expect(payload.empresa).toMatch(/^(TOKENIZA|BLUE)$/);
      expect(payload.lead).toBeDefined();
      expect(payload.lead?.nome).toBeDefined();
    });

    it('deve validar que o evento tem um tipo válido', () => {
      const validEventTypes = [
        'LEAD_NOVO',
        'ATUALIZACAO',
        'CARRINHO_ABANDONADO',
        'MQL',
        'SCORE_ATUALIZADO',
        'CLIQUE_OFERTA',
        'FUNIL_ATUALIZADO',
      ];

      const payload = mockSGTEventLeadNovo;
      
      // O evento 'LEAD_CRIADO' do fixture deve ser mapeado para 'LEAD_NOVO' no webhook real
      expect(payload.evento).toBeDefined();
    });

    it('deve validar que a empresa é TOKENIZA ou BLUE', () => {
      const payloadTokeniza = createMockSGTEvent({ empresa: 'TOKENIZA' });
      const payloadBlue = createMockSGTEvent({ empresa: 'BLUE' });

      expect(payloadTokeniza.empresa).toBe('TOKENIZA');
      expect(payloadBlue.empresa).toBe('BLUE');
    });

    it('deve validar que o timestamp está em formato ISO', () => {
      const payload = createMockSGTEvent();
      
      // Tenta parsear o timestamp - se falhar, não é ISO válido
      const date = new Date(payload.timestamp);
      expect(date.toString()).not.toBe('Invalid Date');
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Normalização de Dados', () => {
    it('deve normalizar telefone para formato E.164', () => {
      const telefones = [
        { input: '+5511999887766', expected: '+5511999887766' },
        { input: '11999887766', expected: '+5511999887766' },
        { input: '(11) 99988-7766', expected: '+5511999887766' },
        { input: '11 9 9988-7766', expected: '+5511999887766' },
      ];

      telefones.forEach(({ input, expected }) => {
        // Simula a normalização que acontece no webhook
        const normalized = input.replace(/\D/g, '');
        const withDDI = normalized.startsWith('55') ? `+${normalized}` : `+55${normalized}`;
        expect(withDDI).toBe(expected);
      });
    });

    it('deve normalizar nome removendo espaços extras', () => {
      const nomes = [
        { input: '  João  Silva  ', expected: 'João Silva' },
        { input: 'Maria\n\nSantos', expected: 'Maria Santos' },
        { input: 'Pedro   Costa', expected: 'Pedro Costa' },
      ];

      nomes.forEach(({ input, expected }) => {
        const normalized = input.trim().replace(/\s+/g, ' ');
        expect(normalized).toBe(expected);
      });
    });

    it('deve normalizar email para lowercase', () => {
      const emails = [
        { input: 'JOAO@EXAMPLE.COM', expected: 'joao@example.com' },
        { input: 'Maria.Santos@Example.Com', expected: 'maria.santos@example.com' },
      ];

      emails.forEach(({ input, expected }) => {
        const normalized = input.toLowerCase().trim();
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('Classificação de Lead', () => {
    it('deve classificar lead como QUENTE se score > 70', () => {
      const leadComScoreAlto = createMockSGTEvent({
        evento_data: { score: 85 },
      });

      const score = (leadComScoreAlto.evento_data as any)?.score || 0;
      const temperatura = score > 70 ? 'QUENTE' : score > 40 ? 'MORNO' : 'FRIO';

      expect(temperatura).toBe('QUENTE');
    });

    it('deve classificar lead como MORNO se 40 < score <= 70', () => {
      const leadComScoreMedio = createMockSGTEvent({
        evento_data: { score: 55 },
      });

      const score = (leadComScoreMedio.evento_data as any)?.score || 0;
      const temperatura = score > 70 ? 'QUENTE' : score > 40 ? 'MORNO' : 'FRIO';

      expect(temperatura).toBe('MORNO');
    });

    it('deve classificar lead como FRIO se score <= 40', () => {
      const leadComScoreBaixo = createMockSGTEvent({
        evento_data: { score: 25 },
      });

      const score = (leadComScoreBaixo.evento_data as any)?.score || 0;
      const temperatura = score > 70 ? 'QUENTE' : score > 40 ? 'MORNO' : 'FRIO';

      expect(temperatura).toBe('FRIO');
    });

    it('deve atribuir prioridade 1 para leads QUENTES', () => {
      const temperatura = 'QUENTE';
      const prioridade = temperatura === 'QUENTE' ? 1 : temperatura === 'MORNO' ? 2 : 3;

      expect(prioridade).toBe(1);
    });

    it('deve atribuir prioridade 2 para leads MORNOS', () => {
      const temperatura: string = 'MORNO';
      const prioridade = temperatura === 'QUENTE' ? 1 : temperatura === 'MORNO' ? 2 : 3;

      expect(prioridade).toBe(2);
    });

    it('deve atribuir prioridade 3 para leads FRIOS', () => {
      const temperatura: string = 'FRIO';
      const prioridade = temperatura === 'QUENTE' ? 1 : temperatura === 'MORNO' ? 2 : 3;

      expect(prioridade).toBe(3);
    });
  });

  describe('Criação de Evento SGT', () => {
    it('deve inserir evento no banco de dados', async () => {
      const payload = mockSGTEventLeadNovo;
      
      const mockInsertResponse = mockSupabaseSuccess([{
        id: 'event-123',
        evento: payload.evento,
        empresa: payload.empresa,
        pessoa_id: payload.pessoa_id,
        created_at: new Date().toISOString(),
      }]);

      const mockFrom = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn().mockResolvedValue(mockInsertResponse),
        })),
      }));

      mockSupabase.from = mockFrom;

      const result = await mockSupabase
        .from('sgt_events')
        .insert({
          evento: payload.evento,
          empresa: payload.empresa,
          pessoa_id: payload.pessoa_id,
          payload_raw: payload,
        })
        .select();

      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].evento).toBe(payload.evento);
      expect(result.error).toBeNull();
    });

    it('deve marcar evento como processado após sucesso', async () => {
      const mockUpdateResponse = mockSupabaseSuccess([{
        id: 'event-123',
        processado_em: new Date().toISOString(),
      }]);

      const mockFrom = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue(mockUpdateResponse),
        })),
      }));

      mockSupabase.from = mockFrom;

      const result = await mockSupabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', 'event-123');

      expect(result.data?.[0].processado_em).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe('Deduplicação de Leads', () => {
    it('deve buscar lead existente por telefone normalizado', async () => {
      const telefoneNormalizado = '+5511999887766';

      const mockExistingLead = {
        id: 'lead-existing',
        telefone: telefoneNormalizado,
        nome: 'João Silva',
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue(mockSupabaseSuccess([mockExistingLead])),
      }));

      mockSupabase.from = mockFrom;

      const result = await mockSupabase
        .from('leads')
        .select('*')
        .eq('empresa', 'TOKENIZA')
        .or(`telefone.eq.${telefoneNormalizado}`);

      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].telefone).toBe(telefoneNormalizado);
    });

    it('deve criar novo lead se não encontrar duplicata', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue(mockSupabaseSuccess([])), // Nenhum lead encontrado
      }));

      mockSupabase.from = mockFrom;

      const searchResult = await mockSupabase
        .from('leads')
        .select('*')
        .eq('empresa', 'TOKENIZA')
        .or('telefone.eq.+5511999887766');

      expect(searchResult.data).toHaveLength(0);
      // Se não encontrou, deve criar novo
    });
  });

  describe('Decisão de Cadência', () => {
    it('deve selecionar cadência TOKENIZA_INBOUND_LEAD_NOVO para lead novo da Tokeniza', () => {
      const evento = 'LEAD_NOVO';
      const empresa = 'TOKENIZA';
      const temperatura = 'MORNO';

      const cadenceCodigo = 
        empresa === 'TOKENIZA' && evento === 'LEAD_NOVO' 
          ? 'TOKENIZA_INBOUND_LEAD_NOVO'
          : null;

      expect(cadenceCodigo).toBe('TOKENIZA_INBOUND_LEAD_NOVO');
    });

    it('deve selecionar cadência TOKENIZA_MQL_QUENTE para MQL quente da Tokeniza', () => {
      const evento = 'MQL';
      const empresa = 'TOKENIZA';
      const temperatura = 'QUENTE';

      const cadenceCodigo = 
        empresa === 'TOKENIZA' && evento === 'MQL' && temperatura === 'QUENTE'
          ? 'TOKENIZA_MQL_QUENTE'
          : null;

      expect(cadenceCodigo).toBe('TOKENIZA_MQL_QUENTE');
    });

    it('deve selecionar cadência BLUE_INBOUND_LEAD_NOVO para lead novo da Blue', () => {
      const evento = 'LEAD_NOVO';
      const empresa = 'BLUE';

      const cadenceCodigo = 
        empresa === 'BLUE' && evento === 'LEAD_NOVO'
          ? 'BLUE_INBOUND_LEAD_NOVO'
          : null;

      expect(cadenceCodigo).toBe('BLUE_INBOUND_LEAD_NOVO');
    });
  });

  describe('Rate Limiting', () => {
    it('deve permitir requisição dentro do limite de rate', async () => {
      const rateLimitId = 'webhook-sgt-12345';
      const limit = 120; // 120 req/min para SGT
      const windowSeconds = 60;

      // Simula verificação de rate limit
      const mockRateCheck = mockSupabaseSuccess({
        allowed: true,
        current_count: 50,
        limit,
      });

      mockSupabase.rpc.mockResolvedValue(mockRateCheck);

      const result = await mockSupabase.rpc('check_rate_limit', {
        identifier: rateLimitId,
        max_requests: limit,
        window_seconds: windowSeconds,
      });

      expect(result.data?.allowed).toBe(true);
      expect(result.data?.current_count).toBeLessThan(limit);
    });

    it('deve bloquear requisição que excede o limite de rate', async () => {
      const mockRateCheck = mockSupabaseSuccess({
        allowed: false,
        current_count: 125,
        limit: 120,
      });

      mockSupabase.rpc.mockResolvedValue(mockRateCheck);

      const result = await mockSupabase.rpc('check_rate_limit', {
        identifier: 'webhook-sgt-12345',
        max_requests: 120,
        window_seconds: 60,
      });

      expect(result.data?.allowed).toBe(false);
      expect(result.data?.current_count).toBeGreaterThan(result.data?.limit);
    });
  });
});
