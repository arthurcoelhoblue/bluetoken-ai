import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TokenizaOffersResponse, TokenizaOferta } from "@/types/tokeniza";

export function useTokenizaOffers(status?: string) {
  return useQuery({
    queryKey: ['tokeniza-offers', status],
    queryFn: async (): Promise<TokenizaOffersResponse> => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      
      const { data, error } = await supabase.functions.invoke('tokeniza-offers', {
        body: null,
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar ofertas');
      }

      return data as TokenizaOffersResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    refetchInterval: 10 * 60 * 1000, // Refresh a cada 10 minutos
  });
}

export function useTokenizaOffer(offerId: string | undefined) {
  return useQuery({
    queryKey: ['tokeniza-offer', offerId],
    queryFn: async (): Promise<TokenizaOferta> => {
      if (!offerId) throw new Error('ID da oferta não informado');
      
      const { data, error } = await supabase.functions.invoke('tokeniza-offers', {
        body: null,
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar oferta');
      }

      const response = data as TokenizaOffersResponse;
      const offer = response.ofertas.find(o => o.id === offerId);
      if (!offer) throw new Error('Oferta não encontrada');
      
      return offer;
    },
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000,
  });
}

// Ofertas abertas para uso em mensagens
export function useActiveTokenizaOffers() {
  const query = useTokenizaOffers();
  
  const activeOffers = query.data?.ofertas.filter(o => o.status === 'active') || [];
  
  return {
    ...query,
    activeOffers,
    summary: query.data?.resumo,
  };
}
