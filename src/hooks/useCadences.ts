// ========================================
// PATCH 4.0 - Hooks de Cadências
// ========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Cadence,
  CadenceWithStats,
  CadenceStep,
  CadenceStepWithTemplate,
  LeadCadenceRun,
  CadenceRunWithDetails,
  LeadCadenceEvent,
  CadenceEventWithStep,
  CadenceNextAction,
  CadencesFilters,
  CadenceRunsFilters,
  CadenceNextActionsFilters,
  CadenceRunStatus,
  EmpresaTipo,
  CanalTipo,
} from '@/types/cadence';

// ========================================
// useCadences - Lista todas as cadências
// ========================================

export function useCadences(filters?: CadencesFilters) {
  return useQuery({
    queryKey: ['cadences', filters],
    queryFn: async (): Promise<CadenceWithStats[]> => {
      // Buscar cadências
      let query = supabase.from('cadences').select('*');

      if (filters?.empresa) {
        query = query.eq('empresa', filters.empresa);
      }
      if (filters?.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo);
      }
      if (filters?.searchTerm) {
        query = query.or(
          `nome.ilike.%${filters.searchTerm}%,codigo.ilike.%${filters.searchTerm}%`
        );
      }

      query = query.order('empresa').order('nome');

      const { data: cadences, error } = await query;

      if (error) {
        throw error;
      }

      if (!cadences?.length) return [];

      // Buscar contagem de runs por cadência
      const cadenceIds = cadences.map((c) => c.id);
      const { data: runs } = await supabase
        .from('lead_cadence_runs')
        .select('cadence_id, status')
        .in('cadence_id', cadenceIds);

      // Mapear estatísticas
      const statsMap: Record<
        string,
        { total: number; ativas: number; concluidas: number }
      > = {};

      runs?.forEach((run) => {
        if (!statsMap[run.cadence_id]) {
          statsMap[run.cadence_id] = { total: 0, ativas: 0, concluidas: 0 };
        }
        statsMap[run.cadence_id].total++;
        if (run.status === 'ATIVA') statsMap[run.cadence_id].ativas++;
        if (run.status === 'CONCLUIDA') statsMap[run.cadence_id].concluidas++;
      });

      return cadences.map((c) => ({
        id: c.id,
        empresa: c.empresa as EmpresaTipo,
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        ativo: c.ativo,
        canal_principal: c.canal_principal as CanalTipo,
        created_at: c.created_at,
        updated_at: c.updated_at,
        total_runs: statsMap[c.id]?.total || 0,
        runs_ativas: statsMap[c.id]?.ativas || 0,
        runs_concluidas: statsMap[c.id]?.concluidas || 0,
      }));
    },
  });
}

// ========================================
// useCadence - Detalhes de uma cadência
// ========================================

export function useCadence(cadenceId?: string) {
  const cadenceQuery = useQuery({
    queryKey: ['cadence', cadenceId],
    queryFn: async (): Promise<Cadence | null> => {
      if (!cadenceId) return null;

      const { data, error } = await supabase
        .from('cadences')
        .select('*')
        .eq('id', cadenceId)
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        empresa: data.empresa as EmpresaTipo,
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao,
        ativo: data.ativo,
        canal_principal: data.canal_principal as CanalTipo,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    },
    enabled: !!cadenceId,
  });

  const stepsQuery = useQuery({
    queryKey: ['cadence-steps', cadenceId],
    queryFn: async (): Promise<CadenceStepWithTemplate[]> => {
      if (!cadenceId) return [];

      // Buscar steps
      const { data: steps, error } = await supabase
        .from('cadence_steps')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('ordem');

      if (error) {
        throw error;
      }

      if (!steps?.length) return [];

      // Buscar templates para enriquecer
      const templateCodigos = [...new Set(steps.map((s) => s.template_codigo))];
      const { data: templates } = await supabase
        .from('message_templates')
        .select('codigo, nome, conteudo')
        .in('codigo', templateCodigos);

      const templateMap: Record<string, { nome: string; conteudo: string }> =
        {};
      templates?.forEach((t) => {
        templateMap[t.codigo] = { nome: t.nome, conteudo: t.conteudo };
      });

      return steps.map((s) => ({
        id: s.id,
        cadence_id: s.cadence_id,
        ordem: s.ordem,
        offset_minutos: s.offset_minutos,
        canal: s.canal as CanalTipo,
        template_codigo: s.template_codigo,
        parar_se_responder: s.parar_se_responder,
        created_at: s.created_at,
        updated_at: s.updated_at,
        template_nome: templateMap[s.template_codigo]?.nome,
        template_conteudo: templateMap[s.template_codigo]?.conteudo,
      }));
    },
    enabled: !!cadenceId,
  });

  // Buscar métricas
  const metricsQuery = useQuery({
    queryKey: ['cadence-metrics', cadenceId],
    queryFn: async () => {
      if (!cadenceId) return null;

      const { data: runs } = await supabase
        .from('lead_cadence_runs')
        .select('status, started_at')
        .eq('cadence_id', cadenceId);

      if (!runs?.length) {
        return {
          total: 0,
          ativas: 0,
          concluidas: 0,
          canceladas: 0,
          pausadas: 0,
          ultimaExecucao: null,
        };
      }

      const metrics = {
        total: runs.length,
        ativas: 0,
        concluidas: 0,
        canceladas: 0,
        pausadas: 0,
        ultimaExecucao: runs[0]?.started_at || null,
      };

      runs.forEach((r) => {
        if (r.status === 'ATIVA') metrics.ativas++;
        if (r.status === 'CONCLUIDA') metrics.concluidas++;
        if (r.status === 'CANCELADA') metrics.canceladas++;
        if (r.status === 'PAUSADA') metrics.pausadas++;
        if (r.started_at > (metrics.ultimaExecucao || '')) {
          metrics.ultimaExecucao = r.started_at;
        }
      });

      return metrics;
    },
    enabled: !!cadenceId,
  });

  return {
    cadence: cadenceQuery.data,
    steps: stepsQuery.data || [],
    metrics: metricsQuery.data,
    isLoading:
      cadenceQuery.isLoading || stepsQuery.isLoading || metricsQuery.isLoading,
    error: cadenceQuery.error || stepsQuery.error,
  };
}

