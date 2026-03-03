import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Meeting {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  owner_id: string;
  empresa: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  status: string;
  notas: string | null;
  transcricao_metadata: Record<string, unknown> | null;
  transcricao_processada: boolean;
  created_at: string;
}

export function useMeetings(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-meetings', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings' as any)
        .select('*')
        .eq('deal_id', dealId!)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Meeting[];
    },
  });
}
