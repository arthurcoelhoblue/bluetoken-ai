import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PipelineFormData, StageFormData } from '@/types/customFields';

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PipelineFormData) => {
      const { data: result, error } = await supabase.from('pipelines').insert(data as never).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PipelineFormData> & { id: string }) => {
      const { error } = await supabase.from('pipelines').update(data as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete stages first, then pipeline
      await supabase.from('pipeline_stages').delete().eq('pipeline_id', id);
      const { error } = await supabase.from('pipelines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StageFormData) => {
      const { error } = await supabase.from('pipeline_stages').insert(data as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<StageFormData> & { id: string }) => {
      const { error } = await supabase.from('pipeline_stages').update(data as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useReorderStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: { id: string; posicao: number }[]) => {
      for (const s of stages) {
        const { error } = await supabase
          .from('pipeline_stages')
          .update({ posicao: s.posicao })
          .eq('id', s.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useDuplicatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceId, newName, newEmpresa }: { sourceId: string; newName: string; newEmpresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA' }) => {
      // Get source pipeline
      const { data: source, error: sourceErr } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', sourceId)
        .single();
      if (sourceErr || !source) throw sourceErr || new Error('Pipeline not found');

      // Create new pipeline
      type SourcePipeline = { id: string; descricao: string | null; tipo: string | null; pipeline_stages: Array<{ nome: string; posicao: number; cor: string; is_won: boolean; is_lost: boolean; sla_minutos: number | null }> };
      const src = source as unknown as SourcePipeline;

      const { data: newPipeline, error: newErr } = await supabase
        .from('pipelines')
        .insert({
          empresa: newEmpresa,
          nome: newName,
          descricao: src.descricao,
          tipo: src.tipo ?? 'COMERCIAL',
          is_default: false,
          ativo: true,
        } as never)
        .select()
        .single();
      if (newErr || !newPipeline) throw newErr || new Error('Failed to create');

      const newPipelineRow = newPipeline as unknown as { id: string };
      const stages = (src.pipeline_stages || [])
        .sort((a, b) => a.posicao - b.posicao)
        .map((s) => ({
          pipeline_id: newPipelineRow.id,
          nome: s.nome,
          posicao: s.posicao,
          cor: s.cor,
          is_won: s.is_won,
          is_lost: s.is_lost,
          sla_minutos: s.sla_minutos,
        }));

      if (stages.length > 0) {
        const { error: stagesErr } = await supabase.from('pipeline_stages').insert(stages as never);
        if (stagesErr) throw stagesErr;
      }

      return newPipeline;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}
