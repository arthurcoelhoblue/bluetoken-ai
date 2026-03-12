import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

interface DealPerDay {
  dia: string;
  count: number;
}

export function useDealsCreatedPerDay(empresa?: string | null) {
  return useQuery({
    queryKey: ['deals_created_per_day', empresa],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      let q = supabase
        .from('deals')
        .select('created_at, pipeline_id, pipelines!inner(empresa)')
        .gte('created_at', since);

      if (empresa) {
        q = q.eq('pipelines.empresa', empresa as any);
      }

      const { data, error } = await q;
      if (error) throw error;

      const grouped = (data ?? []).reduce<Record<string, number>>((acc, deal) => {
        const day = format(new Date(deal.created_at), 'dd/MM');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      // Fill last 30 days
      const result: DealPerDay[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, 'dd/MM');
        result.push({ dia: key, count: grouped[key] || 0 });
      }
      return result;
    },
    refetchInterval: 60_000,
  });
}
