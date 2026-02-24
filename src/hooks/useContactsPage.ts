import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { ContactWithStats, ContactFormData } from '@/types/contactsPage';

const PAGE_SIZE = 25;

export function useContactsPage(opts: {
  search?: string;
  tipoFilter?: string;
  clienteFilter?: string;
  page?: number;
}) {
  const { activeCompanies } = useCompany();
  const { search, tipoFilter, clienteFilter, page = 0 } = opts;

  return useQuery({
    queryKey: ['contacts_with_stats', activeCompanies, search, tipoFilter, clienteFilter, page],
    queryFn: async (): Promise<{ data: ContactWithStats[]; count: number }> => {
      let query = supabase
        .from('contacts_with_stats' as never)
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      query = query.in('empresa', activeCompanies);
      if (search && search.length >= 2) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`);
      }
      if (tipoFilter && tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }
      if (clienteFilter === 'sim') {
        query = query.eq('is_cliente', true);
      } else if (clienteFilter === 'nao') {
        query = query.eq('is_cliente', false);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as ContactWithStats[], count: count ?? 0 };
    },
  });
}

export function useContactDetail(id: string | null) {
  return useQuery({
    queryKey: ['contact_detail', id],
    enabled: !!id,
    queryFn: async (): Promise<ContactWithStats | null> => {
      const { data, error } = await supabase
        .from('contacts_with_stats' as never)
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ContactWithStats | null;
    },
  });
}

export function useCreateContactPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ContactFormData) => {
      const { error } = await supabase.from('contacts').insert(data as never);
      if (error) {
        if (error.message?.includes('duplicate key') || error.code === '23505') {
          throw new Error('Já existe um contato ativo com este email ou telefone.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts_with_stats'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateContactPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ContactFormData> & { id: string }) => {
      const { error } = await supabase.from('contacts').update(data as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts_with_stats'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact_detail'] });
    },
  });
}

export function useDeleteContactPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase.from('contacts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts_with_stats'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useContactDeals(contactId: string | null) {
  return useQuery({
    queryKey: ['contact_deals', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, pipeline_stages(id, nome, cor, is_won, is_lost)')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export { PAGE_SIZE };
