import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DealProduct {
  id: string;
  deal_id: string;
  product_id: string | null;
  nome: string;
  preco_unitario: number;
  quantidade: number;
  desconto: number;
  subtotal: number;
  created_at: string;
}

export interface CatalogProduct {
  id: string;
  empresa: string;
  nome: string;
  descricao: string | null;
  preco_unitario: number;
  unidade: string;
  ativo: boolean;
}

export function useDealProducts(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-products', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealProduct[]> => {
      const { data, error } = await supabase
        .from('deal_products')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as DealProduct[];
    },
  });
}

export function useCatalogProducts(empresa: string | null) {
  return useQuery({
    queryKey: ['catalog-products', empresa],
    enabled: !!empresa,
    queryFn: async (): Promise<CatalogProduct[]> => {
      const { data, error } = await supabase
        .from('catalog_products')
        .select('*')
        .eq('empresa', empresa! as 'BLUE')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as CatalogProduct[];
    },
  });
}

export function useAddDealProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      product_id?: string;
      nome: string;
      preco_unitario: number;
      quantidade: number;
      desconto?: number;
    }) => {
      const { error } = await supabase.from('deal_products').insert({
        deal_id: params.deal_id,
        product_id: params.product_id ?? null,
        nome: params.nome,
        preco_unitario: params.preco_unitario,
        quantidade: params.quantidade,
        desconto: params.desconto ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-products', vars.deal_id] });
      toast.success('Produto adicionado');
    },
    onError: () => toast.error('Erro ao adicionar produto'),
  });
}

export function useRemoveDealProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase.from('deal_products').delete().eq('id', id);
      if (error) throw error;
      return dealId;
    },
    onSuccess: (dealId) => {
      qc.invalidateQueries({ queryKey: ['deal-products', dealId] });
      toast.success('Produto removido');
    },
    onError: () => toast.error('Erro ao remover produto'),
  });
}
