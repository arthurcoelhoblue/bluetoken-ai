import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { Contact } from '@/types/deal';

export function useContacts(search?: string) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['contacts', activeCompany, search],
    queryFn: async (): Promise<Contact[]> => {
      let query = supabase
        .from('contacts')
        .select('*')
        .order('nome', { ascending: true })
        .limit(200);

      if (activeCompany !== 'all') {
        query = query.eq('empresa', activeCompany.toUpperCase() as 'BLUE' | 'TOKENIZA');
      }

      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nome: string; email?: string; telefone?: string; empresa: 'BLUE' | 'TOKENIZA' }) => {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          nome: data.nome,
          email: data.email ?? null,
          telefone: data.telefone ?? null,
          empresa: data.empresa,
        })
        .select()
        .single();
      if (error) throw error;
      return contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
