// ========================================
// useCadenceEvents & useCadenceNextActions hooks
// ========================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  CadenceEventWithStep,
  CadenceNextAction,
  CadenceNextActionsFilters,
  CadenceRunStatus,
  EmpresaTipo,
  CanalTipo,
} from '@/types/cadence';

export function useCadenceEvents(runId?: string) {
  return useQuery({
    queryKey: ['cadence-events', runId],
    queryFn: async (): Promise<CadenceEventWithStep[]> => {
      if (!runId) return [];

      const { data: events, error } = await supabase
        .from('lead_cadence_events')
        .select('*')
        .eq('lead_cadence_run_id', runId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!events?.length) return [];

      const { data: run } = await supabase.from('lead_cadence_runs').select('cadence_id').eq('id', runId).single();
      if (!run) return [];

      const { data: steps } = await supabase.from('cadence_steps').select('ordem, canal, offset_minutos').eq('cadence_id', run.cadence_id);
      const stepsMap: Record<number, { canal: CanalTipo; offset: number }> = {};
      steps?.forEach((s) => { stepsMap[s.ordem] = { canal: s.canal as CanalTipo, offset: s.offset_minutos }; });

      return events.map((e) => ({
        id: e.id, lead_cadence_run_id: e.lead_cadence_run_id,
        step_ordem: e.step_ordem, template_codigo: e.template_codigo,
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

export function useCadenceNextActions(filters?: CadenceNextActionsFilters) {
  return useQuery({
    queryKey: ['cadence-next-actions', filters],
    queryFn: async (): Promise<CadenceNextAction[]> => {
      const now = new Date();
      let dateTo: Date;

      switch (filters?.periodo) {
        case 'hoje':
          dateTo = new Date(now); dateTo.setHours(23, 59, 59, 999); break;
        case '24h':
          dateTo = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
        case '3dias':
          dateTo = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); break;
        case 'semana': default:
          dateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
      }

      let query = supabase
        .from('lead_cadence_runs')
        .select('*')
        .eq('status', 'ATIVA')
        .not('next_run_at', 'is', null)
        .lte('next_run_at', dateTo.toISOString())
        .order('next_run_at', { ascending: true })
        .limit(100);

      if (filters?.empresa) query = query.eq('empresa', filters.empresa);
      if (filters?.cadence_id) query = query.eq('cadence_id', filters.cadence_id);

      const { data: runs, error } = await query;
      if (error) throw error;
      if (!runs?.length) return [];

      const leadIds = [...new Set(runs.map((r) => r.lead_id))];
      const cadenceIds = [...new Set(runs.map((r) => r.cadence_id))];

      const [leadsResult, cadencesResult, stepsResult] = await Promise.all([
        supabase.from('lead_contacts').select('lead_id, empresa, nome, primeiro_nome, email').in('lead_id', leadIds),
        supabase.from('cadences').select('id, nome, codigo').in('id', cadenceIds),
        supabase.from('cadence_steps').select('cadence_id, ordem, canal, template_codigo').in('cadence_id', cadenceIds),
      ]);

      const leadsMap: Record<string, { nome: string | null; email: string | null }> = {};
      leadsResult.data?.forEach((l) => { leadsMap[`${l.lead_id}-${l.empresa}`] = { nome: l.nome || l.primeiro_nome, email: l.email }; });

      const cadencesMap: Record<string, { nome: string; codigo: string }> = {};
      cadencesResult.data?.forEach((c) => { cadencesMap[c.id] = { nome: c.nome, codigo: c.codigo }; });

      const stepsMap: Record<string, { canal: CanalTipo; template_codigo: string }> = {};
      stepsResult.data?.forEach((s) => { stepsMap[`${s.cadence_id}-${s.ordem}`] = { canal: s.canal as CanalTipo, template_codigo: s.template_codigo }; });

      const actions: CadenceNextAction[] = [];
      for (const r of runs) {
        const leadKey = `${r.lead_id}-${r.empresa}`;
        const stepKey = `${r.cadence_id}-${r.next_step_ordem}`;
        const step = stepsMap[stepKey];
        if (filters?.canal && step?.canal !== filters.canal) continue;

        actions.push({
          run_id: r.id, lead_id: r.lead_id,
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
