import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CSOfertaSemNome {
  oferta_id: string;
  oferta_nome_atual: string | null;
  qtd_clientes: number;
  qtd_contratos: number;
  volume_total: number;
  data_min: string | null;
  data_max: string | null;
}

/**
 * Returns all distinct oferta_ids where oferta_nome is either null or a raw UUID (= the ID itself).
 */
export function useCSOfertasSemNome() {
  return useQuery({
    queryKey: ['cs-ofertas-sem-nome'],
    queryFn: async (): Promise<CSOfertaSemNome[]> => {
      const { data, error } = await supabase
        .from('cs_contracts')
        .select('oferta_id, oferta_nome, customer_id, valor, data_contratacao')
        .eq('empresa', 'TOKENIZA')
        .eq('tipo', 'crowdfunding')
        .not('oferta_id', 'is', null);

      if (error) throw error;

      // Group by oferta_id and filter those without a real name
      const grouped = new Map<
        string,
        { oferta_nome: string | null; clientes: Set<string>; count: number; volume: number; datas: string[] }
      >();

      for (const row of data ?? []) {
        const oid = (row as any).oferta_id as string;
        const nome = (row as any).oferta_nome as string | null;

        // Only include if nome is null or is itself a UUID
        if (nome && !UUID_RE.test(nome)) continue;

        if (!grouped.has(oid)) {
          grouped.set(oid, { oferta_nome: nome, clientes: new Set(), count: 0, volume: 0, datas: [] });
        }
        const g = grouped.get(oid)!;
        g.clientes.add((row as any).customer_id as string);
        g.count += 1;
        g.volume += (row as any).valor ?? 0;
        const dc = (row as any).data_contratacao as string | null;
        if (dc) g.datas.push(dc);
      }

      return Array.from(grouped.entries())
        .map(([oferta_id, g]) => ({
          oferta_id,
          oferta_nome_atual: g.oferta_nome,
          qtd_clientes: g.clientes.size,
          qtd_contratos: g.count,
          volume_total: g.volume,
          data_min: g.datas.length ? g.datas.reduce((a, b) => (a < b ? a : b)) : null,
          data_max: g.datas.length ? g.datas.reduce((a, b) => (a > b ? a : b)) : null,
        }))
        .sort((a, b) => b.qtd_contratos - a.qtd_contratos);
    },
  });
}

/**
 * Bulk-updates oferta_nome (and plano as fallback label) for all cs_contracts with a given oferta_id.
 */
export function useUpdateOfertaNome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ oferta_id, nome }: { oferta_id: string; nome: string }) => {
      const { error } = await supabase
        .from('cs_contracts')
        .update({ oferta_nome: nome, plano: nome } as never)
        .eq('oferta_id', oferta_id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-ofertas-sem-nome'] });
      qc.invalidateQueries({ queryKey: ['cs-contracts-aportes'] });
      qc.invalidateQueries({ queryKey: ['cs-contracts'] });
      toast.success('Nome aplicado a todos os investimentos dessa oferta');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao aplicar nome: ${err.message}`);
    },
  });
}
