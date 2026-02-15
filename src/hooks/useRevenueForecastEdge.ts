import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface RevenueForecastEdge {
  generated_at: string;
  pipeline_total: number;
  pipeline_weighted: number;
  mrr_total: number;
  mrr_retained: number;
  arr_total: number;
  arr_retained: number;
  avg_close_days: number;
  avg_deal_value: number;
  pipeline_velocity_daily: number;
  open_deals_count: number;
  active_customers: number;
  forecast_30d: { pessimista: number; realista: number; otimista: number };
  forecast_90d: { pessimista: number; realista: number; otimista: number };
}

export function useRevenueForecastEdge() {
  return useQuery({
    queryKey: ['revenue-forecast-edge'],
    queryFn: async (): Promise<RevenueForecastEdge | null> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'revenue_forecast')
        .maybeSingle();

      if (error || !data?.value) return null;
      return data.value as unknown as RevenueForecastEdge;
    },
    staleTime: 5 * 60 * 1000, // 5min cache
  });
}
