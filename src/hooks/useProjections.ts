import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StageConversionRate, StageProjection, MassActionJob, MassActionMessagePreview, MassActionJobType } from '@/types/projection';
import type { Database } from '@/integrations/supabase/types';

type EmpresaTipo = Database['public']['Enums']['empresa_tipo'];

// ── Projeção ──

export function useStageProjections(userId: string | undefined, empresa: string | undefined) {
  return useQuery({
    queryKey: ['stage-projections', userId, empresa],
    enabled: !!userId && !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stage_projection')
        .select('*')
        .eq('empresa', empresa! as EmpresaTipo)
        .eq('owner_id', userId!);
      if (error) throw error;
      return (data ?? []) as unknown as StageProjection[];
    },
  });
}

export function useAllStageProjections(empresa: string | undefined) {
  return useQuery({
    queryKey: ['stage-projections-all', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stage_projection')
        .select('*')
        .eq('empresa', empresa! as EmpresaTipo);
      if (error) throw error;
      return (data ?? []) as unknown as StageProjection[];
    },
  });
}

// ── Mass Action ──

export function useMassActionJobs(empresa: string | undefined) {
  return useQuery({
    queryKey: ['mass-action-jobs', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mass_action_jobs')
        .select('*')
        .eq('empresa', empresa! as EmpresaTipo)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as MassActionJob[];
    },
  });
}

export function useMassActionJob(jobId: string | null) {
  return useQuery({
    queryKey: ['mass-action-job', jobId],
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'GENERATING' || status === 'RUNNING') return 3000;
      return false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mass_action_jobs')
        .select('*')
        .eq('id', jobId!)
        .single();
      if (error) throw error;
      return data as unknown as MassActionJob;
    },
  });
}

export function useCreateMassAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      empresa: string;
      tipo: MassActionJobType;
      deal_ids: string[];
      cadence_id?: string;
      instrucao?: string;
      canal: string;
      started_by: string;
    }) => {
      const { data, error } = await supabase
        .from('mass_action_jobs')
        .insert({
          empresa: params.empresa as EmpresaTipo,
          tipo: params.tipo,
          deal_ids: params.deal_ids,
          cadence_id: params.cadence_id || null,
          instrucao: params.instrucao || null,
          canal: params.canal,
          total: params.deal_ids.length,
          started_by: params.started_by,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MassActionJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mass-action-jobs'] }),
  });
}

export function useGenerateMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('amelia-mass-action', {
        body: { jobId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, jobId) => {
      qc.invalidateQueries({ queryKey: ['mass-action-job', jobId] });
      qc.invalidateQueries({ queryKey: ['mass-action-jobs'] });
    },
  });
}

export function useUpdateMessageApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, dealId, approved }: { jobId: string; dealId: string; approved: boolean }) => {
      // Fetch current preview
      const { data: job, error: fetchErr } = await supabase
        .from('mass_action_jobs')
        .select('messages_preview')
        .eq('id', jobId)
        .single();
      if (fetchErr) throw fetchErr;

      const previews = (job.messages_preview as unknown as MassActionMessagePreview[]) || [];
      const updated = previews.map(m => m.deal_id === dealId ? { ...m, approved } : m);

      const { error } = await supabase
        .from('mass_action_jobs')
        .update({ messages_preview: updated as unknown as Database['public']['Tables']['mass_action_jobs']['Update']['messages_preview'] })
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: (_, { jobId }) => qc.invalidateQueries({ queryKey: ['mass-action-job', jobId] }),
  });
}

export function useExecuteMassAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error: updateError } = await supabase
        .from('mass_action_jobs')
        .update({ status: 'RUNNING', started_at: new Date().toISOString() })
        .eq('id', jobId);
      if (updateError) throw updateError;

      const { error: fnError } = await supabase.functions.invoke('amelia-mass-action', {
        body: { jobId, action: 'execute' },
      });
      if (fnError) throw fnError;
    },
    onSuccess: (_, jobId) => {
      qc.invalidateQueries({ queryKey: ['mass-action-job', jobId] });
      qc.invalidateQueries({ queryKey: ['mass-action-jobs'] });
    },
  });
}
