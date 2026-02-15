import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrphanDeal {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  created_at: string;
  contact_nome: string | null;
  pipeline_nome: string | null;
}

export function useOrphanDeals() {
  return useQuery({
    queryKey: ['orphan-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id, titulo, valor, status, created_at,
          contacts:contact_id(nome),
          pipelines:pipeline_id(nome)
        `)
        .is('owner_id', null)
        .eq('status', 'ABERTO')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => {
        const row = d as { id: string; titulo: string; valor: number | null; status: string; created_at: string; contacts: { nome: string } | null; pipelines: { nome: string } | null };
        return {
          id: row.id,
          titulo: row.titulo,
          valor: row.valor ?? 0,
          status: row.status,
          created_at: row.created_at,
          contact_nome: row.contacts?.nome ?? null,
          pipeline_nome: row.pipelines?.nome ?? null,
        };
      }) as OrphanDeal[];
    },
  });
}

export function useAssignDealOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, ownerId }: { dealId: string; ownerId: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ owner_id: ownerId })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orphan-deals'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Vendedor atribuído com sucesso');
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
