import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CSMetrics } from '@/types/customerSuccess';
import { addDays } from 'date-fns';

export function useCSMetrics() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['cs-metrics', activeCompany],
    queryFn: async () => {
      let query = supabase
        .from('cs_customers')
        .select('health_score, health_status, ultimo_nps, proxima_renovacao, is_active')
        .eq('is_active', true);

      if (activeCompany && activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany as 'BLUE' | 'TOKENIZA');
      }

      const { data, error } = await query;
      if (error) throw error;

      const customers = data ?? [];
      const total = customers.length;
      const healthSum = customers.reduce((s, c) => s + (c.health_score ?? 0), 0);
      const npsValues = customers.filter(c => c.ultimo_nps != null).map(c => c.ultimo_nps!);
      const npsSum = npsValues.reduce((s, v) => s + v, 0);
      const emRisco = customers.filter(c => c.health_status === 'EM_RISCO' || c.health_status === 'CRITICO').length;
      
      const in30days = addDays(new Date(), 30).toISOString().split('T')[0];
      const renovacoes = customers.filter(c => c.proxima_renovacao && c.proxima_renovacao <= in30days).length;

      const metrics: CSMetrics = {
        total_clientes: total,
        health_medio: total > 0 ? Math.round(healthSum / total) : 0,
        nps_medio: npsValues.length > 0 ? Math.round((npsSum / npsValues.length) * 10) / 10 : 0,
        clientes_em_risco: emRisco,
        renovacoes_30_dias: renovacoes,
        churn_rate: 0, // Calculated in Phase 2 with historical data
      };

      return metrics;
    },
  });
}
