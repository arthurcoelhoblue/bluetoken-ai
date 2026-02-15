import { describe, it, expect } from 'vitest';
import type { AICostByFunction, AICostDaily, AICostSummary } from '../useAICostDashboard';

// Pure-logic test: replicate the aggregation from the hook
function aggregateAICosts(rows: Array<{
  function_name: string; provider: string; model: string;
  success: boolean | null; tokens_input: number | null; tokens_output: number | null;
  custo_estimado: number | null; latency_ms: number | null; created_at: string;
}>): AICostSummary {
  const fnMap = new Map<string, AICostByFunction>();
  const dailyMap = new Map<string, AICostDaily>();
  let totalCost = 0, totalCalls = 0, totalTokens = 0, totalErrors = 0, totalLatency = 0, latencyCount = 0;

  for (const row of rows) {
    const key = `${row.function_name}|${row.provider}|${row.model}`;
    const existing = fnMap.get(key) || {
      function_name: row.function_name, provider: row.provider, model: row.model,
      total_calls: 0, successful_calls: 0, failed_calls: 0,
      total_tokens_input: 0, total_tokens_output: 0, total_cost_usd: 0, avg_latency_ms: 0,
    };
    existing.total_calls++;
    if (row.success) existing.successful_calls++; else existing.failed_calls++;
    existing.total_tokens_input += row.tokens_input || 0;
    existing.total_tokens_output += row.tokens_output || 0;
    existing.total_cost_usd += row.custo_estimado || 0;
    if (row.latency_ms) {
      existing.avg_latency_ms = (existing.avg_latency_ms * (existing.total_calls - 1) + row.latency_ms) / existing.total_calls;
    }
    fnMap.set(key, existing);

    const day = (row.created_at || '').slice(0, 10);
    const daily = dailyMap.get(day) || { date: day, total_calls: 0, total_cost: 0, total_tokens: 0 };
    daily.total_calls++;
    daily.total_cost += row.custo_estimado || 0;
    daily.total_tokens += (row.tokens_input || 0) + (row.tokens_output || 0);
    dailyMap.set(day, daily);

    totalCost += row.custo_estimado || 0;
    totalCalls++;
    totalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
    if (!row.success) totalErrors++;
    if (row.latency_ms) { totalLatency += row.latency_ms; latencyCount++; }
  }

  return {
    byFunction: Array.from(fnMap.values()).sort((a, b) => b.total_cost_usd - a.total_cost_usd),
    dailyTrend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    totalCost, totalCalls, totalTokens,
    errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
    avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
  };
}

const mockRows = [
  { function_name: 'copilot-chat', provider: 'openai', model: 'gpt-4o', success: true, tokens_input: 500, tokens_output: 200, custo_estimado: 0.01, latency_ms: 300, created_at: '2026-02-10T10:00:00Z' },
  { function_name: 'copilot-chat', provider: 'openai', model: 'gpt-4o', success: false, tokens_input: 100, tokens_output: 0, custo_estimado: 0.002, latency_ms: 150, created_at: '2026-02-10T11:00:00Z' },
  { function_name: 'sdr-ia-interpret', provider: 'google', model: 'gemini-2.5-flash', success: true, tokens_input: 800, tokens_output: 300, custo_estimado: 0.005, latency_ms: 200, created_at: '2026-02-11T09:00:00Z' },
];

describe('AI Cost Dashboard aggregation', () => {
  it('groups by function/provider/model', () => {
    const result = aggregateAICosts(mockRows);
    expect(result.byFunction).toHaveLength(2);
    expect(result.byFunction[0].function_name).toBe('copilot-chat');
    expect(result.byFunction[0].total_calls).toBe(2);
  });

  it('calculates daily trend sorted by date', () => {
    const result = aggregateAICosts(mockRows);
    expect(result.dailyTrend).toHaveLength(2);
    expect(result.dailyTrend[0].date).toBe('2026-02-10');
    expect(result.dailyTrend[1].date).toBe('2026-02-11');
    expect(result.dailyTrend[0].total_calls).toBe(2);
  });

  it('calculates KPIs correctly', () => {
    const result = aggregateAICosts(mockRows);
    expect(result.totalCalls).toBe(3);
    expect(result.totalCost).toBeCloseTo(0.017);
    expect(result.totalTokens).toBe(1900);
    expect(result.errorRate).toBeCloseTo(33.33, 1);
    expect(result.avgLatency).toBeGreaterThan(0);
  });

  it('handles empty rows', () => {
    const result = aggregateAICosts([]);
    expect(result.byFunction).toEqual([]);
    expect(result.dailyTrend).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.avgLatency).toBe(0);
  });

  it('sorts byFunction by cost descending', () => {
    const result = aggregateAICosts(mockRows);
    for (let i = 1; i < result.byFunction.length; i++) {
      expect(result.byFunction[i - 1].total_cost_usd).toBeGreaterThanOrEqual(result.byFunction[i].total_cost_usd);
    }
  });
});
