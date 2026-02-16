import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CSBenchmarkData {
  porEmpresa: { empresa: string; healthMedio: number; count: number }[];
  porCSM: { csmId: string; csmNome: string; healthMedio: number; count: number }[];
  porFaixaMRR: { faixa: string; healthMedio: number; count: number }[];
}

function getMrrFaixa(mrr: number): string {
  if (mrr < 500) return '< R$500';
  if (mrr < 2000) return 'R$500-2k';
  if (mrr < 5000) return 'R$2k-5k';
  if (mrr < 10000) return 'R$5k-10k';
  return '> R$10k';
}

export function useCSBenchmarks() {
  return useQuery({
    queryKey: ['cs-benchmarks'],
    queryFn: async (): Promise<CSBenchmarkData> => {
      const { data, error } = await supabase
        .from('cs_customers')
        .select('empresa, health_score, valor_mrr, csm_id, csm:profiles!cs_customers_csm_id_fkey(nome)')
        .eq('is_active', true);

      if (error) throw error;
      const customers = data ?? [];

      // By empresa
      const empresaMap = new Map<string, { sum: number; count: number }>();
      // By CSM
      const csmMap = new Map<string, { nome: string; sum: number; count: number }>();
      // By MRR range
      const mrrMap = new Map<string, { sum: number; count: number }>();

      for (const c of customers) {
        const hs = c.health_score ?? 0;
        const emp = (c.empresa as string) ?? 'UNKNOWN';

        const eEntry = empresaMap.get(emp) ?? { sum: 0, count: 0 };
        eEntry.sum += hs; eEntry.count++;
        empresaMap.set(emp, eEntry);

        if (c.csm_id) {
          const cEntry = csmMap.get(c.csm_id) ?? { nome: (c.csm as { nome?: string } | null)?.nome ?? 'CSM', sum: 0, count: 0 };
          cEntry.sum += hs; cEntry.count++;
          csmMap.set(c.csm_id, cEntry);
        }

        const faixa = getMrrFaixa(c.valor_mrr ?? 0);
        const mEntry = mrrMap.get(faixa) ?? { sum: 0, count: 0 };
        mEntry.sum += hs; mEntry.count++;
        mrrMap.set(faixa, mEntry);
      }

      return {
        porEmpresa: Array.from(empresaMap.entries()).map(([empresa, v]) => ({
          empresa, healthMedio: Math.round(v.sum / v.count), count: v.count,
        })),
        porCSM: Array.from(csmMap.entries()).map(([csmId, v]) => ({
          csmId, csmNome: v.nome, healthMedio: Math.round(v.sum / v.count), count: v.count,
        })).sort((a, b) => b.healthMedio - a.healthMedio),
        porFaixaMRR: Array.from(mrrMap.entries()).map(([faixa, v]) => ({
          faixa, healthMedio: Math.round(v.sum / v.count), count: v.count,
        })),
      };
    },
  });
}
