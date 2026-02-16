import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { addDays } from 'date-fns';

export interface CSRevenueForecast {
  mrrTotal: number;
  mrrProjetado: number;
  mrrEmRisco: number;
  porSegmento: {
    saudavel: { count: number; mrr: number };
    atencao: { count: number; mrr: number };
    emRisco: { count: number; mrr: number };
    critico: { count: number; mrr: number };
  };
  renovacoes90d: { count: number; mrr: number };
}

const WEIGHTS: Record<string, number> = {
  SAUDAVEL: 1.0,
  ATENCAO: 0.8,
  EM_RISCO: 0.5,
  CRITICO: 0.2,
};

export function useCSRevenueForecast() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['cs-revenue-forecast', activeCompany],
    queryFn: async (): Promise<CSRevenueForecast> => {
      let query = supabase
        .from('cs_customers')
        .select('health_status, valor_mrr, proxima_renovacao')
        .eq('is_active', true);

      if (activeCompany && activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany as 'BLUE' | 'TOKENIZA');
      }

      const { data, error } = await query;
      if (error) throw error;

      const customers = data ?? [];
      const seg = {
        saudavel: { count: 0, mrr: 0 },
        atencao: { count: 0, mrr: 0 },
        emRisco: { count: 0, mrr: 0 },
        critico: { count: 0, mrr: 0 },
      };

      let mrrTotal = 0;
      let mrrProjetado = 0;
      const in90d = addDays(new Date(), 90).toISOString().split('T')[0];
      let renovacoesCount = 0;
      let renovacoesMrr = 0;

      for (const c of customers) {
        const mrr = c.valor_mrr ?? 0;
        const status = c.health_status ?? 'ATENCAO';
        mrrTotal += mrr;
        mrrProjetado += mrr * (WEIGHTS[status] ?? 0.5);

        if (status === 'SAUDAVEL') { seg.saudavel.count++; seg.saudavel.mrr += mrr; }
        else if (status === 'ATENCAO') { seg.atencao.count++; seg.atencao.mrr += mrr; }
        else if (status === 'EM_RISCO') { seg.emRisco.count++; seg.emRisco.mrr += mrr; }
        else if (status === 'CRITICO') { seg.critico.count++; seg.critico.mrr += mrr; }

        if (c.proxima_renovacao && c.proxima_renovacao <= in90d) {
          renovacoesCount++;
          renovacoesMrr += mrr;
        }
      }

      return {
        mrrTotal,
        mrrProjetado: Math.round(mrrProjetado),
        mrrEmRisco: Math.round(mrrTotal - mrrProjetado),
        porSegmento: seg,
        renovacoes90d: { count: renovacoesCount, mrr: renovacoesMrr },
      };
    },
  });
}
