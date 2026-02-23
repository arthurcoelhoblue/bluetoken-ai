import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealWithRelations, DealMoveData, KanbanColumn, PipelineStage } from '@/types/deal';

interface UseDealsOptions {
  pipelineId: string | null;
  ownerId?: string;
  temperatura?: string;
  tag?: string;
  etiqueta?: string;
  page?: number;
}

const PAGE_SIZE = 50;

export function useDeals({ pipelineId, ownerId, temperatura, tag, etiqueta, page = 0 }: UseDealsOptions) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!pipelineId) return;

    const channel = supabase
      .channel(`deals-pipeline-${pipelineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['deals', pipelineId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pipelineId, qc]);

  return useQuery({
    queryKey: ['deals', pipelineId, ownerId, temperatura, tag, etiqueta, page],
    enabled: !!pipelineId,
    queryFn: async (): Promise<{ data: DealWithRelations[]; count: number }> => {
      let query = supabase
        .from('deals')
        .select(`
          *,
          contacts:contact_id(id, nome, email, telefone),
          pipeline_stages:stage_id(id, nome, cor, is_won, is_lost),
          owner:owner_id(id, nome, email, avatar_url)
        `, { count: 'exact' })
        .eq('pipeline_id', pipelineId!)
        .eq('status', 'ABERTO');

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (temperatura) query = query.eq('temperatura', temperatura as 'FRIO' | 'MORNO' | 'QUENTE');
      if (tag) query = query.contains('tags', [tag]);
      if (etiqueta) query = query.eq('etiqueta', etiqueta);

      query = query.order('posicao_kanban', { ascending: true });

      if (page === -1) {
        query = query.limit(500);
      } else {
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: (data ?? []) as unknown as DealWithRelations[],
        count: count ?? 0,
      };
    },
  });
}

export function useKanbanData(
  deals: DealWithRelations[] | undefined,
  stages: PipelineStage[] | undefined
): { columns: KanbanColumn[]; wonLost: KanbanColumn[] } {
  if (!stages || !deals) return { columns: [], wonLost: [] };

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
