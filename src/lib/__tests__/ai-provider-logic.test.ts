import { describe, it, expect } from 'vitest';
import { COST_TABLE, RATE_LIMITS, DEFAULT_RATE_LIMIT, getRateLimit, computeAICost } from '../sdr-logic';

describe('AI Provider — Cost Table', () => {
  it('1000 tokens input Claude = $0.003', () => {
    const cost = computeAICost('claude-sonnet-4-20250514', 1000, 0);
    expect(cost).toBeCloseTo(0.003, 6);
  });

  it('1000 tokens output Claude = $0.015', () => {
    const cost = computeAICost('claude-sonnet-4-20250514', 0, 1000);
    expect(cost).toBeCloseTo(0.015, 6);
  });

  it('Gemini cost is lower than Claude', () => {
    const claude = computeAICost('claude-sonnet-4-20250514', 1000, 1000);
    const gemini = computeAICost('gemini-3-pro-preview', 1000, 1000);
    expect(gemini).toBeLessThan(claude);
  });

  it('unknown model returns 0 cost', () => {
    expect(computeAICost('unknown-model', 1000, 1000)).toBe(0);
  });
});

describe('AI Provider — Rate Limits', () => {
  it('copilot-chat limit is 60/h', () => {
    expect(getRateLimit('copilot-chat')).toBe(60);
  });

  it('sdr-intent-classifier limit is 200/h', () => {
    expect(getRateLimit('sdr-intent-classifier')).toBe(200);
  });

  it('unmapped function uses default 100/h', () => {
    expect(getRateLimit('some-random-function')).toBe(DEFAULT_RATE_LIMIT);
    expect(DEFAULT_RATE_LIMIT).toBe(100);
  });

  it('RATE_LIMITS has expected keys', () => {
    expect(Object.keys(RATE_LIMITS)).toContain('copilot-chat');
    expect(Object.keys(RATE_LIMITS)).toContain('sdr-intent-classifier');
    expect(Object.keys(RATE_LIMITS)).toContain('deal-scoring');
  });
});
