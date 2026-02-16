import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface LossPendency {
  id: string;
  titulo: string;
  motivo_perda_closer: string | null;
  motivo_perda_ia: string | null;
  categoria_perda_closer: string | null;
  categoria_perda_ia: string | null;
  fechado_em: string | null;
  contacts: { id: string; nome: string } | null;
  pipeline_stages: { id: string; nome: string } | null;
}

export function useLossPendencies() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['loss-pendencies', activeCompany],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id, titulo, motivo_perda_closer, motivo_perda_ia,
          categoria_perda_closer, categoria_perda_ia, fechado_em,
          contacts:contact_id(id, nome),
          pipeline_stages:stage_fechamento_id(id, nome),
          pipelines:pipeline_id!inner(empresa)
        `)
        .eq('status', 'PERDIDO')
        .eq('perda_resolvida', false)
        .not('categoria_perda_ia', 'is', null)
        .eq('pipelines.empresa', activeCompany)
        .order('fechado_em', { ascending: false });

      if (error) throw error;

      // Filter where categories differ
      return ((data ?? []) as unknown as LossPendency[]).filter(
        d => d.categoria_perda_ia && d.categoria_perda_closer && d.categoria_perda_ia !== d.categoria_perda_closer
      );
    },
  });
}

export function useLossPendencyCount() {
  const { data } = useLossPendencies();
  return data?.length ?? 0;
}

interface ResolveLossData {
  dealId: string;
  motivo_perda_final: string;
  categoria_perda_final: string;
}

export function useResolveLoss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, motivo_perda_final, categoria_perda_final }: ResolveLossData) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('deals')
        .update({
          motivo_perda_final,
          categoria_perda_final,
          motivo_perda: motivo_perda_final,
          perda_resolvida: true,
          perda_resolvida_por: user?.id ?? null,
          perda_resolvida_em: new Date().toISOString(),
        })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loss-pendencies'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
