import { describe, it, expect } from 'vitest';
import type { AdoptionMetric } from '../useAdoptionMetrics';

function aggregateAdoption(rows: Array<{ event_name: string; user_id: string | null; created_at: string }>): AdoptionMetric[] {
  const featureMap = new Map<string, { users: Set<string>; count: number; lastUsed: string }>();

  for (const row of rows) {
    const existing = featureMap.get(row.event_name) || { users: new Set(), count: 0, lastUsed: '' };
    if (row.user_id) existing.users.add(row.user_id);
    existing.count++;
    if (row.created_at > existing.lastUsed) existing.lastUsed = row.created_at;
    featureMap.set(row.event_name, existing);
  }

  const metrics: AdoptionMetric[] = [];
  featureMap.forEach((v, k) => {
    metrics.push({ feature: k, unique_users: v.users.size, total_events: v.count, last_used: v.lastUsed });
  });
  return metrics.sort((a, b) => b.total_events - a.total_events);
}

describe('Adoption Metrics aggregation', () => {
  it('counts unique users per feature', () => {
    const rows = [
      { event_name: 'feature:pipeline', user_id: 'u1', created_at: '2026-02-10T10:00:00Z' },
      { event_name: 'feature:pipeline', user_id: 'u1', created_at: '2026-02-10T11:00:00Z' },
      { event_name: 'feature:pipeline', user_id: 'u2', created_at: '2026-02-10T12:00:00Z' },
    ];
    const result = aggregateAdoption(rows);
    expect(result[0].unique_users).toBe(2);
    expect(result[0].total_events).toBe(3);
  });

  it('sorts by total_events descending', () => {
    const rows = [
      { event_name: 'a', user_id: 'u1', created_at: '2026-02-10T10:00:00Z' },
      { event_name: 'b', user_id: 'u1', created_at: '2026-02-10T10:00:00Z' },
      { event_name: 'b', user_id: 'u2', created_at: '2026-02-10T11:00:00Z' },
    ];
    const result = aggregateAdoption(rows);
    expect(result[0].feature).toBe('b');
    expect(result[1].feature).toBe('a');
  });

  it('returns empty for empty input', () => {
    expect(aggregateAdoption([])).toEqual([]);
  });

  it('tracks last_used correctly', () => {
    const rows = [
      { event_name: 'x', user_id: 'u1', created_at: '2026-02-10T10:00:00Z' },
      { event_name: 'x', user_id: 'u1', created_at: '2026-02-12T10:00:00Z' },
    ];
    const result = aggregateAdoption(rows);
    expect(result[0].last_used).toBe('2026-02-12T10:00:00Z');
  });
});
