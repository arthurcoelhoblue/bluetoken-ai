import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealWithRelations, DealFormData, DealMoveData, KanbanColumn, PipelineStage } from '@/types/deal';

interface UseDealsOptions {
  pipelineId: string | null;
  ownerId?: string;
  temperatura?: string;
}

export function useDeals({ pipelineId, ownerId, temperatura }: UseDealsOptions) {
  return useQuery({
    queryKey: ['deals', pipelineId, ownerId, temperatura],
    enabled: !!pipelineId,
    queryFn: async (): Promise<DealWithRelations[]> => {
      let query = supabase
        .from('deals')
        .select(`
          *,
          contacts:contact_id(id, nome, email, telefone),
          pipeline_stages:stage_id(id, nome, cor, is_won, is_lost),
          owner:owner_id(id, nome, email, avatar_url)
        `)
        .eq('pipeline_id', pipelineId!);

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (temperatura) query = query.eq('temperatura', temperatura as 'FRIO' | 'MORNO' | 'QUENTE');

      query = query.order('posicao_kanban', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DealWithRelations[];
    },
  });
}

export function useKanbanData(
  deals: DealWithRelations[] | undefined,
  stages: PipelineStage[] | undefined
): { columns: KanbanColumn[]; wonLost: KanbanColumn[] } {
  if (!stages || !deals) return { columns: [], wonLost: [] };

  // All stages are now active columns (no more is_won/is_lost separation)
  const buildColumns = (stageList: PipelineStage[]): KanbanColumn[] =>
    stageList.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      return {
        stage,
        deals: stageDeals,
        totalValor: stageDeals.reduce((sum, d) => sum + (d.valor ?? 0), 0),
      };
    });

  return {
    columns: buildColumns(stages),
    wonLost: [],
  };
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DealFormData) => {
      const { data: deal, error } = await supabase
        .from('deals')
        .insert({
          titulo: data.titulo,
          contact_id: data.contact_id,
          pipeline_id: data.pipeline_id,
          stage_id: data.stage_id,
          valor: data.valor ?? 0,
          owner_id: data.owner_id ?? null,
          temperatura: data.temperatura ?? 'FRIO',
          posicao_kanban: 0,
          stage_origem_id: data.stage_id,
          status: 'ABERTO',
        })
        .select()
        .single();
      if (error) throw error;

      // Insert initial history entry
      await supabase.from('deal_stage_history').insert({
        deal_id: deal.id,
        to_stage_id: data.stage_id,
      });

      return deal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DealFormData>) => {
      const { error } = await supabase.from('deals').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useMoveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, toStageId, posicao_kanban }: DealMoveData) => {
      const { error } = await supabase
        .from('deals')
        .update({ stage_id: toStageId, posicao_kanban })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export interface CloseDealData {
  dealId: string;
  status: 'GANHO' | 'PERDIDO';
  stageId: string;
  motivo_perda?: string;
  categoria_perda_closer?: string;
}

export function useCloseDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, status, stageId, motivo_perda, categoria_perda_closer }: CloseDealData) => {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status,
        stage_fechamento_id: stageId,
        fechado_em: now,
      };
      if (status === 'GANHO') {
        updates.data_ganho = now;
      } else {
        updates.data_perda = now;
        updates.motivo_perda_closer = motivo_perda ?? null;
        updates.categoria_perda_closer = categoria_perda_closer ?? null;
        updates.motivo_perda = motivo_perda ?? null;
      }
      const { error } = await supabase.from('deals').update(updates).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useLossCategories() {
  return useQuery({
    queryKey: ['deal_loss_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_loss_categories')
        .select('*')
        .order('posicao');
      if (error) throw error;
      return data as { id: string; codigo: string; label: string; descricao: string | null; posicao: number }[];
    },
  });
}
