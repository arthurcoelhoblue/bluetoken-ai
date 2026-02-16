import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface AdoptionMetric {
  feature: string;
  unique_users: number;
  total_events: number;
  last_used: string;
}

export function useAdoptionMetrics(days = 30) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ["adoption-metrics", days, activeCompany],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("analytics_events")
        .select("event_name, user_id, created_at")
        .eq("empresa", activeCompany)
        .gte("created_at", startDate.toISOString());

      if (error) throw error;

      const featureMap = new Map<string, { users: Set<string>; count: number; lastUsed: string }>();

      for (const row of data || []) {
        const existing = featureMap.get(row.event_name) || { users: new Set(), count: 0, lastUsed: "" };
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
    },
  });
}
