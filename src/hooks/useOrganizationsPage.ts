import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { OrganizationWithStats, OrganizationFormData } from '@/types/contactsPage';

const PAGE_SIZE = 25;

export function useOrganizationsPage(opts: {
  search?: string;
  page?: number;
}) {
  const { activeCompanies } = useCompany();
  const { search, page = 0 } = opts;

  return useQuery({
    queryKey: ['organizations_with_stats', activeCompanies, search, page],
    queryFn: async (): Promise<{ data: OrganizationWithStats[]; count: number }> => {
      let query = supabase
        .from('organizations_with_stats')
        .select('*', { count: 'exact' })
        .eq('ativo', true)
        .order('nome', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      query = query.in('empresa', activeCompanies);
      if (search && search.length >= 2) {
        query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%,nome_fantasia.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as OrganizationWithStats[], count: count ?? 0 };
    },
  });
}

export function useOrgDetail(id: string | null) {
  return useQuery({
    queryKey: ['org_detail', id],
    enabled: !!id,
    queryFn: async (): Promise<OrganizationWithStats | null> => {
      const { data, error } = await supabase
        .from('organizations_with_stats')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OrganizationWithStats | null;
    },
  });
}

export function useCreateOrgPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: OrganizationFormData) => {
      const { error } = await supabase.from('organizations').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations_with_stats'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateOrgPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OrganizationFormData> & { id: string }) => {
      const { error } = await supabase.from('organizations').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations_with_stats'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['org_detail'] });
    },
  });
}

export function useOrgContacts(orgId: string | null) {
  return useQuery({
    queryKey: ['org_contacts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('organization_id', orgId!)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export { PAGE_SIZE as ORG_PAGE_SIZE };
