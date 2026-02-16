// ========================================
// useCadenceRuns & useCadenceRunDetail hooks
// ========================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  CadenceRunWithDetails,
  CadenceRunsFilters,
  CadenceRunStatus,
  EmpresaTipo,
  CanalTipo,
} from '@/types/cadence';

export function useCadenceRuns(
  filters?: CadenceRunsFilters,
  options?: { page?: number; pageSize?: number }
) {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;

  return useQuery({
    queryKey: ['cadence-runs', filters, page, pageSize],
    queryFn: async (): Promise<{
      data: CadenceRunWithDetails[];
      totalCount: number;
      page: number;
      totalPages: number;
    }> => {
      let query = supabase.from('lead_cadence_runs').select('*', { count: 'exact' });

      if (filters?.empresa) query = query.eq('empresa', filters.empresa);
      if (filters?.cadence_id) query = query.eq('cadence_id', filters.cadence_id);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.dateFrom) query = query.gte('started_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('started_at', filters.dateTo);

      query = query
        .order('next_run_at', { ascending: true, nullsFirst: false })
        .order('started_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data: runs, error, count } = await query;
      if (error) throw error;
      if (!runs?.length) return { data: [], totalCount: 0, page, totalPages: 0 };

      const leadIds = [...new Set(runs.map((r) => r.lead_id))];
      const cadenceIds = [...new Set(runs.map((r) => r.cadence_id))];

      const [leadsResult, cadencesResult, stepsResult] = await Promise.all([
        supabase.from('lead_contacts').select('lead_id, empresa, nome, primeiro_nome, email, telefone').in('lead_id', leadIds),
        supabase.from('cadences').select('id, nome, codigo, canal_principal').in('id', cadenceIds),
        supabase.from('cadence_steps').select('cadence_id, ordem').in('cadence_id', cadenceIds),
      ]);

      const leadsMap: Record<string, { nome: string | null; email: string | null; telefone: string | null }> = {};
      leadsResult.data?.forEach((l) => {
        const key = `${l.lead_id}-${l.empresa}`;
        leadsMap[key] = { nome: l.nome || l.primeiro_nome, email: l.email, telefone: l.telefone };
      });

      const cadencesMap: Record<string, { nome: string; codigo: string; canal: CanalTipo }> = {};
      cadencesResult.data?.forEach((c) => {
        cadencesMap[c.id] = { nome: c.nome, codigo: c.codigo, canal: c.canal_principal as CanalTipo };
      });

      const stepsCount: Record<string, number> = {};
      stepsResult.data?.forEach((s) => { stepsCount[s.cadence_id] = (stepsCount[s.cadence_id] || 0) + 1; });

      const enrichedRuns: CadenceRunWithDetails[] = runs.map((r) => {
        const leadKey = `${r.lead_id}-${r.empresa}`;
        return {
          id: r.id, lead_id: r.lead_id, empresa: r.empresa as EmpresaTipo,
          cadence_id: r.cadence_id, status: r.status as CadenceRunStatus,
          started_at: r.started_at, last_step_ordem: r.last_step_ordem,
          next_step_ordem: r.next_step_ordem, next_run_at: r.next_run_at,
          classification_snapshot: r.classification_snapshot as Record<string, unknown> | null,
          fonte_evento_id: r.fonte_evento_id, created_at: r.created_at, updated_at: r.updated_at,
          lead_nome: leadsMap[leadKey]?.nome || null,
          lead_email: leadsMap[leadKey]?.email || null,
          lead_telefone: leadsMap[leadKey]?.telefone || null,
          cadence_nome: cadencesMap[r.cadence_id]?.nome,
          cadence_codigo: cadencesMap[r.cadence_id]?.codigo,
          cadence_canal: cadencesMap[r.cadence_id]?.canal,
          total_steps: stepsCount[r.cadence_id] || 0,
        };
      });

      return { data: enrichedRuns, totalCount: count || 0, page, totalPages: Math.ceil((count || 0) / pageSize) };
    },
  });
}

export function useCadenceRunDetail(runId?: string) {
  return useQuery({
    queryKey: ['cadence-run', runId],
    queryFn: async (): Promise<CadenceRunWithDetails | null> => {
      if (!runId) return null;
      const { data: run, error } = await supabase.from('lead_cadence_runs').select('*').eq('id', runId).single();
      if (error) throw error;

      const [leadResult, cadenceResult, stepsResult] = await Promise.all([
        supabase.from('lead_contacts').select('nome, primeiro_nome, email, telefone').eq('lead_id', run.lead_id).eq('empresa', run.empresa).maybeSingle(),
        supabase.from('cadences').select('nome, codigo, canal_principal').eq('id', run.cadence_id).single(),
        supabase.from('cadence_steps').select('ordem').eq('cadence_id', run.cadence_id),
      ]);

      return {
        id: run.id, lead_id: run.lead_id, empresa: run.empresa as EmpresaTipo,
        cadence_id: run.cadence_id, status: run.status as CadenceRunStatus,
        started_at: run.started_at, last_step_ordem: run.last_step_ordem,
        next_step_ordem: run.next_step_ordem, next_run_at: run.next_run_at,
        classification_snapshot: run.classification_snapshot as Record<string, unknown> | null,
        fonte_evento_id: run.fonte_evento_id, created_at: run.created_at, updated_at: run.updated_at,
        lead_nome: leadResult.data?.nome || leadResult.data?.primeiro_nome || null,
        lead_email: leadResult.data?.email || null,
        lead_telefone: leadResult.data?.telefone || null,
        cadence_nome: cadenceResult.data?.nome,
        cadence_codigo: cadenceResult.data?.codigo,
        cadence_canal: cadenceResult.data?.canal_principal as CanalTipo,
        total_steps: stepsResult.data?.length || 0,
      };
    },
    enabled: !!runId,
  });
}
