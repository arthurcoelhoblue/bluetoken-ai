import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface AutoRule {
  id: string;
  pipeline_id: string;
  empresa: string;
  from_stage_id: string;
  to_stage_id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  from_stage_nome?: string;
  to_stage_nome?: string;
  pipeline_nome?: string;
}

export function useAutoRules() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['auto-rules', activeCompany],
    queryFn: async (): Promise<AutoRule[]> => {
      const { data, error } = await supabase
        .from('pipeline_auto_rules' as any)
        .select('*, from_stage:from_stage_id(nome), to_stage:to_stage_id(nome), pipeline:pipeline_id(nome)')
        .eq('empresa', activeCompany)
        .order('created_at', { ascending: false });
      if (error) throw error;
      type AutoRuleRow = AutoRule & { from_stage?: { nome: string } | null; to_stage?: { nome: string } | null; pipeline?: { nome: string } | null };
      return ((data ?? []) as unknown as AutoRuleRow[]).map((r) => ({
        ...r,
        from_stage_nome: r.from_stage?.nome ?? null,
        to_stage_nome: r.to_stage?.nome ?? null,
        pipeline_nome: r.pipeline?.nome ?? null,
      }));
    },
  });
}

export function useCreateAutoRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      pipeline_id: string;
      empresa: string;
      from_stage_id: string;
      to_stage_id: string;
      trigger_type: string;
      trigger_config?: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from('pipeline_auto_rules' as any)
        .insert(params);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-rules'] }),
  });
}

export function useUpdateAutoRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from('pipeline_auto_rules' as any)
        .update(fields)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-rules'] }),
  });
}

export function useDeleteAutoRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pipeline_auto_rules' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-rules'] }),
  });
}
