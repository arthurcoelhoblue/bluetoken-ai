import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealWithRelations, KanbanColumn, PipelineStage } from '@/types/deal';
import type { AdvancedFilterState } from '@/types/filterCondition';

interface UseDealsOptions {
  pipelineId: string | null;
  ownerId?: string;
  temperatura?: string;
  tag?: string;
  etiqueta?: string;
  page?: number;
  advancedFilters?: AdvancedFilterState | null;
}

const PAGE_SIZE = 50;

function buildFilterString(field: string, operator: string, value: string | number | string[]): string {
  const v = String(value);
  switch (operator) {
    case 'eq': return `${field}.eq.${v}`;
    case 'neq': return `${field}.neq.${v}`;
    case 'gt': return `${field}.gt.${v}`;
    case 'lt': return `${field}.lt.${v}`;
    case 'ilike': return `${field}.ilike.%${v}%`;
    default: return `${field}.eq.${v}`;
  }
}

export function useDeals({ pipelineId, ownerId, temperatura, tag, etiqueta, page = 0, advancedFilters }: UseDealsOptions) {
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
    queryKey: ['deals', pipelineId, ownerId, temperatura, tag, etiqueta, page, advancedFilters],
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

      // Simple filters (only if no advanced filters active)
      const hasAdvanced = advancedFilters && advancedFilters.conditions.length > 0;

      if (!hasAdvanced) {
        if (ownerId) query = query.eq('owner_id', ownerId);
        if (temperatura) query = query.eq('temperatura', temperatura as 'FRIO' | 'MORNO' | 'QUENTE');
        if (tag) query = query.contains('tags', [tag]);
        if (etiqueta) query = query.eq('etiqueta', etiqueta);
      }

      // Advanced filters
      if (hasAdvanced) {
        const conditions = advancedFilters!.conditions;

        if (advancedFilters!.matchMode === 'all') {
          // AND: chain each condition
          for (const c of conditions) {
            const { field, operator, value } = c;
            const v = String(value);

            // Handle joined fields differently
            if (field === 'contact_nome') {
              query = query.ilike('contacts.nome' as any, `%${v}%`);
              continue;
            }

            switch (operator) {
              case 'eq': query = query.eq(field as any, v); break;
              case 'neq': query = query.neq(field as any, v); break;
              case 'gt': query = query.gt(field as any, v); break;
              case 'lt': query = query.lt(field as any, v); break;
              case 'ilike': query = query.ilike(field as any, `%${v}%`); break;
            }
          }
        } else {
          // OR: build .or() string
          const parts = conditions
            .filter(c => c.field !== 'contact_nome') // can't OR on joined fields easily
            .map(c => buildFilterString(c.field, c.operator, c.value));

          if (parts.length > 0) {
            query = query.or(parts.join(','));
          }
        }
      }

      query = query.order('posicao_kanban', { ascending: true }).order('created_at', { ascending: false });

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
