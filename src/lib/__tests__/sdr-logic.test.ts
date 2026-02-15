import { describe, it, expect } from 'vitest';
import {
  computeClassificationUpgrade,
  computeNewTemperature,
  detectarLeadQuenteImediato,
  decidirProximaPergunta,
  inferirPerfilInvestidor,
  detectCrossCompanyInterest,
} from '../sdr-logic';

// ========================================
// computeClassificationUpgrade
// ========================================
describe('computeClassificationUpgrade', () => {
  it('QUENTE + INTERESSE_IR confianca 1.0 → P1, ICP BLUE_ALTO_TICKET_IR', () => {
    const r = computeClassificationUpgrade({
      novaTemperatura: 'QUENTE', intent: 'INTERESSE_IR', confianca: 1.0,
      icpAtual: 'BLUE_NAO_CLASSIFICADO', prioridadeAtual: 3, empresa: 'BLUE',
    });
    expect(r.prioridade).toBe(1);
    expect(r.icp).toBe('BLUE_ALTO_TICKET_IR');
    expect(r.score_interno).toBeGreaterThan(0);
  });

  it('MORNO + DUVIDA_PRECO confianca 0.75 → P2', () => {
    const r = computeClassificationUpgrade({
      novaTemperatura: 'MORNO', intent: 'DUVIDA_PRECO', confianca: 0.75,
      icpAtual: 'BLUE_MEDIO', prioridadeAtual: 3, empresa: 'BLUE',
    });
    expect(r.prioridade).toBe(2);
  });

  it('origem MANUAL não é sobrescrita', () => {
    const r = computeClassificationUpgrade({
      novaTemperatura: 'QUENTE', intent: 'INTERESSE_IR', confianca: 1.0,
      icpAtual: 'BLUE_NAO_CLASSIFICADO', prioridadeAtual: 3, empresa: 'BLUE', origem: 'MANUAL',
    });
    expect(r).toEqual({});
  });

  it('FRIO + intent baixa confiança não muda nada', () => {
    const r = computeClassificationUpgrade({
      novaTemperatura: 'FRIO', intent: 'CUMPRIMENTO', confianca: 0.5,
      icpAtual: 'BLUE_NAO_CLASSIFICADO', prioridadeAtual: 3, empresa: 'BLUE',
    });
    expect(r).toEqual({});
  });

  it('TOKENIZA_NAO_CLASSIFICADO + high intent → TOKENIZA_EMERGENTE', () => {
    const r = computeClassificationUpgrade({
      novaTemperatura: 'QUENTE', intent: 'INTERESSE_COMPRA', confianca: 0.9,
      icpAtual: 'TOKENIZA_NAO_CLASSIFICADO', prioridadeAtual: 3, empresa: 'TOKENIZA',
    });
    expect(r.icp).toBe('TOKENIZA_EMERGENTE');
    expect(r.prioridade).toBe(1);
  });
});

// ========================================
// computeNewTemperature
// ========================================
describe('computeNewTemperature', () => {
  it('FRIO + INTERESSE_COMPRA → MORNO', () => {
    expect(computeNewTemperature('INTERESSE_COMPRA', 'FRIO')).toBe('MORNO');
  });

  it('MORNO + INTERESSE_IR → QUENTE', () => {
    expect(computeNewTemperature('INTERESSE_IR', 'MORNO')).toBe('QUENTE');
  });

  it('QUENTE + OPT_OUT → MORNO', () => {
    expect(computeNewTemperature('OPT_OUT', 'QUENTE')).toBe('MORNO');
  });

  it('QUENTE + INTERESSE_COMPRA → null (already max)', () => {
    expect(computeNewTemperature('INTERESSE_COMPRA', 'QUENTE')).toBeNull();
  });

  it('FRIO + CUMPRIMENTO → null (neutral intent)', () => {
    expect(computeNewTemperature('CUMPRIMENTO', 'FRIO')).toBeNull();
  });
});

