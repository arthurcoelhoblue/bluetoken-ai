import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CadenciaCRM, DealCadenciaStatus, StartDealCadencePayload } from '@/types/cadence';

export function useCadenciasCRM() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['cadencias-crm', activeCompany],
    queryFn: async () => {
      let query = supabase.from('cadencias_crm').select('*');
      if (activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CadenciaCRM[];
    },
  });
}

export function useDealCadenciaStatus(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-cadencia-status', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_cadencia_status')
        .select('*')
        .eq('deal_id', dealId!);
      if (error) throw error;
      return (data ?? []) as unknown as DealCadenciaStatus[];
    },
  });
}

export function useStartDealCadence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, cadenceId, leadId, empresa }: StartDealCadencePayload) => {
      // 1. Create lead_cadence_run (PT status)
      const { data: run, error: runErr } = await supabase
        .from('lead_cadence_runs')
        .insert({
          cadence_id: cadenceId,
          lead_id: leadId,
          empresa: empresa,
          status: 'ATIVA',
          last_step_ordem: 0,
          next_step_ordem: 1,
          next_run_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();
      if (runErr) throw runErr;

      // 2. Create bridge (EN status)
      const { error: bridgeErr } = await supabase
        .from('deal_cadence_runs')
        .insert({
          deal_id: dealId,
          cadence_run_id: run.id,
          trigger_type: 'MANUAL',
          status: 'ACTIVE',
        });
      if (bridgeErr) throw bridgeErr;

      // 3. Log activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        tipo: 'CADENCIA',
        descricao: 'Cadência iniciada manualmente',
      });

      return run.id;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-cadencia-status', vars.dealId] });
      qc.invalidateQueries({ queryKey: ['deal-activities'] });
      qc.invalidateQueries({ queryKey: ['cadencias-crm'] });
    },
  });
}

export function usePauseDealCadence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealCadenceRunId, cadenceRunId, dealId }: { dealCadenceRunId: string; cadenceRunId: string; dealId: string }) => {
      await supabase.from('deal_cadence_runs').update({ status: 'PAUSED' }).eq('id', dealCadenceRunId);
      await supabase.from('lead_cadence_runs').update({ status: 'PAUSADA' }).eq('id', cadenceRunId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-cadencia-status', vars.dealId] });
    },
  });
}

export function useResumeDealCadence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealCadenceRunId, cadenceRunId, dealId }: { dealCadenceRunId: string; cadenceRunId: string; dealId: string }) => {
      await supabase.from('deal_cadence_runs').update({ status: 'ACTIVE' }).eq('id', dealCadenceRunId);
      await supabase.from('lead_cadence_runs').update({ status: 'ATIVA', next_run_at: new Date().toISOString() }).eq('id', cadenceRunId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-cadencia-status', vars.dealId] });
    },
  });
}

export function useCancelDealCadence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealCadenceRunId, cadenceRunId, dealId }: { dealCadenceRunId: string; cadenceRunId: string; dealId: string }) => {
      await supabase.from('deal_cadence_runs').update({ status: 'CANCELLED' }).eq('id', dealCadenceRunId);
      await supabase.from('lead_cadence_runs').update({ status: 'CANCELADA' }).eq('id', cadenceRunId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-cadencia-status', vars.dealId] });
      qc.invalidateQueries({ queryKey: ['cadencias-crm'] });
    },
  });
}
