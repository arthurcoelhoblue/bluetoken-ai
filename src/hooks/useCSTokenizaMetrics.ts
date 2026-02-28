import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CSTokenizaCustomerMetrics } from '@/types/customerSuccess';
import { differenceInDays } from 'date-fns';

/**
 * Fetches aggregated investment metrics for Tokeniza customers.
 * Returns a map of customer_id -> metrics for easy lookup.
 */
export function useCSTokenizaMetrics(customerIds?: string[]) {
  return useQuery({
    queryKey: ['cs-tokeniza-metrics', customerIds],
    enabled: customerIds === undefined || customerIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('cs_contracts')
        .select('customer_id, valor, data_contratacao')
        .eq('empresa', 'TOKENIZA');

      if (customerIds && customerIds.length > 0) {
        query = query.in('customer_id', customerIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      const grouped = new Map<string, { total: number; count: number; ultimo: string | null }>();

      for (const row of data ?? []) {
        const cid = (row as any).customer_id as string;
        const existing = grouped.get(cid) || { total: 0, count: 0, ultimo: null };
        existing.total += (row as any).valor ?? 0;
        existing.count += 1;
        const dc = (row as any).data_contratacao as string | null;
        if (dc && (!existing.ultimo || dc > existing.ultimo)) {
          existing.ultimo = dc;
        }
        grouped.set(cid, existing);
      }

      const metricsMap = new Map<string, CSTokenizaCustomerMetrics>();
      for (const [cid, agg] of grouped) {
        metricsMap.set(cid, {
          customer_id: cid,
          total_investido: agg.total,
          qtd_investimentos: agg.count,
          ticket_medio: agg.count > 0 ? Math.round(agg.total / agg.count) : 0,
          ultimo_investimento: agg.ultimo,
          dias_sem_investir: agg.ultimo ? differenceInDays(now, new Date(agg.ultimo)) : null,
        });
      }

      return metricsMap;
    },
  });
}

/**
 * Fetches distinct readable offer names for Tokeniza (excluding UUIDs and TEMP).
 */
export function useCSTokenizaOfertas() {
  return useQuery({
    queryKey: ['cs-tokeniza-ofertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_contracts')
        .select('oferta_nome')
        .eq('empresa', 'TOKENIZA')
        .not('oferta_nome', 'is', null);

      if (error) throw error;

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const names = new Set<string>();
      for (const row of data ?? []) {
        const name = (row as any).oferta_nome as string;
        if (name && name !== 'TEMP' && !uuidPattern.test(name)) {
          names.add(name);
        }
      }
      return Array.from(names).sort();
    },
  });
}