// ========================================
// useCadenceRuns - Lista execuções
// ========================================

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
      // Query base
      let query = supabase.from('lead_cadence_runs').select('*', { count: 'exact' });

      // Aplicar filtros
      if (filters?.empresa) {
        query = query.eq('empresa', filters.empresa);
      }
      if (filters?.cadence_id) {
        query = query.eq('cadence_id', filters.cadence_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('started_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('started_at', filters.dateTo);
      }

      // Ordenar e paginar
      query = query
        .order('next_run_at', { ascending: true, nullsFirst: false })
        .order('started_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data: runs, error, count } = await query;

      if (error) {
        throw error;
      }

      if (!runs?.length) {
        return { data: [], totalCount: 0, page, totalPages: 0 };
      }

      // Enriquecer com dados de lead e cadência
      const leadIds = [...new Set(runs.map((r) => r.lead_id))];
      const cadenceIds = [...new Set(runs.map((r) => r.cadence_id))];

      const [leadsResult, cadencesResult, stepsResult] = await Promise.all([
        supabase
          .from('lead_contacts')
          .select('lead_id, empresa, nome, primeiro_nome, email, telefone')
          .in('lead_id', leadIds),
        supabase
          .from('cadences')
          .select('id, nome, codigo, canal_principal')
          .in('id', cadenceIds),
        supabase
          .from('cadence_steps')
          .select('cadence_id, ordem')
          .in('cadence_id', cadenceIds),
      ]);

      // Mapear leads por lead_id+empresa
      const leadsMap: Record<
        string,
        { nome: string | null; email: string | null; telefone: string | null }
      > = {};
      leadsResult.data?.forEach((l) => {
        const key = `${l.lead_id}-${l.empresa}`;
        leadsMap[key] = {
          nome: l.nome || l.primeiro_nome,
          email: l.email,
          telefone: l.telefone,
        };
      });

      // Mapear cadências
      const cadencesMap: Record<
        string,
        { nome: string; codigo: string; canal: CanalTipo }
      > = {};
      cadencesResult.data?.forEach((c) => {
        cadencesMap[c.id] = {
          nome: c.nome,
          codigo: c.codigo,
          canal: c.canal_principal as CanalTipo,
        };
      });

      // Contar steps por cadência
      const stepsCount: Record<string, number> = {};
      stepsResult.data?.forEach((s) => {
        stepsCount[s.cadence_id] = (stepsCount[s.cadence_id] || 0) + 1;
      });

      const enrichedRuns: CadenceRunWithDetails[] = runs.map((r) => {
        const leadKey = `${r.lead_id}-${r.empresa}`;
        return {
          id: r.id,
          lead_id: r.lead_id,
          empresa: r.empresa as EmpresaTipo,
          cadence_id: r.cadence_id,
          status: r.status as CadenceRunStatus,
          started_at: r.started_at,
          last_step_ordem: r.last_step_ordem,
          next_step_ordem: r.next_step_ordem,
          next_run_at: r.next_run_at,
          classification_snapshot: r.classification_snapshot as Record<
            string,
            unknown
          > | null,
          fonte_evento_id: r.fonte_evento_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          lead_nome: leadsMap[leadKey]?.nome || null,
          lead_email: leadsMap[leadKey]?.email || null,
          lead_telefone: leadsMap[leadKey]?.telefone || null,
          cadence_nome: cadencesMap[r.cadence_id]?.nome,
          cadence_codigo: cadencesMap[r.cadence_id]?.codigo,
          cadence_canal: cadencesMap[r.cadence_id]?.canal,
          total_steps: stepsCount[r.cadence_id] || 0,
        };
      });

      return {
        data: enrichedRuns,
        totalCount: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// ========================================
// useCadenceEvents - Eventos de uma run
// ========================================

export function useCadenceEvents(runId?: string) {
  return useQuery({
    queryKey: ['cadence-events', runId],
    queryFn: async (): Promise<CadenceEventWithStep[]> => {
      if (!runId) return [];

      // Buscar eventos
      const { data: events, error } = await supabase
        .from('lead_cadence_events')
        .select('*')
        .eq('lead_cadence_run_id', runId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!events?.length) return [];

      // Buscar run para pegar cadence_id
      const { data: run } = await supabase
        .from('lead_cadence_runs')
        .select('cadence_id')
        .eq('id', runId)
        .single();

      if (!run) return [];

      // Buscar steps da cadência
      const { data: steps } = await supabase
        .from('cadence_steps')
        .select('ordem, canal, offset_minutos')
        .eq('cadence_id', run.cadence_id);

      const stepsMap: Record<
        number,
        { canal: CanalTipo; offset: number }
      > = {};
      steps?.forEach((s) => {
        stepsMap[s.ordem] = {
          canal: s.canal as CanalTipo,
          offset: s.offset_minutos,
        };
      });

      return events.map((e) => ({
        id: e.id,
        lead_cadence_run_id: e.lead_cadence_run_id,
        step_ordem: e.step_ordem,
        template_codigo: e.template_codigo,
        tipo_evento: e.tipo_evento as import('@/types/cadence').CadenceEventTipo,
        detalhes: e.detalhes as Record<string, unknown> | null,
        created_at: e.created_at,
        step_canal: stepsMap[e.step_ordem]?.canal,
        step_offset_minutos: stepsMap[e.step_ordem]?.offset,
      }));
    },
    enabled: !!runId,
  });
}

// ========================================
// useCadenceNextActions - Próximas ações
// ========================================

export function useCadenceNextActions(filters?: CadenceNextActionsFilters) {
  return useQuery({
    queryKey: ['cadence-next-actions', filters],
    queryFn: async (): Promise<CadenceNextAction[]> => {
      const now = new Date();
      let dateTo: Date;

      // Calcular período
      switch (filters?.periodo) {
        case 'hoje':
          dateTo = new Date(now);
          dateTo.setHours(23, 59, 59, 999);
          break;
        case '24h':
          dateTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '3dias':
          dateTo = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          break;
        case 'semana':
        default:
          dateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
      }

      // Buscar runs ativas com next_run_at
      let query = supabase
        .from('lead_cadence_runs')
        .select('*')
        .eq('status', 'ATIVA')
        .not('next_run_at', 'is', null)
        .lte('next_run_at', dateTo.toISOString())
        .order('next_run_at', { ascending: true })
        .limit(100);

      if (filters?.empresa) {
        query = query.eq('empresa', filters.empresa);
      }
      if (filters?.cadence_id) {
        query = query.eq('cadence_id', filters.cadence_id);
      }

      const { data: runs, error } = await query;

      if (error) {
        throw error;
      }

      if (!runs?.length) return [];

      // Enriquecer dados
      const leadIds = [...new Set(runs.map((r) => r.lead_id))];
      const cadenceIds = [...new Set(runs.map((r) => r.cadence_id))];

      const [leadsResult, cadencesResult, stepsResult] = await Promise.all([
        supabase
          .from('lead_contacts')
          .select('lead_id, empresa, nome, primeiro_nome, email')
          .in('lead_id', leadIds),
        supabase
          .from('cadences')
          .select('id, nome, codigo')
          .in('id', cadenceIds),
        supabase
          .from('cadence_steps')
          .select('cadence_id, ordem, canal, template_codigo')
          .in('cadence_id', cadenceIds),
      ]);

      // Mapear leads
      const leadsMap: Record<
        string,
        { nome: string | null; email: string | null }
      > = {};
      leadsResult.data?.forEach((l) => {
        const key = `${l.lead_id}-${l.empresa}`;
        leadsMap[key] = { nome: l.nome || l.primeiro_nome, email: l.email };
      });

      // Mapear cadências
      const cadencesMap: Record<string, { nome: string; codigo: string }> = {};
      cadencesResult.data?.forEach((c) => {
        cadencesMap[c.id] = { nome: c.nome, codigo: c.codigo };
      });

      // Mapear steps por cadence_id+ordem
      const stepsMap: Record<
        string,
        { canal: CanalTipo; template_codigo: string }
      > = {};
      stepsResult.data?.forEach((s) => {
        const key = `${s.cadence_id}-${s.ordem}`;
        stepsMap[key] = {
          canal: s.canal as CanalTipo,
          template_codigo: s.template_codigo,
        };
      });

      // Filtrar por canal se especificado
      const actions: CadenceNextAction[] = [];
      
      for (const r of runs) {
        const leadKey = `${r.lead_id}-${r.empresa}`;
        const stepKey = `${r.cadence_id}-${r.next_step_ordem}`;
        const step = stepsMap[stepKey];

        // Filtrar por canal
        if (filters?.canal && step?.canal !== filters.canal) continue;

        actions.push({
          run_id: r.id,
          lead_id: r.lead_id,
          lead_nome: leadsMap[leadKey]?.nome || null,
          lead_email: leadsMap[leadKey]?.email || null,
          empresa: r.empresa as EmpresaTipo,
          cadence_id: r.cadence_id,
          cadence_nome: cadencesMap[r.cadence_id]?.nome || '',
          cadence_codigo: cadencesMap[r.cadence_id]?.codigo || '',
          next_step_ordem: r.next_step_ordem!,
          next_run_at: r.next_run_at!,
          canal: step?.canal || 'WHATSAPP',
          template_codigo: step?.template_codigo || '',
          status: r.status as CadenceRunStatus,
        });
      }

      return actions;
    },
  });
}

// ========================================
// useUpdateCadenceRunStatus - Alterar status
// ========================================

export function useUpdateCadenceRunStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      runId,
      status,
    }: {
      runId: string;
      status: CadenceRunStatus;
    }) => {
      const updateData: Record<string, unknown> = { status };

      // Se pausar ou cancelar, limpar next_run_at
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

// ========================================
// useCadenceRunDetail - Detalhes de uma run
// ========================================

export function useCadenceRunDetail(runId?: string) {
  return useQuery({
    queryKey: ['cadence-run', runId],
    queryFn: async (): Promise<CadenceRunWithDetails | null> => {
      if (!runId) return null;

      const { data: run, error } = await supabase
        .from('lead_cadence_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (error) {
        throw error;
      }

      // Buscar lead e cadência
      const [leadResult, cadenceResult, stepsResult] = await Promise.all([
        supabase
          .from('lead_contacts')
          .select('nome, primeiro_nome, email, telefone')
          .eq('lead_id', run.lead_id)
          .eq('empresa', run.empresa)
          .maybeSingle(),
        supabase
          .from('cadences')
          .select('nome, codigo, canal_principal')
          .eq('id', run.cadence_id)
          .single(),
        supabase
          .from('cadence_steps')
          .select('ordem')
          .eq('cadence_id', run.cadence_id),
      ]);

      return {
        id: run.id,
        lead_id: run.lead_id,
        empresa: run.empresa as EmpresaTipo,
        cadence_id: run.cadence_id,
        status: run.status as CadenceRunStatus,
        started_at: run.started_at,
        last_step_ordem: run.last_step_ordem,
        next_step_ordem: run.next_step_ordem,
        next_run_at: run.next_run_at,
        classification_snapshot: run.classification_snapshot as Record<
          string,
          unknown
        > | null,
        fonte_evento_id: run.fonte_evento_id,
        created_at: run.created_at,
        updated_at: run.updated_at,
        lead_nome:
          leadResult.data?.nome || leadResult.data?.primeiro_nome || null,
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

// ========================================
// Stage Trigger Hooks (CRM)
// ========================================

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

// ========================================
// useCadenceDealStats - CRM deal stats for cadences
// ========================================

export function useCadenciasCRMView() {
  return useQuery({
    queryKey: ['cadencias-crm-view'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cadencias_crm').select('*');
      if (error) throw error;
      return (data ?? []) as unknown as import('@/types/cadence').CadenciaCRM[];
    },
  });
}