import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CSMetrics } from '@/types/customerSuccess';
import { addDays, differenceInDays } from 'date-fns';

export function useCSMetrics() {
  const { activeCompanies } = useCompany();
  const isTokenizaOnly = activeCompanies.length === 1 && activeCompanies[0] === 'TOKENIZA';

  return useQuery({
    queryKey: ['cs-metrics', activeCompanies],
    queryFn: async () => {
      let query = supabase
        .from('cs_customers')
        .select('id, health_score, health_status, ultimo_nps, proxima_renovacao, is_active, empresa')
        .eq('is_active', true);

      query = query.in('empresa', activeCompanies);

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
        churn_rate: 0,
      };

      // Tokeniza-specific metrics
      if (activeCompanies.includes('TOKENIZA')) {
        const tokenizaCustomerIds = customers
          .filter(c => c.empresa === 'TOKENIZA')
          .map(c => c.id);

        if (tokenizaCustomerIds.length > 0) {
          const { data: contracts } = await supabase
            .from('cs_contracts')
            .select('customer_id, valor, data_contratacao')
            .eq('empresa', 'TOKENIZA')
            .in('customer_id', tokenizaCustomerIds);

          const now = new Date();
          let totalInvestido = 0;
          let totalContratos = 0;
          const lastDates = new Map<string, string>();

          for (const c of contracts ?? []) {
            const cid = (c as any).customer_id as string;
            const val = (c as any).valor ?? 0;
            const dc = (c as any).data_contratacao as string | null;
            totalInvestido += val;
            totalContratos += 1;
            if (dc && (!lastDates.has(cid) || dc > lastDates.get(cid)!)) {
              lastDates.set(cid, dc);
            }
          }

          const inativos90d = Array.from(lastDates.values())
            .filter(d => differenceInDays(now, new Date(d)) > 90).length;

          // Clients with NO contracts at all are also inactive
          const clientsWithContracts = new Set(lastDates.keys());
          const clientsWithoutContracts = tokenizaCustomerIds.filter(id => !clientsWithContracts.has(id));

          metrics.inativos_90d = inativos90d + clientsWithoutContracts.length;
          metrics.total_investido = totalInvestido;
          metrics.ticket_medio = totalContratos > 0 ? Math.round(totalInvestido / totalContratos) : 0;

          // Tokeniza churn: >365 days without investment
          if (isTokenizaOnly) {
            const churned = Array.from(lastDates.values())
              .filter(d => differenceInDays(now, new Date(d)) > 365).length;
            const totalTokeniza = tokenizaCustomerIds.length;
            metrics.churn_rate = totalTokeniza > 0
              ? Math.round(((churned + clientsWithoutContracts.length) / totalTokeniza) * 100)
              : 0;
            // Override renovacoes with inativos for Tokeniza
            metrics.renovacoes_30_dias = metrics.inativos_90d;
          }
        }
      }

      return metrics;
    },
  });
}
