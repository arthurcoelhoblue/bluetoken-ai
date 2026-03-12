import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SavedFilter, FilterCondition, MatchMode } from '@/types/filterCondition';
import { toast } from 'sonner';

export function useSavedFilters(pipelineId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved-filters', pipelineId],
    enabled: !!pipelineId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_saved_filters')
        .select('*')
        .eq('pipeline_id', pipelineId!)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedFilter[];
    },
  });
}

export function useSaveFilter() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      pipelineId: string;
      nome: string;
      matchMode: MatchMode;
      conditions: FilterCondition[];
    }) => {
      const { error } = await supabase.from('pipeline_saved_filters').insert({
        user_id: user!.id,
        pipeline_id: params.pipelineId,
        nome: params.nome,
        match_mode: params.matchMode,
        conditions: params.conditions as unknown as Record<string, unknown>[],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filtro salvo com sucesso');
    },
    onError: () => toast.error('Erro ao salvar filtro'),
  });
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_saved_filters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filtro excluído');
    },
    onError: () => toast.error('Erro ao excluir filtro'),
  });
}
