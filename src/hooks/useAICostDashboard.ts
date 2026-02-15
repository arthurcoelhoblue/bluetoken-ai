import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AICostByFunction {
  function_name: string;
  provider: string;
  model: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  avg_latency_ms: number;
}

export interface AICostDaily {
  date: string;
  total_calls: number;
  total_cost: number;
  total_tokens: number;
}

export interface AICostSummary {
  byFunction: AICostByFunction[];
  dailyTrend: AICostDaily[];
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
  errorRate: number;
  avgLatency: number;
}

export function useAICostDashboard(days: number = 30) {
  return useQuery({
    queryKey: ["ai-cost-dashboard", days],
    queryFn: async (): Promise<AICostSummary> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("ai_usage_log")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = data || [];

      // Group by function+provider+model
      const fnMap = new Map<string, AICostByFunction>();
      const dailyMap = new Map<string, AICostDaily>();
      let totalCost = 0, totalCalls = 0, totalTokens = 0, totalErrors = 0, totalLatency = 0, latencyCount = 0;

      for (const row of rows) {
        const key = `${row.function_name}|${row.provider}|${row.model}`;
        const existing = fnMap.get(key) || {
          function_name: row.function_name,
          provider: row.provider,
          model: row.model,
          total_calls: 0, successful_calls: 0, failed_calls: 0,
          total_tokens_input: 0, total_tokens_output: 0,
          total_cost_usd: 0, avg_latency_ms: 0,
        };

        existing.total_calls++;
        if (row.success) existing.successful_calls++;
        else existing.failed_calls++;
        existing.total_tokens_input += row.tokens_input || 0;
        existing.total_tokens_output += row.tokens_output || 0;
        existing.total_cost_usd += row.custo_estimado || 0;
        if (row.latency_ms) {
          existing.avg_latency_ms = (existing.avg_latency_ms * (existing.total_calls - 1) + row.latency_ms) / existing.total_calls;
        }
        fnMap.set(key, existing);

        // Daily trend
        const day = (row.created_at || "").slice(0, 10);
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
        totalCost,
        totalCalls,
        totalTokens,
        errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
        avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      };
    },
  });
}
