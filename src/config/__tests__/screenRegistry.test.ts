import { describe, it, expect } from 'vitest';
import { SCREEN_REGISTRY, SCREEN_GROUPS, getScreenByUrl, getScreensByGroup } from '@/config/screenRegistry';

describe('SCREEN_REGISTRY', () => {
  it('has unique keys', () => {
    const keys = SCREEN_REGISTRY.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all entries have required fields', () => {
    for (const s of SCREEN_REGISTRY) {
      expect(s.key).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.group).toBeTruthy();
      expect(s.url).toBeTruthy();
    }
  });
});

describe('SCREEN_GROUPS', () => {
  it('has no duplicates', () => {
    expect(new Set(SCREEN_GROUPS).size).toBe(SCREEN_GROUPS.length);
  });

  it('contains expected groups', () => {
    expect(SCREEN_GROUPS).toContain('Principal');
    expect(SCREEN_GROUPS).toContain('Automação');
    expect(SCREEN_GROUPS).toContain('Configuração');
  });
});

describe('getScreenByUrl', () => {
  it('returns dashboard for /', () => {
    expect(getScreenByUrl('/')?.key).toBe('dashboard');
  });

  it('returns pipeline for /pipeline', () => {
    expect(getScreenByUrl('/pipeline')?.key).toBe('pipeline');
  });

  it('returns pipeline for /pipeline/123 (startsWith)', () => {
    expect(getScreenByUrl('/pipeline/123')?.key).toBe('pipeline');
  });

  it('returns undefined for unknown url', () => {
    expect(getScreenByUrl('/naoexiste')).toBeUndefined();
  });
});

describe('getScreensByGroup', () => {
  it('returns all groups', () => {
    const grouped = getScreensByGroup();
    for (const g of SCREEN_GROUPS) {
      expect(grouped[g]).toBeDefined();
      expect(grouped[g].length).toBeGreaterThan(0);
    }
  });

  it('total items matches registry', () => {
    const grouped = getScreensByGroup();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(SCREEN_REGISTRY.length);
  });
});
