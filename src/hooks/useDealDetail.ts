import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealFullDetail, DealActivity, DealActivityType } from '@/types/dealDetail';
import type { PipelineStage } from '@/types/deal';

export function useDealDetail(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-detail', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealFullDetail> => {
      const { data, error } = await supabase
        .from('deals_full_detail' as 'deals')
        .select('*')
        .eq('id', dealId!)
        .single();
      if (error) throw error;
      return data as unknown as DealFullDetail;
    },
  });
}

export function useDealActivities(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-activities', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealActivity[]> => {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*, profiles:user_id(nome, avatar_url)')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        user_nome: (a as Record<string, unknown>).profiles ? ((a as Record<string, unknown>).profiles as { nome?: string; avatar_url?: string })?.nome ?? null : null,
        user_avatar: (a as Record<string, unknown>).profiles ? ((a as Record<string, unknown>).profiles as { nome?: string; avatar_url?: string })?.avatar_url ?? null : null,
      })) as DealActivity[];
    },
  });
}

export function useAddDealActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      tipo: DealActivityType;
      descricao: string;
      tarefa_prazo?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('deal_activities').insert({
        deal_id: params.deal_id,
        tipo: params.tipo,
        descricao: params.descricao,
        tarefa_prazo: params.tarefa_prazo ?? null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-activities', vars.deal_id] });
    },
  });
}

export function useToggleTaskActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, concluida, dealId }: { id: string; concluida: boolean; dealId: string }) => {
      const { error } = await supabase
        .from('deal_activities')
        .update({ tarefa_concluida: concluida })
        .eq('id', id);
      if (error) throw error;
      return dealId;
    },
    onSuccess: (dealId) => {
      qc.invalidateQueries({ queryKey: ['deal-activities', dealId] });
    },
  });
}

export function useUpdateDealField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, field, value }: { dealId: string; field: string; value: unknown }) => {
      const { error } = await supabase
        .from('deals')
        .update({ [field]: value })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-detail'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useMoveDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, toStageId }: { dealId: string; toStageId: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: toStageId })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-detail'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal-activities'] });
    },
  });
}

export function useReopenDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, firstStageId }: { dealId: string; firstStageId: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({
          status: 'ABERTO',
          stage_id: firstStageId,
          fechado_em: null,
          data_ganho: null,
          data_perda: null,
          motivo_perda: null,
          motivo_perda_closer: null,
          categoria_perda_closer: null,
          stage_fechamento_id: null,
        })
        .eq('id', dealId);
      if (error) throw error;

      // Log reopen activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        tipo: 'REABERTO',
        descricao: 'Deal reaberto',
        user_id: user?.id ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-detail'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal-activities'] });
    },
  });
}

export function useDealPipelineStages(pipelineId: string | null) {
  return useQuery({
    queryKey: ['pipeline-stages', pipelineId],
    enabled: !!pipelineId,
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId!)
        .order('posicao');
      if (error) throw error;
      return data as PipelineStage[];
    },
  });
}
