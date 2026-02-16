import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { Contact } from '@/types/deal';

const PAGE_SIZE = 25;

export function useContacts(search?: string, page = 0) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['contacts', activeCompany, search, page],
    queryFn: async (): Promise<{ data: Contact[]; count: number }> => {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('nome', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      query = query.eq('empresa', activeCompany);

      if (search) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as Contact[], count: count ?? 0 };
    },
  });
}

export interface CreateContactData {
  nome: string;
  primeiro_nome?: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  empresa: 'BLUE' | 'TOKENIZA';
  organization_id?: string;
  tipo?: string;
  cpf?: string;
  tags?: string[];
  notas?: string;
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateContactData) => {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          nome: data.nome,
          primeiro_nome: data.primeiro_nome ?? null,
          sobrenome: data.sobrenome ?? null,
          email: data.email ?? null,
          telefone: data.telefone ?? null,
          empresa: data.empresa,
          organization_id: data.organization_id ?? null,
          tipo: data.tipo ?? null,
          cpf: data.cpf ?? null,
          tags: data.tags ?? [],
          notas: data.notas ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
