import { describe, it, expect } from 'vitest';
import type { PromptVersion } from '../usePromptVersions';

describe('PromptVersion interface', () => {
  it('has all required fields', () => {
    const pv: PromptVersion = {
      id: 'abc',
      function_name: 'copilot-chat',
      prompt_key: 'system',
      version: 3,
      content: 'You are a helpful assistant',
      is_active: true,
      created_by: 'user-123',
      notes: 'Improved tone',
      created_at: '2026-02-10T10:00:00Z',
      ab_weight: 100,
      ab_group: null,
    };
    expect(pv.version).toBe(3);
    expect(pv.is_active).toBe(true);
    expect(pv.function_name).toBe('copilot-chat');
  });

  it('allows nullable fields', () => {
    const pv: PromptVersion = {
      id: 'abc',
      function_name: 'sdr-ia-interpret',
      prompt_key: 'system',
      version: 1,
      content: 'content',
      is_active: false,
      created_by: null,
      notes: null,
      created_at: '2026-02-10T10:00:00Z',
      ab_weight: 50,
      ab_group: 'variant_b',
    };
    expect(pv.created_by).toBeNull();
    expect(pv.notes).toBeNull();
  });

  it('version is a number', () => {
    const pv: PromptVersion = {
      id: 'x', function_name: 'f', prompt_key: 'k', version: 1,
      content: 'c', is_active: true, created_by: null, notes: null, created_at: '',
      ab_weight: 100, ab_group: null,
    };
    expect(typeof pv.version).toBe('number');
  });
});
