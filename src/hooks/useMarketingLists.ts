import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface MarketingList {
  id: string;
  nome: string;
  descricao: string | null;
  empresa: string;
  tipo: string;
  filtros: Record<string, unknown>;
  created_by: string | null;
  is_active: boolean;
  total_leads: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingListMember {
  id: string;
  list_id: string;
  contact_id: string | null;
  legacy_lead_id: string | null;
  status: string;
  notas: string | null;
  added_at: string;
  contatado_at: string | null;
  contacts?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
  } | null;
}

export function useMarketingLists() {
  const { activeCompanies } = useCompany();

  return useQuery({
    queryKey: ['marketing-lists', activeCompanies],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_lists')
        .select('*')
        .in('empresa', activeCompanies)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingList[];
    },
  });
}

export function useMarketingListMembers(listId: string | null) {
  return useQuery({
    queryKey: ['marketing-list-members', listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_list_members')
        .select('*, contacts(id, nome, email, telefone)')
        .eq('list_id', listId!)
        .neq('status', 'REMOVIDO')
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingListMember[];
    },
  });
}

export function useCreateMarketingList() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { nome: string; descricao?: string; empresa: string; tipo?: string }) => {
      const { data, error } = await supabase
        .from('marketing_lists')
        .insert({
          nome: input.nome,
          descricao: input.descricao || null,
          empresa: input.empresa,
          tipo: input.tipo || 'MANUAL',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-lists'] });
      toast.success('Lista criada com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao criar lista: ' + (err instanceof Error ? err.message : String(err)));
    },
  });
}

export function useAddMembersToList() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { listId: string; contactIds: string[] }) => {
      const rows = input.contactIds.map(cid => ({
        list_id: input.listId,
        contact_id: cid,
        status: 'PENDENTE',
      }));
      const { error } = await supabase
        .from('marketing_list_members')
        .upsert(rows, { onConflict: 'list_id,contact_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-list-members'] });
      qc.invalidateQueries({ queryKey: ['marketing-lists'] });
      toast.success('Leads adicionados à lista!');
    },
    onError: (err) => {
      toast.error('Erro ao adicionar leads: ' + (err instanceof Error ? err.message : String(err)));
    },
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberId: string; status: string; notas?: string }) => {
      const update: Record<string, unknown> = { status: input.status };
      if (input.status === 'CONTATADO') update.contatado_at = new Date().toISOString();
      if (input.notas !== undefined) update.notas = input.notas;
      const { error } = await supabase
        .from('marketing_list_members')
        .update(update)
        .eq('id', input.memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-list-members'] });
      qc.invalidateQueries({ queryKey: ['marketing-lists'] });
    },
  });
}

export function useDeleteMarketingList() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('marketing_lists')
        .update({ is_active: false })
        .eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-lists'] });
      toast.success('Lista removida.');
    },
  });
}
