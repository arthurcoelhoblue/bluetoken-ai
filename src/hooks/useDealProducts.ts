import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CatalogProduct {
  id: string;
  empresa: string;
  nome: string;
  descricao: string | null;
  preco_unitario: number;
  moeda: string;
  ativo: boolean;
}

export interface DealProduct {
  id: string;
  deal_id: string;
  catalog_product_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  desconto_tipo: 'PERCENTUAL' | 'VALOR';
  desconto_valor: number;
  subtotal: number;
  created_at: string;
}

export function useCatalogProducts(empresa: string | null) {
  return useQuery({
    queryKey: ['catalog-products', empresa],
    enabled: !!empresa,
    queryFn: async (): Promise<CatalogProduct[]> => {
      const { data, error } = await supabase
        .from('catalog_products' as 'deals')
        .select('*')
        .eq('empresa', empresa!)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as unknown as CatalogProduct[];
    },
  });
}

export function useDealProducts(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-products', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealProduct[]> => {
      const { data, error } = await supabase
        .from('deal_products' as 'deals')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at');
      if (error) throw error;
      return data as unknown as DealProduct[];
    },
  });
}

export function useAddDealProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      catalog_product_id?: string;
      nome: string;
      quantidade: number;
      preco_unitario: number;
      desconto_tipo: 'PERCENTUAL' | 'VALOR';
      desconto_valor: number;
    }) => {
      const { error } = await supabase
        .from('deal_products' as 'deals')
        .insert(params as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-products', vars.deal_id] });
    },
  });
}

export function useUpdateDealProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      deal_id: string;
      quantidade?: number;
      preco_unitario?: number;
      desconto_tipo?: 'PERCENTUAL' | 'VALOR';
      desconto_valor?: number;
    }) => {
      const { id, deal_id, ...updates } = params;
      const { error } = await supabase
        .from('deal_products' as 'deals')
        .update(updates as Record<string, unknown>)
        .eq('id', id);
      if (error) throw error;
      return deal_id;
    },
    onSuccess: (dealId) => {
      qc.invalidateQueries({ queryKey: ['deal-products', dealId] });
    },
  });
}

export function useRemoveDealProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deal_id }: { id: string; deal_id: string }) => {
      const { error } = await supabase
        .from('deal_products' as 'deals')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return deal_id;
    },
    onSuccess: (dealId) => {
      qc.invalidateQueries({ queryKey: ['deal-products', dealId] });
    },
  });
}
