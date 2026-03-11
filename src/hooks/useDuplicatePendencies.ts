import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DuplicatePendency {
  id: string;
  empresa: string;
  new_contact_id: string;
  new_deal_id: string;
  existing_contact_id: string | null;
  existing_deal_id: string | null;
  match_type: string;
  match_details: Record<string, unknown>;
  status: string;
  created_at: string;
  // Joined data
  new_contact?: { nome: string; email: string | null; telefone: string | null };
  new_deal?: { titulo: string; valor: number | null };
  existing_contact?: { nome: string; email: string | null; telefone: string | null };
  existing_deal?: { titulo: string; valor: number | null; status: string };
}

export function useDuplicatePendencies() {
  return useQuery({
    queryKey: ['duplicate-pendencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('duplicate_pendencies')
        .select(`
          *,
          new_contact:contacts!duplicate_pendencies_new_contact_id_fkey(nome, email, telefone),
          new_deal:deals!duplicate_pendencies_new_deal_id_fkey(titulo, valor),
          existing_contact:contacts!duplicate_pendencies_existing_contact_id_fkey(nome, email, telefone),
          existing_deal:deals!duplicate_pendencies_existing_deal_id_fkey(titulo, valor, status)
        `)
        .eq('status', 'PENDENTE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DuplicatePendency[];
    },
  });
}

export function useDuplicatePendencyCount() {
  const { data } = useDuplicatePendencies();
  return data?.length ?? 0;
}

type ResolveAction = 'MERGED' | 'KEPT_SEPARATE' | 'DISMISSED';

export function useResolveDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: ResolveAction }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('duplicate_pendencies')
        .update({
          status: action,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicate-pendencies'] });
    },
    onError: (err) => {
      toast.error('Erro ao resolver pendência: ' + (err as Error).message);
    },
  });
}
