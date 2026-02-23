// ========================================
// Cadence mutations & CRM hooks
// ========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CadenceRunStatus } from '@/types/cadence';

export function useUpdateCadenceRunStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, status }: { runId: string; status: CadenceRunStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'PAUSADA' || status === 'CANCELADA') {
        updateData.next_run_at = null;
      }
      const { data, error } = await supabase
        .from('lead_cadence_runs')
        .update(updateData)
        .eq('id', runId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cadence-runs'] });
      queryClient.invalidateQueries({ queryKey: ['cadence-next-actions'] });
      queryClient.invalidateQueries({ queryKey: ['cadence-run'] });
    },
  });
}

export function useCadenceStageTriggers(pipelineId: string | null) {
  return useQuery({
    queryKey: ['cadence-stage-triggers', pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cadence_stage_triggers')
        .select('*')
        .eq('pipeline_id', pipelineId!);
      if (error) throw error;
      return (data ?? []) as unknown as import('@/types/cadence').CadenceStageTrigger[];
    },
  });
}

export function useCreateStageTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { pipeline_id: string; stage_id: string; cadence_id: string; trigger_type: string }) => {
      const { error } = await supabase.from('cadence_stage_triggers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cadence-stage-triggers'] });
      qc.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
}

export function useDeleteStageTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cadence_stage_triggers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cadence-stage-triggers'] });
      qc.invalidateQueries({ queryKey: ['cadences'] });
    },
  });
}

export function useToggleCadenceAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('cadences')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cadences'] });
      qc.invalidateQueries({ queryKey: ['cadencias-crm-view'] });
    },
  });
}

export function useDeactivateCadence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pausarRuns }: { id: string; pausarRuns: boolean }) => {
      const { error: cadErr } = await supabase
        .from('cadences')
        .update({ ativo: false })
        .eq('id', id);
      if (cadErr) throw cadErr;

      if (pausarRuns) {
        const { error: runErr } = await supabase
          .from('lead_cadence_runs')
          .update({ status: 'PAUSADA' as CadenceRunStatus, next_run_at: null })
          .eq('cadence_id', id)
          .eq('status', 'ATIVA');
        if (runErr) throw runErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cadences'] });
      qc.invalidateQueries({ queryKey: ['cadencias-crm-view'] });
      qc.invalidateQueries({ queryKey: ['cadence-runs'] });
      qc.invalidateQueries({ queryKey: ['cadence-next-actions'] });
    },
  });
}

export function useCadenciasCRMView() {
  const { activeCompanies } = useCompany();
  return useQuery({
    queryKey: ['cadencias-crm-view', activeCompanies],
    queryFn: async () => {
      const { data, error } = await supabase.from('cadencias_crm').select('*').in('empresa', activeCompanies);
      if (error) throw error;
      return (data ?? []) as unknown as import('@/types/cadence').CadenciaCRM[];
    },
  });
}
