import { describe, it, expect } from 'vitest';
import {
  ICP_LABELS, PERSONA_LABELS, TEMPERATURA_LABELS, PRIORIDADE_LABELS, ORIGEM_LABELS,
  TEMPERATURAS, PRIORIDADES, ORIGENS, ICPS_TOKENIZA, ICPS_BLUE,
  type ICP, type Temperatura, type Prioridade, type ClassificacaoOrigem,
  type LeadClassification, type LeadWithClassification,
} from '@/types/classification';
import type { LeadsClassificationFilters } from '../useLeadClassification';

describe('Classification type mappings', () => {
  it('all ICP_LABELS keys match ICP type constants', () => {
    const allIcps = [...ICPS_TOKENIZA, ...ICPS_BLUE];
    for (const icp of allIcps) {
      expect(ICP_LABELS[icp]).toBeTruthy();
    }
    expect(Object.keys(ICP_LABELS)).toHaveLength(allIcps.length);
  });

  it('TEMPERATURA_LABELS covers all temperatures', () => {
    for (const t of TEMPERATURAS) {
      expect(TEMPERATURA_LABELS[t]).toBeTruthy();
    }
  });

  it('PRIORIDADE_LABELS covers all priorities', () => {
    for (const p of PRIORIDADES) {
      expect(PRIORIDADE_LABELS[p]).toBeTruthy();
    }
  });

  it('ORIGEM_LABELS covers all origins', () => {
    for (const o of ORIGENS) {
      expect(ORIGEM_LABELS[o]).toBeTruthy();
    }
  });
});

describe('LeadsClassificationFilters interface', () => {
  it('allows partial filters', () => {
    const f: LeadsClassificationFilters = { icp: 'TOKENIZA_SERIAL' };
    expect(f.icp).toBe('TOKENIZA_SERIAL');
    expect(f.empresa).toBeUndefined();
  });

  it('allows combined filters', () => {
    const f: LeadsClassificationFilters = {
      empresa: 'BLUE' as any,
      temperatura: 'QUENTE',
      prioridade: 1,
      origem: 'MANUAL',
      searchTerm: 'João',
    };
    expect(f.temperatura).toBe('QUENTE');
    expect(f.searchTerm).toBe('João');
  });
});

describe('LeadWithClassification structure', () => {
  it('classification can be null', () => {
    const lwc: LeadWithClassification = {
      lead_id: 'l1', empresa: 'TOKENIZA', nome: 'Test', primeiro_nome: 'T',
      email: null, telefone: null, contact_updated_at: '', classification: null,
    };
    expect(lwc.classification).toBeNull();
  });
});
