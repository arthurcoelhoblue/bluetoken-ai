import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { Organization, OrganizationFormData } from '@/types/customFields';

export function useOrganizations(search?: string) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['organizations', activeCompany, search],
    queryFn: async (): Promise<Organization[]> => {
      let query = supabase
        .from('organizations')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })
        .limit(200);

      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany as 'BLUE' | 'TOKENIZA');
      }
      if (search && search.length >= 2) {
        query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%,nome_fantasia.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Organization[];
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: OrganizationFormData) => {
      const { error } = await supabase.from('organizations').insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OrganizationFormData> & { id: string }) => {
      const { error } = await supabase.from('organizations').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}
