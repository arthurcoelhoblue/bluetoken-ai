import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TokenizaOffersResponse, TokenizaOferta } from "@/types/tokeniza";

export function useTokenizaOffers() {
  return useQuery({
    queryKey: ['tokeniza-offers'],
    queryFn: async (): Promise<TokenizaOffersResponse> => {
      const { data, error } = await supabase.functions.invoke('tokeniza-offers', {
        body: null,
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar ofertas');
      }

      return data as TokenizaOffersResponse;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useTokenizaOffer(offerId: string | undefined) {
  return useQuery({
    queryKey: ['tokeniza-offer', offerId],
    queryFn: async (): Promise<TokenizaOferta> => {
      if (!offerId) throw new Error('ID da oferta não informado');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tokeniza-offers?id=${encodeURIComponent(offerId)}`,
        {
          headers: {
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar oferta');
      }

      const offer = await response.json() as TokenizaOferta;
      return offer;
    },
    enabled: !!offerId,
    staleTime: 5 * 60 * 1000,
  });
}

// Ofertas abertas para uso em mensagens
export function useActiveTokenizaOffers() {
  const query = useTokenizaOffers();
  
  // API returns 'active', 'finished', 'inactive' - filter for active/open
  const activeOffers = query.data?.ofertas.filter(o => 
    o.status?.toLowerCase() === 'active' || o.status?.toLowerCase() === 'open'
  ) || [];
  
  return {
    ...query,
    activeOffers,
    summary: query.data?.resumo,
  };
}
