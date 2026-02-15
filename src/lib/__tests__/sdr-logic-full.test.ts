import { describe, it, expect } from 'vitest';
import {
  computeNewTemperature,
  computeClassificationUpgrade,
  detectarLeadQuenteImediato,
  decidirProximaPergunta,
  inferirPerfilInvestidor,
  detectCrossCompanyInterest,
  computeAICost,
  getRateLimit,
} from '@/lib/sdr-logic';

describe('computeNewTemperature', () => {
  it('upgrades FRIO to MORNO on purchase intent', () => {
    expect(computeNewTemperature('INTERESSE_COMPRA', 'FRIO')).toBe('MORNO');
  });

  it('upgrades MORNO to QUENTE on purchase intent', () => {
    expect(computeNewTemperature('INTERESSE_COMPRA', 'MORNO')).toBe('QUENTE');
  });

  it('does not upgrade QUENTE further', () => {
    expect(computeNewTemperature('INTERESSE_COMPRA', 'QUENTE')).toBeNull();
  });

  it('downgrades QUENTE to MORNO on no interest', () => {
    expect(computeNewTemperature('SEM_INTERESSE', 'QUENTE')).toBe('MORNO');
  });

  it('downgrades MORNO to FRIO on opt out', () => {
    expect(computeNewTemperature('OPT_OUT', 'MORNO')).toBe('FRIO');
  });

  it('returns null for neutral intents', () => {
    expect(computeNewTemperature('CUMPRIMENTO', 'MORNO')).toBeNull();
    expect(computeNewTemperature('FORA_CONTEXTO', 'FRIO')).toBeNull();
  });
});

describe('computeClassificationUpgrade', () => {
  it('sets priority 1 for QUENTE + high confidence purchase', () => {
    const result = computeClassificationUpgrade({
      novaTemperatura: 'QUENTE',
      intent: 'INTERESSE_COMPRA',
      confianca: 0.9,
      icpAtual: 'BLUE_NAO_CLASSIFICADO',
      prioridadeAtual: 3,
      empresa: 'BLUE',
    });
    expect(result.prioridade).toBe(1);
    expect(result.icp).toBe('BLUE_ALTO_TICKET_IR');
    expect(result.score_interno).toBeGreaterThan(0);
  });

  it('does not upgrade for MANUAL origin', () => {
    const result = computeClassificationUpgrade({
      novaTemperatura: 'QUENTE',
      intent: 'INTERESSE_COMPRA',
      confianca: 0.9,
      icpAtual: 'BLUE_NAO_CLASSIFICADO',
      prioridadeAtual: 3,
      empresa: 'BLUE',
      origem: 'MANUAL',
    });
    expect(result.prioridade).toBeUndefined();
  });

  it('sets priority 2 for MORNO + medium intent', () => {
    const result = computeClassificationUpgrade({
      novaTemperatura: 'MORNO',
      intent: 'DUVIDA_PRECO',
      confianca: 0.8,
      icpAtual: 'BLUE_ALTO_TICKET_IR',
      prioridadeAtual: 5,
      empresa: 'BLUE',
    });
    expect(result.prioridade).toBe(2);
  });
});

describe('detectarLeadQuenteImediato', () => {
  it('detects human request', () => {
    const result = detectarLeadQuenteImediato('Quero falar com humano por favor');
    expect(result.detectado).toBe(true);
    expect(result.tipo).toBe('PEDIDO_HUMANO');
  });

  it('detects purchase decision', () => {
    const result = detectarLeadQuenteImediato('quero contratar o serviço');
    expect(result.detectado).toBe(true);
    expect(result.tipo).toBe('DECISAO_TOMADA');
    expect(result.confianca).toBe('ALTA');
  });

  it('returns not detected for neutral message', () => {
    const result = detectarLeadQuenteImediato('Bom dia, tudo bem?');
    expect(result.detectado).toBe(false);
  });
});

describe('decidirProximaPergunta', () => {
  it('escalates immediately for urgent leads', () => {
    const result = decidirProximaPergunta('BLUE', null, null, null, 'MORNO', undefined, 'quero falar com humano');
    expect(result.tipo).toBe('ESCALAR_IMEDIATO');
  });

  it('starts SPIN_S for BLUE with no data', () => {
    const result = decidirProximaPergunta('BLUE', {}, null, null, 'FRIO');
    expect(result.tipo).toBe('SPIN_S');
  });

  it('starts GPCT_G for TOKENIZA with no data', () => {
    const result = decidirProximaPergunta('TOKENIZA', null, {}, {}, 'FRIO');
    expect(result.tipo).toBe('GPCT_G');
  });

  it('suggests CTA_REUNIAO for qualified BLUE lead', () => {
    const result = decidirProximaPergunta(
      'BLUE',
      { s: 'situação ok', p: 'problema ok' },
      null, null,
      'MORNO',
      'INTERESSE_IR',
    );
    expect(result.tipo).toBe('CTA_REUNIAO');
  });
});

describe('inferirPerfilInvestidor', () => {
  it('infers CONSERVADOR from message keywords', () => {
    expect(inferirPerfilInvestidor(null, 'quero segurança no investimento')).toBe('CONSERVADOR');
  });

  it('infers ARROJADO from message keywords', () => {
    expect(inferirPerfilInvestidor(null, 'quero alto retorno e rentabilidade')).toBe('ARROJADO');
  });

  it('infers ARROJADO from DISC D profile', () => {
    expect(inferirPerfilInvestidor('D')).toBe('ARROJADO');
  });

  it('returns null for ambiguous', () => {
    expect(inferirPerfilInvestidor('I', 'quero algo bom')).toBeNull();
  });
});

describe('detectCrossCompanyInterest', () => {
  it('detects TOKENIZA interest from BLUE context', () => {
    const result = detectCrossCompanyInterest('quero investir em tokenizado', 'BLUE');
    expect(result.detected).toBe(true);
    expect(result.targetCompany).toBe('TOKENIZA');
  });

  it('detects BLUE interest from TOKENIZA context', () => {
    const result = detectCrossCompanyInterest('preciso declarar cripto no imposto de renda', 'TOKENIZA');
    expect(result.detected).toBe(true);
    expect(result.targetCompany).toBe('BLUE');
  });

  it('returns false for unrelated message', () => {
    const result = detectCrossCompanyInterest('bom dia', 'BLUE');
    expect(result.detected).toBe(false);
  });
});

describe('computeAICost', () => {
  it('computes cost for known model', () => {
    const cost = computeAICost('gpt-4o', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.0025 + 0.005, 5);
  });

  it('returns 0 for unknown model', () => {
    expect(computeAICost('unknown-model', 1000, 500)).toBe(0);
  });
});

describe('getRateLimit', () => {
  it('returns specific limit for known function', () => {
    expect(getRateLimit('copilot-chat')).toBe(60);
  });

  it('returns default for unknown function', () => {
    expect(getRateLimit('unknown-fn')).toBe(100);
  });
});
