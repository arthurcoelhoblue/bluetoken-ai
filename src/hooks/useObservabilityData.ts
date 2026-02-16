import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WebVitalEvent {
  name: string;
  value: number;
  rating: string;
  count: number;
  avg: number;
}

interface EdgeFunctionLatency {
  function_name: string;
  provider: string;
  model: string;
  total: number;
  avg_latency_ms: number;
  errors: number;
  success_rate: number;
}

interface RecentError {
  id: string;
  event_name: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function useWebVitals(hours = 24) {
  return useQuery({
    queryKey: ['web-vitals', hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('analytics_events')
        .select('metadata, created_at')
        .eq('event_category', 'performance')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const grouped: Record<string, { values: number[]; ratings: Record<string, number> }> = {};
      for (const row of data || []) {
        const meta = row.metadata as Record<string, unknown> | null;
        if (!meta?.name) continue;
        const name = meta.name as string;
        if (!grouped[name]) grouped[name] = { values: [], ratings: {} };
        grouped[name].values.push(meta.value as number);
        const rating = (meta.rating as string) || 'unknown';
        grouped[name].ratings[rating] = (grouped[name].ratings[rating] || 0) + 1;
      }

      const vitals: WebVitalEvent[] = Object.entries(grouped).map(([name, g]) => ({
        name,
        value: g.values[0] || 0,
        avg: g.values.reduce((a, b) => a + b, 0) / g.values.length,
        rating: Object.entries(g.ratings).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
        count: g.values.length,
      }));

      return vitals;
    },
    refetchInterval: 60_000,
  });
}

export function useEdgeFunctionLatency(hours = 24) {
  return useQuery({
    queryKey: ['edge-fn-latency', hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('function_name, provider, model, latency_ms, success')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const grouped: Record<string, { latencies: number[]; errors: number; total: number; provider: string; model: string }> = {};
      for (const row of data || []) {
        const key = row.function_name;
        if (!grouped[key]) grouped[key] = { latencies: [], errors: 0, total: 0, provider: row.provider, model: row.model };
        grouped[key].total++;
        if (row.latency_ms) grouped[key].latencies.push(row.latency_ms);
        if (row.success === false) grouped[key].errors++;
      }

      const results: EdgeFunctionLatency[] = Object.entries(grouped)
        .map(([fn, g]) => ({
          function_name: fn,
          provider: g.provider,
          model: g.model,
          total: g.total,
          avg_latency_ms: g.latencies.length > 0
            ? Math.round(g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length)
            : 0,
          errors: g.errors,
          success_rate: g.total > 0 ? Math.round(((g.total - g.errors) / g.total) * 100) : 100,
        }))
        .sort((a, b) => b.total - a.total);

      return results;
    },
    refetchInterval: 60_000,
  });
}

export function useRecentErrors(hours = 24) {
  return useQuery({
    queryKey: ['recent-errors', hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('analytics_events')
        .select('id, event_name, created_at, metadata')
        .eq('event_category', 'error')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as RecentError[];
    },
    refetchInterval: 60_000,
  });
}
