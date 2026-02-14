import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CSHealthLog } from '@/types/customerSuccess';

export function useCSHealthLog(customerId: string | undefined) {
  return useQuery({
    queryKey: ['cs-health-log', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_health_log')
        .select('*')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CSHealthLog[];
    },
  });
}
