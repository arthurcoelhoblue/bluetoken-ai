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

  it('all URLs start with /', () => {
    for (const s of SCREEN_REGISTRY) {
      expect(s.url).toMatch(/^\//);
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
    expect(SCREEN_GROUPS).toContain('Sucesso do Cliente');
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

describe('Phase 3 routes', () => {
  it('/admin/ai-costs is registered', () => {
    expect(getScreenByUrl('/admin/ai-costs')?.key).toBe('custos_ia');
  });

  it('Sucesso do Cliente group exists', () => {
    expect(SCREEN_GROUPS).toContain('Sucesso do Cliente');
  });

  it('CS dashboard route exists', () => {
    expect(getScreenByUrl('/cs')?.key).toBe('cs_dashboard');
  });

  it('CS playbooks route exists', () => {
    expect(getScreenByUrl('/cs/playbooks')?.key).toBe('cs_playbooks');
  });
});

describe('Route consistency (registry vs App.tsx)', () => {
  it('funis_config points to /settings/pipelines (not /admin/)', () => {
    const entry = SCREEN_REGISTRY.find(s => s.key === 'funis_config');
    expect(entry?.url).toBe('/settings/pipelines');
  });

  it('campos_config points to /settings/custom-fields (not /admin/)', () => {
    const entry = SCREEN_REGISTRY.find(s => s.key === 'campos_config');
    expect(entry?.url).toBe('/settings/custom-fields');
  });

  it('all sidebar screenKeys exist in registry', () => {
    const sidebarKeys = [
      'dashboard', 'pipeline', 'contatos', 'organizacoes', 'conversas',
      'pendencias_gestor', 'metas', 'renovacao', 'cockpit', 'relatorios',
      'leads_quentes', 'amelia', 'amelia_mass_action', 'cadencias',
      'leads_cadencia', 'proximas_acoes', 'templates', 'capture_forms',
      'monitor_sgt', 'cs_dashboard', 'cs_clientes', 'cs_pesquisas',
      'cs_incidencias', 'cs_playbooks', 'knowledge_base', 'integracoes',
      'benchmark_ia', 'custos_ia', 'funis_config', 'campos_config',
      'importacao', 'telefonia_zadarma', 'controle_acesso', 'configuracoes',
    ];
    const registryKeys = new Set(SCREEN_REGISTRY.map(s => s.key));
    for (const key of sidebarKeys) {
      expect(registryKeys.has(key), `Missing key: ${key}`).toBe(true);
    }
  });
});
