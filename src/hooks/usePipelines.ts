import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { PipelineWithStages, PipelineStage } from '@/types/deal';

export function usePipelines() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['pipelines', activeCompany],
    queryFn: async (): Promise<PipelineWithStages[]> => {
      let query = supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany as 'BLUE' | 'TOKENIZA');
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((p) => ({
        ...p,
        pipeline_stages: ((p as PipelineWithStages).pipeline_stages ?? []).sort(
          (a: PipelineStage, b: PipelineStage) => a.posicao - b.posicao
        ),
      })) as PipelineWithStages[];
    },
  });
}

export function usePipelineStages(pipelineId: string | null) {
  return useQuery({
    queryKey: ['pipeline_stages', pipelineId],
    enabled: !!pipelineId,
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId!)
        .order('posicao', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
