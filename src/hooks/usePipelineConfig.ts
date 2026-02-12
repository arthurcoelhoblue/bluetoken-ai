import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PipelineFormData, StageFormData } from '@/types/customFields';

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PipelineFormData) => {
      const { data: result, error } = await supabase.from('pipelines').insert(data as any).select().single();
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
      const { error } = await supabase.from('pipelines').update(data as any).eq('id', id);
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
      const { error } = await supabase.from('pipeline_stages').insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<StageFormData> & { id: string }) => {
      const { error } = await supabase.from('pipeline_stages').update(data as any).eq('id', id);
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
          .update({ posicao: s.posicao } as any)
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
    mutationFn: async ({ sourceId, newName, newEmpresa }: { sourceId: string; newName: string; newEmpresa: 'BLUE' | 'TOKENIZA' }) => {
      // Get source pipeline
      const { data: source, error: sourceErr } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', sourceId)
        .single();
      if (sourceErr || !source) throw sourceErr || new Error('Pipeline not found');

      // Create new pipeline
      const { data: newPipeline, error: newErr } = await supabase
        .from('pipelines')
        .insert({
          empresa: newEmpresa,
          nome: newName,
          descricao: (source as any).descricao,
          is_default: false,
          ativo: true,
        } as any)
        .select()
        .single();
      if (newErr || !newPipeline) throw newErr || new Error('Failed to create');

      // Copy stages
      const stages = ((source as any).pipeline_stages || [])
        .sort((a: any, b: any) => a.posicao - b.posicao)
        .map((s: any) => ({
          pipeline_id: (newPipeline as any).id,
          nome: s.nome,
          posicao: s.posicao,
          cor: s.cor,
          is_won: s.is_won,
          is_lost: s.is_lost,
          sla_minutos: s.sla_minutos,
        }));

      if (stages.length > 0) {
        const { error: stagesErr } = await supabase.from('pipeline_stages').insert(stages as any);
        if (stagesErr) throw stagesErr;
      }

      return newPipeline;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipelines'] }),
  });
}
