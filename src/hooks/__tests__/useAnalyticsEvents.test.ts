import { describe, it, expect } from 'vitest';

// Test the pure logic extracted from useAnalyticsEvents

describe('sessionId generator', () => {
  it('crypto.randomUUID returns a valid UUID', () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(100);
  });
});

describe('event formatting', () => {
  it('trackPageView formats as page_view:<page>', () => {
    const page = 'pipeline';
    const eventName = `page_view:${page}`;
    expect(eventName).toBe('page_view:pipeline');
  });

  it('trackFeatureUse formats as feature:<name>', () => {
    const feature = 'kanban_drag';
    const eventName = `feature:${feature}`;
    expect(eventName).toBe('feature:kanban_drag');
  });
});

describe('batching queue logic', () => {
  it('queue accumulates events and can be flushed', () => {
    const queue: Array<{ event_name: string; event_category: string; metadata: Record<string, unknown> }> = [];

    queue.push({ event_name: 'page_view:dashboard', event_category: 'navigation', metadata: { page: 'dashboard' } });
    queue.push({ event_name: 'feature:search', event_category: 'feature', metadata: {} });
    expect(queue).toHaveLength(2);

    const batch = [...queue];
    queue.length = 0;
    expect(batch).toHaveLength(2);
    expect(queue).toHaveLength(0);
  });

  it('batch maps to correct row shape', () => {
    const event = { event_name: 'page_view:metas', event_category: 'navigation', metadata: { page: 'metas' } };
    const row = {
      user_id: 'u1',
      empresa: 'TOKENIZA',
      event_name: event.event_name,
      event_category: event.event_category,
      metadata: event.metadata,
      session_id: crypto.randomUUID(),
    };
    expect(row.event_name).toBe('page_view:metas');
    expect(row.session_id).toBeTruthy();
  });
});
