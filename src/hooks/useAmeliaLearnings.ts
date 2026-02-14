import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { AmeliaLearning, AmeliaLearningStatus } from '@/types/learning';

export function useAmeliaLearnings(statusFilter?: AmeliaLearningStatus) {
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['amelia-learnings', activeCompany, statusFilter],
    enabled: !!user?.id,
    queryFn: async (): Promise<AmeliaLearning[]> => {
      let query = supabase
        .from('amelia_learnings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AmeliaLearning[];
    },
  });
}

export function useAmeliaSequenceAlerts() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['amelia-sequence-alerts', activeCompany],
    enabled: !!user?.id,
    queryFn: async (): Promise<AmeliaLearning[]> => {
      let query = supabase
        .from('amelia_learnings')
        .select('*')
        .in('tipo', ['SEQUENCIA_PERDA', 'SEQUENCIA_CHURN', 'SEQUENCIA_SUCESSO'])
        .eq('status', 'VALIDADO')
        .not('sequencia_eventos', 'is', null)
        .order('confianca', { ascending: false })
        .limit(20);

      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AmeliaLearning[];
    },
  });
}

export function useValidateLearning() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'VALIDADO' | 'REJEITADO' }) => {
      const { error } = await supabase
        .from('amelia_learnings')
        .update({
          status,
          validado_por: user?.id,
          validado_em: new Date().toISOString(),
          aplicado: status === 'VALIDADO',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amelia-learnings'] });
      qc.invalidateQueries({ queryKey: ['amelia-sequence-alerts'] });
    },
  });
}

export function useRecentAlerts() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['amelia-recent-alerts', activeCompany],
    enabled: !!user?.id,
    queryFn: async (): Promise<AmeliaLearning[]> => {
      let query = supabase
        .from('amelia_learnings')
        .select('*')
        .eq('tipo', 'ALERTA_CRITICO')
        .order('created_at', { ascending: false })
        .limit(5);

      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AmeliaLearning[];
    },
  });
}
