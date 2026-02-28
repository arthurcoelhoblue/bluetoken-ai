import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CSContract } from '@/types/customerSuccess';

export function useCSContracts(customerId: string | undefined) {
  return useQuery({
    queryKey: ['cs-contracts', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_contracts')
        .select('*')
        .eq('customer_id', customerId!)
        .order('ano_fiscal', { ascending: false });
      if (error) throw error;
      return data as unknown as CSContract[];
    },
  });
}

interface CreateCSContractData {
  customer_id: string;
  empresa: string;
  ano_fiscal: number;
  plano: string;
  valor?: number;
  data_contratacao?: string | null;
  data_vencimento?: string | null;
  status?: string;
  notas?: string | null;
}

export function useCreateCSContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCSContractData) => {
      const { data: row, error } = await supabase
        .from('cs_contracts')
        .insert({
          customer_id: data.customer_id,
          empresa: data.empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
          ano_fiscal: data.ano_fiscal,
          plano: data.plano,
          valor: data.valor ?? 0,
          data_contratacao: data.data_contratacao ?? null,
          data_vencimento: data.data_vencimento ?? null,
          status: data.status ?? 'ATIVO',
          notas: data.notas ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cs-contracts', vars.customer_id] });
      qc.invalidateQueries({ queryKey: ['cs-customers'] });
    },
  });
}

export function useUpdateCSContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CSContract> & { id: string }) => {
      const { data, error } = await supabase
        .from('cs_contracts')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-contracts'] });
      qc.invalidateQueries({ queryKey: ['cs-customers'] });
    },
  });
}
