import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CSCustomer, CSCustomerFilters } from '@/types/customerSuccess';

const PAGE_SIZE = 25;

export function useCSCustomers(filters: CSCustomerFilters = {}, page = 0) {
  const { activeCompanies, activeCompany } = useCompany();
  const empresa = filters.empresa || null;

  return useQuery({
    queryKey: ['cs-customers', empresa || activeCompanies, filters, page],
    queryFn: async () => {
      // If we need contract-based filters, use RPC or post-filter via a separate query
      const needsContractFilter = !!(filters.ano_fiscal || filters.contrato_status);

      let contractCustomerIds: string[] | null = null;

      if (needsContractFilter) {
        let cq = supabase.from('cs_contracts').select('customer_id');
        if (filters.ano_fiscal) cq = cq.eq('ano_fiscal', filters.ano_fiscal);
        if (filters.contrato_status) cq = cq.eq('status', filters.contrato_status);
        const { data: cIds } = await cq;
        contractCustomerIds = [...new Set((cIds ?? []).map(r => (r as any).customer_id as string))];
        if (contractCustomerIds.length === 0) {
          return { data: [] as CSCustomer[], count: 0, pageSize: PAGE_SIZE };
        }
      }

      let query = supabase
        .from('cs_customers')
        .select(`
          *,
          contact:contacts!cs_customers_contact_id_fkey(id, nome, email, telefone, foto_url, organization_id),
          csm:profiles!cs_customers_csm_id_fkey(id, nome, avatar_url)
        `, { count: 'exact' })
        .order('updated_at', { ascending: false });

      if (empresa) {
        query = query.eq('empresa', empresa as 'BLUE' | 'TOKENIZA');
      } else {
        query = query.in('empresa', activeCompanies);
      }
      if (filters.health_status) query = query.eq('health_status', filters.health_status);
      if (filters.nps_categoria) query = query.eq('nps_categoria', filters.nps_categoria);
      if (filters.csm_id) query = query.eq('csm_id', filters.csm_id);
      if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
      if (filters.renovacao_de) query = query.gte('proxima_renovacao', filters.renovacao_de);
      if (filters.renovacao_ate) query = query.lte('proxima_renovacao', filters.renovacao_ate);
      if (contractCustomerIds) query = query.in('id', contractCustomerIds);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as CSCustomer[], count: count ?? 0, pageSize: PAGE_SIZE };
    },
  });
}

export function useCSCustomerById(id: string | undefined) {
  return useQuery({
    queryKey: ['cs-customer', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_customers')
        .select(`
          *,
          contact:contacts!cs_customers_contact_id_fkey(id, nome, email, telefone, foto_url, organization_id),
          csm:profiles!cs_customers_csm_id_fkey(id, nome, avatar_url)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as CSCustomer;
    },
  });
}

interface CreateCSCustomerData {
  contact_id: string;
  empresa: 'BLUE' | 'TOKENIZA';
  valor_mrr?: number;
  proxima_renovacao?: string | null;
  notas?: string | null;
  csm_id?: string | null;
}

export function useCreateCSCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCSCustomerData) => {
      const { data: row, error } = await supabase
        .from('cs_customers')
        .insert({
          contact_id: data.contact_id,
          empresa: data.empresa,
          valor_mrr: data.valor_mrr ?? 0,
          proxima_renovacao: data.proxima_renovacao ?? null,
          notas: data.notas ?? null,
          csm_id: data.csm_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-customers'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}

export function useUpdateCSCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CSCustomer> & { id: string }) => {
      const { data, error } = await supabase
        .from('cs_customers')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-customers'] });
      qc.invalidateQueries({ queryKey: ['cs-customer'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}
