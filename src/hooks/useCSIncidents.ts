import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CSIncident, CSIncidentTipo, CSGravidade, CSIncidentStatus } from '@/types/customerSuccess';

export function useCSIncidents(customerId?: string, statusFilter?: CSIncidentStatus) {
  const { activeCompanies } = useCompany();

  return useQuery({
    queryKey: ['cs-incidents', activeCompanies, customerId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('cs_incidents')
        .select(`
          *,
          responsavel:profiles!cs_incidents_responsavel_id_fkey(id, nome, avatar_url),
          customer:cs_customers!cs_incidents_customer_id_fkey(id, contact:contacts!cs_customers_contact_id_fkey(nome))
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      query = query.in('empresa', activeCompanies);
      if (customerId) query = query.eq('customer_id', customerId);
      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CSIncident[];
    },
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incident: {
      customer_id: string;
      empresa: string;
      tipo: CSIncidentTipo;
      gravidade: CSGravidade;
      titulo: string;
      descricao?: string;
      responsavel_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('cs_incidents')
        .insert(incident as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-incidents'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: CSIncidentStatus; resolucao?: string; resolved_at?: string }) => {
      const { data, error } = await supabase
        .from('cs_incidents')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-incidents'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}
