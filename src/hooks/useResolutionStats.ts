import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { parseISO, format, subDays } from 'date-fns';

interface DailyStat {
  dia: string;
  label: string;
  autonomas: number;
  escaladas: number;
  total: number;
}

interface ResolutionSummary {
  totalConversas: number;
  totalAutonomas: number;
  totalEscaladas: number;
  taxaResolucao: number;
  dailyStats: DailyStat[];
}

export function useResolutionStats() {
  const { activeCompanies } = useCompany();

  return useQuery<ResolutionSummary>({
    queryKey: ['resolution-stats', activeCompanies],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amelia_resolution_stats')
        .select('*')
        .in('empresa', activeCompanies)
        .gte('dia', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      if (error) throw error;

      // Aggregate by day across companies
      const byDay = new Map<string, { autonomas: number; escaladas: number; total: number }>();
      let totalConversas = 0, totalAutonomas = 0, totalEscaladas = 0;

      for (const row of data ?? []) {
        const d = row.dia as string;
        const prev = byDay.get(d) || { autonomas: 0, escaladas: 0, total: 0 };
        const autonomas = Number(row.resolvidas_autonomamente ?? 0);
        const escaladas = Number(row.escaladas ?? 0);
        const total = Number(row.total_conversas ?? 0);
        byDay.set(d, {
          autonomas: prev.autonomas + autonomas,
          escaladas: prev.escaladas + escaladas,
          total: prev.total + total,
        });
        totalConversas += total;
        totalAutonomas += autonomas;
        totalEscaladas += escaladas;
      }

      const dailyStats: DailyStat[] = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, v]) => ({
          dia,
          label: format(parseISO(dia), 'dd/MM'),
          ...v,
        }));

      const taxaResolucao = totalConversas > 0
        ? Math.round((totalAutonomas / totalConversas) * 100)
        : 0;

      return { totalConversas, totalAutonomas, totalEscaladas, taxaResolucao, dailyStats };
    },
    refetchInterval: 60_000,
  });
}
