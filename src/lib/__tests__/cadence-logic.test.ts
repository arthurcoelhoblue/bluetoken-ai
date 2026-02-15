import { describe, it, expect } from 'vitest';
import {
  computeNextStep,
  computeNextRunAt,
  shouldSkipStep,
  resolveRunStatus,
} from '../cadence-logic';

// ── computeNextStep ──────────────────────────────────────────
describe('computeNextStep', () => {
  it('first step executes and advances to 2', () => {
    const r = computeNextStep(1, 5, false, false);
    expect(r).toEqual({ action: 'EXECUTE', nextStep: 2 });
  });

  it('intermediate step advances', () => {
    const r = computeNextStep(3, 5, false, false);
    expect(r).toEqual({ action: 'EXECUTE', nextStep: 4 });
  });

  it('last step completes', () => {
    const r = computeNextStep(5, 5, false, false);
    expect(r).toEqual({ action: 'COMPLETE', nextStep: null });
  });

  it('lead responded + pararSeResponder=true → STOP', () => {
    const r = computeNextStep(2, 5, true, true);
    expect(r).toEqual({ action: 'STOP_RESPONDED', nextStep: null });
  });

  it('lead responded + pararSeResponder=false → continues', () => {
    const r = computeNextStep(2, 5, true, false);
    expect(r).toEqual({ action: 'EXECUTE', nextStep: 3 });
  });

  it('step beyond total completes', () => {
    const r = computeNextStep(6, 5, false, false);
    expect(r).toEqual({ action: 'COMPLETE', nextStep: null });
  });
});

// ── computeNextRunAt ─────────────────────────────────────────
describe('computeNextRunAt', () => {
  const base = new Date('2025-01-01T12:00:00Z');

  it('offset 60 adds 1 hour', () => {
    const r = computeNextRunAt(base, 60);
    expect(r.toISOString()).toBe('2025-01-01T13:00:00.000Z');
  });

  it('offset 0 returns same date', () => {
    const r = computeNextRunAt(base, 0);
    expect(r.getTime()).toBe(base.getTime());
  });

  it('offset 1440 adds 1 day', () => {
    const r = computeNextRunAt(base, 1440);
    expect(r.toISOString()).toBe('2025-01-02T12:00:00.000Z');
  });
});

// ── shouldSkipStep ───────────────────────────────────────────
describe('shouldSkipStep', () => {
  it('WHATSAPP without phone → skip', () => {
    expect(shouldSkipStep('WHATSAPP', false)).toBe(true);
  });

  it('EMAIL without email → skip', () => {
    expect(shouldSkipStep('EMAIL', false)).toBe(true);
  });

  it('channel available → do not skip', () => {
    expect(shouldSkipStep('WHATSAPP', true)).toBe(false);
    expect(shouldSkipStep('EMAIL', true)).toBe(false);
  });
});

// ── resolveRunStatus ─────────────────────────────────────────
describe('resolveRunStatus', () => {
  it('EXECUTE keeps ATIVA', () => {
    expect(resolveRunStatus('ATIVA', 'EXECUTE')).toBe('ATIVA');
  });

  it('COMPLETE → CONCLUIDA', () => {
    expect(resolveRunStatus('ATIVA', 'COMPLETE')).toBe('CONCLUIDA');
  });

  it('STOP_RESPONDED → CONCLUIDA', () => {
    expect(resolveRunStatus('ATIVA', 'STOP_RESPONDED')).toBe('CONCLUIDA');
  });

  it('PAUSADA stays PAUSADA regardless of action', () => {
    expect(resolveRunStatus('PAUSADA', 'EXECUTE')).toBe('PAUSADA');
    expect(resolveRunStatus('PAUSADA', 'COMPLETE')).toBe('PAUSADA');
  });
});
