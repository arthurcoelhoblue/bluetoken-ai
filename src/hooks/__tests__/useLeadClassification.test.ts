import { describe, it, expect } from 'vitest';
import {
  ICP_LABELS, PERSONA_LABELS, TEMPERATURA_LABELS, PRIORIDADE_LABELS, ORIGEM_LABELS,
  TEMPERATURAS, PRIORIDADES, ORIGENS, ICPS_TOKENIZA, ICPS_BLUE, ICPS_MPUPPE, ICPS_AXIA,
  PERSONAS_TOKENIZA, PERSONAS_BLUE, PERSONAS_MPUPPE, PERSONAS_AXIA,
  type ICP, type Temperatura, type Prioridade, type ClassificacaoOrigem,
  type LeadClassification, type LeadWithClassification,
} from '@/types/classification';
import type { LeadsClassificationFilters } from '../useLeadClassification';

describe('Classification type mappings', () => {
  it('all ICP_LABELS keys match ICP type constants (4 empresas)', () => {
    const allIcps = [...ICPS_TOKENIZA, ...ICPS_BLUE, ...ICPS_MPUPPE, ...ICPS_AXIA];
    for (const icp of allIcps) {
      expect(ICP_LABELS[icp]).toBeTruthy();
    }
    expect(Object.keys(ICP_LABELS)).toHaveLength(allIcps.length);
  });

  it('all PERSONA_LABELS keys match Persona type constants (4 empresas)', () => {
    const allPersonas = [...PERSONAS_TOKENIZA, ...PERSONAS_BLUE, ...PERSONAS_MPUPPE, ...PERSONAS_AXIA];
    for (const persona of allPersonas) {
      expect(PERSONA_LABELS[persona]).toBeTruthy();
    }
    expect(Object.keys(PERSONA_LABELS)).toHaveLength(allPersonas.length);
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

  it('ICPS_MPUPPE has correct length', () => {
    expect(ICPS_MPUPPE).toHaveLength(5);
    expect(ICPS_MPUPPE).toContain('MPUPPE_FINTECH_REG');
    expect(ICPS_MPUPPE).toContain('MPUPPE_NAO_CLASSIFICADO');
  });

  it('ICPS_AXIA has correct length', () => {
    expect(ICPS_AXIA).toHaveLength(5);
    expect(ICPS_AXIA).toContain('AXIA_FINTECH_LAUNCH');
    expect(ICPS_AXIA).toContain('AXIA_NAO_CLASSIFICADO');
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

  it('allows MPUPPE and AXIA ICP filters', () => {
    const f1: LeadsClassificationFilters = { icp: 'MPUPPE_FINTECH_REG' };
    expect(f1.icp).toBe('MPUPPE_FINTECH_REG');
    const f2: LeadsClassificationFilters = { icp: 'AXIA_EXCHANGE_BUILDER' };
    expect(f2.icp).toBe('AXIA_EXCHANGE_BUILDER');
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

  it('supports MPUPPE and AXIA empresa types', () => {
    const lwc: LeadWithClassification = {
      lead_id: 'l2', empresa: 'MPUPPE', nome: 'Fintech Lead', primeiro_nome: 'F',
      email: null, telefone: null, contact_updated_at: '', classification: null,
    };
    expect(lwc.empresa).toBe('MPUPPE');
  });
});