// ========================================
// detectarLeadQuenteImediato
// ========================================
describe('detectarLeadQuenteImediato', () => {
  it('"quero contratar" → detectado, DECISAO_TOMADA, ALTA', () => {
    const r = detectarLeadQuenteImediato('Olá, quero contratar o plano Gold');
    expect(r.detectado).toBe(true);
    expect(r.tipo).toBe('DECISAO_TOMADA');
    expect(r.confianca).toBe('ALTA');
  });

  it('"malha fina" → URGENCIA_TEMPORAL', () => {
    const r = detectarLeadQuenteImediato('Estou preocupado com a malha fina');
    expect(r.detectado).toBe(true);
    expect(r.tipo).toBe('URGENCIA_TEMPORAL');
    expect(r.confianca).toBe('ALTA');
  });

  it('"falar com humano" → PEDIDO_HUMANO, ALTA', () => {
    const r = detectarLeadQuenteImediato('Quero falar com humano por favor');
    expect(r.detectado).toBe(true);
    expect(r.tipo).toBe('PEDIDO_HUMANO');
    expect(r.confianca).toBe('ALTA');
  });

  it('"olá bom dia" → não detectado', () => {
    const r = detectarLeadQuenteImediato('Olá bom dia, tudo bem?');
    expect(r.detectado).toBe(false);
    expect(r.confianca).toBe('BAIXA');
  });
});

// ========================================
// decidirProximaPergunta
// ========================================
describe('decidirProximaPergunta', () => {
  it('BLUE sem SPIN.S → SPIN_S', () => {
    const r = decidirProximaPergunta('BLUE', {}, null, null, 'MORNO');
    expect(r.tipo).toBe('SPIN_S');
  });

  it('BLUE com S+P + intent INTERESSE_IR → CTA_REUNIAO', () => {
    const r = decidirProximaPergunta('BLUE', { s: 'sim', p: 'tem problema' }, null, null, 'MORNO', 'INTERESSE_IR');
    expect(r.tipo).toBe('CTA_REUNIAO');
  });

  it('TOKENIZA sem GPCT.G → GPCT_G', () => {
    const r = decidirProximaPergunta('TOKENIZA', null, {}, null, 'MORNO');
    expect(r.tipo).toBe('GPCT_G');
  });

  it('urgência na mensagem → ESCALAR_IMEDIATO', () => {
    const r = decidirProximaPergunta('BLUE', {}, null, null, 'MORNO', undefined, 'quero contratar agora');
    expect(r.tipo).toBe('ESCALAR_IMEDIATO');
  });
});

// ========================================
// inferirPerfilInvestidor
// ========================================
describe('inferirPerfilInvestidor', () => {
  it('"segurança" → CONSERVADOR', () => {
    expect(inferirPerfilInvestidor(null, 'Busco segurança nos investimentos')).toBe('CONSERVADOR');
  });

  it('"rentabilidade" → ARROJADO', () => {
    expect(inferirPerfilInvestidor(null, 'Quero saber a rentabilidade')).toBe('ARROJADO');
  });

  it('DISC D sem keywords → ARROJADO', () => {
    expect(inferirPerfilInvestidor('D', 'olá')).toBe('ARROJADO');
  });

  it('DISC C sem keywords → CONSERVADOR', () => {
    expect(inferirPerfilInvestidor('C', 'olá')).toBe('CONSERVADOR');
  });

  it('sem DISC, sem keywords → null', () => {
    expect(inferirPerfilInvestidor(null, 'olá bom dia')).toBeNull();
  });
});

// ========================================
// detectCrossCompanyInterest
// ========================================
describe('detectCrossCompanyInterest', () => {
  it('BLUE + "investimento" → TOKENIZA', () => {
    const r = detectCrossCompanyInterest('Tenho interesse em investimento tokenizado', 'BLUE');
    expect(r.detected).toBe(true);
    expect(r.targetCompany).toBe('TOKENIZA');
  });

  it('TOKENIZA + "imposto de renda" → BLUE', () => {
    const r = detectCrossCompanyInterest('Preciso declarar imposto de renda de cripto', 'TOKENIZA');
    expect(r.detected).toBe(true);
    expect(r.targetCompany).toBe('BLUE');
  });

  it('BLUE + mensagem sem cross-interest → not detected', () => {
    const r = detectCrossCompanyInterest('Preciso de ajuda com minha declaração', 'BLUE');
    expect(r.detected).toBe(false);
  });
});
