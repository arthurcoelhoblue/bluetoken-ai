import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

export interface NextBestAction {
  titulo: string;
  motivo: string;
  deal_id?: string;
  lead_id?: string;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  tipo_acao: 'TAREFA' | 'FOLLOW_UP' | 'SLA' | 'DEAL_PARADO' | 'LEAD_QUENTE' | 'CS_RISCO';
}

export interface NBAResponse {
  acoes: NextBestAction[];
  narrativa_dia: string;
}

export function useNextBestAction() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['next-best-action', user?.id, activeCompany],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<NBAResponse> => {
      const empresa = activeCompany;
      const { data, error } = await supabase.functions.invoke('next-best-action', {
        body: { user_id: user!.id, empresa },
      });

      if (error) throw error;
      return {
        acoes: data?.acoes ?? [],
        narrativa_dia: data?.narrativa_dia ?? '',
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['next-best-action'] });

  return { ...query, refresh };
}
