import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealWithRelations, DealFormData, DealMoveData, KanbanColumn, PipelineStage } from '@/types/deal';

interface UseDealsOptions {
  pipelineId: string | null;
  ownerId?: string;
  temperatura?: string;
  tag?: string;
  page?: number;
}

export function useDeals({ pipelineId, ownerId, temperatura, tag, page = 0 }: UseDealsOptions) {
  const qc = useQueryClient();

  // Realtime subscription for Kanban live updates
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

  const PAGE_SIZE = 50;

  return useQuery({
    queryKey: ['deals', pipelineId, ownerId, temperatura, tag, page],
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
        .eq('pipeline_id', pipelineId!);

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (temperatura) query = query.eq('temperatura', temperatura as 'FRIO' | 'MORNO' | 'QUENTE');
      if (tag) query = query.contains('tags', [tag]);

      query = query.order('posicao_kanban', { ascending: true });

      // If page is provided (list view), paginate. If not (kanban), fetch up to 500 for safety.
      // But we defaulted page to 0 in props...
      // Let's rely on the caller. If they want all, they shouldn't pass page, but we defined it.
      // Actually, for Kanban we need all.
      // Let's modify:
      
      // If we are in Kanban mode (which we assume if page is 0 and we want everything, but Kanban usually needs all).
      // We will implement: fetch all (limit 500) if no page logic logic in component.
      // But we added page=0 default.
      
      // Let's stick to the plan:
      // "Modificar src/hooks/useDeals.ts ... Adicionar PAGE_SIZE = 50 ... limit(500) para Kanban"
      
      // We will check if the result is for Kanban (maybe via a prop? or just always page?)
      // KanbanBoard creates columns from ALL deals. Pagination breaks Kanban unless we implement column-based pagination which is complex.
      // So for Kanban we likely want to fetch MORE.
      
      // Let's assume: if page is passed explicitly, use it. If default 0 is used, we might still want all?
      // No, let's just paginate.
      
      // Wait, KanbanBoard takes `deals` and filters in memory. If we only fetch page 0 (50 deals), Kanban will be empty.
      // So we need a way to disable pagination for Kanban.
      
      // I'll assume that if `page` is -1, we fetch all (limit 500).
      
      if (page === -1) {
        query = query.limit(500);
      } else {
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { 
        data: (data ?? []) as unknown as DealWithRelations[], 
        count: count ?? 0 
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

// ─── Loss Categories CRUD (Admin) ───

export function useCreateLossCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { codigo: string; label: string; descricao?: string; posicao: number }) => {
      const { error } = await supabase.from('deal_loss_categories').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal_loss_categories'] }),
  });
}

export function useUpdateLossCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; codigo?: string; label?: string; descricao?: string | null }) => {
      const { error } = await supabase.from('deal_loss_categories').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal_loss_categories'] }),
  });
}

export function useDeleteLossCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deal_loss_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal_loss_categories'] }),
  });
}

export function useReorderLossCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; posicao: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from('deal_loss_categories').update({ posicao: item.posicao }).eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal_loss_categories'] }),
  });
}
