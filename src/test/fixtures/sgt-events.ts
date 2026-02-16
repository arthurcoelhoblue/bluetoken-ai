/**
 * Fixtures de dados de teste para eventos SGT (Webhook)
 */

export interface SGTPayload {
  evento: string;
  timestamp: string;
  empresa: 'TOKENIZA' | 'BLUE';
  pessoa_id?: number;
  lead?: {
    nome: string;
    email?: string;
    telefone?: string;
    empresa_nome?: string;
    cargo?: string;
  };
  evento_data?: Record<string, unknown>;
}

export const mockSGTEventBase: SGTPayload = {
  evento: 'LEAD_CRIADO',
  timestamp: new Date().toISOString(),
  empresa: 'TOKENIZA',
  pessoa_id: 12345,
  lead: {
    nome: 'João Silva',
    email: 'joao.silva@example.com',
    telefone: '+5511999887766',
    empresa_nome: 'Empresa Teste LTDA',
    cargo: 'CEO',
  },
};

export const mockSGTEventLeadNovo: SGTPayload = {
  ...mockSGTEventBase,
  evento: 'LEAD_CRIADO',
  lead: {
    nome: 'Maria Santos',
    email: 'maria.santos@example.com',
    telefone: '+5511988776655',
    empresa_nome: 'Tech Startup Inc',
    cargo: 'CTO',
  },
};

export const mockSGTEventLeadQualificado: SGTPayload = {
  ...mockSGTEventBase,
  evento: 'LEAD_QUALIFICADO',
  pessoa_id: 67890,
  lead: {
    nome: 'Pedro Costa',
    email: 'pedro.costa@example.com',
    telefone: '+5511977665544',
    empresa_nome: 'Big Corp SA',
    cargo: 'CFO',
  },
  evento_data: {
    score: 85,
    temperatura: 'QUENTE',
  },
};

export const mockSGTEventReuniao: SGTPayload = {
  ...mockSGTEventBase,
  evento: 'REUNIAO_AGENDADA',
  pessoa_id: 11111,
  evento_data: {
    data_reuniao: new Date(Date.now() + 86400000).toISOString(), // +1 dia
    tipo: 'DISCOVERY',
  },
};

export const mockSGTEventPropostaEnviada: SGTPayload = {
  ...mockSGTEventBase,
  evento: 'PROPOSTA_ENVIADA',
  pessoa_id: 22222,
  evento_data: {
    valor: 100000,
    validade: '30 dias',
  },
};

export const mockSGTEventBlue: SGTPayload = {
  ...mockSGTEventBase,
  empresa: 'BLUE',
  pessoa_id: 33333,
  lead: {
    nome: 'Ana Oliveira',
    email: 'ana.oliveira@example.com',
    telefone: '+5511966554433',
    empresa_nome: 'Contabilidade XYZ',
    cargo: 'Sócia',
  },
};

/**
 * Factory para criar eventos SGT customizados
 */
export function createMockSGTEvent(overrides: Partial<SGTPayload> = {}): SGTPayload {
  return {
    ...mockSGTEventBase,
    ...overrides,
  };
}

/**
 * Factory para criar múltiplos eventos SGT
 */
export function createMockSGTEvents(count: number, overrides: Partial<SGTPayload> = {}): SGTPayload[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockSGTEventBase,
    pessoa_id: 10000 + i,
    lead: {
      nome: `Lead ${i + 1}`,
      email: `lead${i + 1}@example.com`,
      telefone: `+551199${String(i).padStart(7, '0')}`,
    },
    ...overrides,
  }));
}
