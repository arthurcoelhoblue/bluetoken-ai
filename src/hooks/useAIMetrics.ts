import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSystemSettings } from "./useSystemSettings";

interface AIMetricsByProvider {
  provider: string;
  totalCalls: number;
  totalTokens: number;
  avgProcessingMs: number;
  estimatedCostUSD: number;
}

interface AIMetricsSummary {
  byProvider: AIMetricsByProvider[];
  totalCalls: number;
  totalTokens: number;
  totalCostUSD: number;
  fallbackRate: number;
}

export function useAIMetrics(days: number = 30) {
  const { activeCompanies } = useCompany();
  const { getSettingValue } = useSystemSettings("ia");

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["ai-metrics", days, activeCompanies],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("lead_message_intents")
        .select("modelo_ia, tokens_usados, tempo_processamento_ms, created_at")
        .in("empresa", activeCompanies)
        .gte("created_at", startDate.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  const calculateMetrics = (): AIMetricsSummary | null => {
    if (!metrics) return null;

    const custos = getSettingValue<{
      precos_por_1k_tokens: Record<string, { input: number; output: number }>;
    }>("custos", {
      precos_por_1k_tokens: {
        ANTHROPIC: { input: 0.003, output: 0.015 },
        GEMINI: { input: 0.000125, output: 0.0005 },
        GPT: { input: 0.00015, output: 0.0006 },
      },
    });

    const byProviderMap = new Map<string, {
      calls: number;
      tokens: number;
      processingMs: number[];
    }>();

    let fallbackCount = 0;
    const modelPriority = getSettingValue<{ ordem: string[] }>("model_priority", { ordem: ["ANTHROPIC"] });
    const primaryProvider = modelPriority.ordem[0];

    metrics.forEach((record) => {
      const provider = normalizeProvider(record.modelo_ia || "UNKNOWN");
      
      if (provider !== primaryProvider && provider !== "UNKNOWN") {
        fallbackCount++;
      }

      const existing = byProviderMap.get(provider) || { calls: 0, tokens: 0, processingMs: [] };
      existing.calls++;
      existing.tokens += record.tokens_usados || 0;
      if (record.tempo_processamento_ms) {
        existing.processingMs.push(record.tempo_processamento_ms);
      }
      byProviderMap.set(provider, existing);
    });

    const byProvider: AIMetricsByProvider[] = [];
    let totalCalls = 0;
    let totalTokens = 0;
    let totalCostUSD = 0;

    byProviderMap.forEach((data, provider) => {
      const avgProcessingMs = data.processingMs.length > 0
        ? data.processingMs.reduce((a, b) => a + b, 0) / data.processingMs.length
        : 0;

      const priceKey = provider.toUpperCase();
      const prices = custos.precos_por_1k_tokens[priceKey] || { input: 0.001, output: 0.002 };
      // Estimate 30% input, 70% output tokens
      const inputTokens = data.tokens * 0.3;
      const outputTokens = data.tokens * 0.7;
      const cost = (inputTokens * prices.input + outputTokens * prices.output) / 1000;

      byProvider.push({
        provider,
        totalCalls: data.calls,
        totalTokens: data.tokens,
        avgProcessingMs: Math.round(avgProcessingMs),
        estimatedCostUSD: cost,
      });

      totalCalls += data.calls;
      totalTokens += data.tokens;
      totalCostUSD += cost;
    });

    const fallbackRate = totalCalls > 0 ? (fallbackCount / totalCalls) * 100 : 0;

    return {
      byProvider: byProvider.sort((a, b) => b.totalCalls - a.totalCalls),
      totalCalls,
      totalTokens,
      totalCostUSD,
      fallbackRate,
    };
  };

  return {
    metrics: calculateMetrics(),
    isLoading,
    error,
  };
}

function normalizeProvider(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic")) return "ANTHROPIC";
  if (lower.includes("gemini") || lower.includes("google")) return "GEMINI";
  if (lower.includes("gpt") || lower.includes("openai")) return "GPT";
  return modelName.toUpperCase();
}
