// ========================================
// useCadences & useCadence hooks
// ========================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Cadence,
  CadenceWithStats,
  CadenceStepWithTemplate,
  CadencesFilters,
  EmpresaTipo,
  CanalTipo,
} from '@/types/cadence';

export function useCadences(filters?: CadencesFilters) {
  return useQuery({
    queryKey: ['cadences', filters],
    queryFn: async (): Promise<CadenceWithStats[]> => {
      let query = supabase.from('cadences').select('*');

      if (filters?.empresa) query = query.eq('empresa', filters.empresa);
      if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo);
      if (filters?.searchTerm) {
        query = query.or(`nome.ilike.%${filters.searchTerm}%,codigo.ilike.%${filters.searchTerm}%`);
      }

      query = query.order('empresa').order('nome');
      const { data: cadences, error } = await query;
      if (error) throw error;
      if (!cadences?.length) return [];

      const cadenceIds = cadences.map((c) => c.id);
      const { data: runs } = await supabase
        .from('lead_cadence_runs')
        .select('cadence_id, status')
        .in('cadence_id', cadenceIds);

      const statsMap: Record<string, { total: number; ativas: number; concluidas: number }> = {};
      runs?.forEach((run) => {
        if (!statsMap[run.cadence_id]) statsMap[run.cadence_id] = { total: 0, ativas: 0, concluidas: 0 };
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

export function useCadence(cadenceId?: string) {
  const cadenceQuery = useQuery({
    queryKey: ['cadence', cadenceId],
    queryFn: async (): Promise<Cadence | null> => {
      if (!cadenceId) return null;
      const { data, error } = await supabase.from('cadences').select('*').eq('id', cadenceId).single();
      if (error) throw error;
      return {
        id: data.id, empresa: data.empresa as EmpresaTipo, codigo: data.codigo,
        nome: data.nome, descricao: data.descricao, ativo: data.ativo,
        canal_principal: data.canal_principal as CanalTipo,
        created_at: data.created_at, updated_at: data.updated_at,
      };
    },
    enabled: !!cadenceId,
  });

  const stepsQuery = useQuery({
    queryKey: ['cadence-steps', cadenceId],
    queryFn: async (): Promise<CadenceStepWithTemplate[]> => {
      if (!cadenceId) return [];
      const { data: steps, error } = await supabase.from('cadence_steps').select('*').eq('cadence_id', cadenceId).order('ordem');
      if (error) throw error;
      if (!steps?.length) return [];

      const templateCodigos = [...new Set(steps.map((s) => s.template_codigo))];
      const { data: templates } = await supabase.from('message_templates').select('codigo, nome, conteudo').in('codigo', templateCodigos);
      const templateMap: Record<string, { nome: string; conteudo: string }> = {};
      templates?.forEach((t) => { templateMap[t.codigo] = { nome: t.nome, conteudo: t.conteudo }; });

      return steps.map((s) => ({
        id: s.id, cadence_id: s.cadence_id, ordem: s.ordem, offset_minutos: s.offset_minutos,
        canal: s.canal as CanalTipo, template_codigo: s.template_codigo,
        parar_se_responder: s.parar_se_responder, created_at: s.created_at, updated_at: s.updated_at,
        template_nome: templateMap[s.template_codigo]?.nome,
        template_conteudo: templateMap[s.template_codigo]?.conteudo,
      }));
    },
    enabled: !!cadenceId,
  });

  const metricsQuery = useQuery({
    queryKey: ['cadence-metrics', cadenceId],
    queryFn: async () => {
      if (!cadenceId) return null;
      const { data: runs } = await supabase.from('lead_cadence_runs').select('status, started_at').eq('cadence_id', cadenceId);
      if (!runs?.length) return { total: 0, ativas: 0, concluidas: 0, canceladas: 0, pausadas: 0, ultimaExecucao: null };
      const metrics = { total: runs.length, ativas: 0, concluidas: 0, canceladas: 0, pausadas: 0, ultimaExecucao: runs[0]?.started_at || null };
      runs.forEach((r) => {
        if (r.status === 'ATIVA') metrics.ativas++;
        if (r.status === 'CONCLUIDA') metrics.concluidas++;
        if (r.status === 'CANCELADA') metrics.canceladas++;
        if (r.status === 'PAUSADA') metrics.pausadas++;
        if (r.started_at > (metrics.ultimaExecucao || '')) metrics.ultimaExecucao = r.started_at;
      });
      return metrics;
    },
    enabled: !!cadenceId,
  });

  return {
    cadence: cadenceQuery.data, steps: stepsQuery.data || [], metrics: metricsQuery.data,
    isLoading: cadenceQuery.isLoading || stepsQuery.isLoading || metricsQuery.isLoading,
    error: cadenceQuery.error || stepsQuery.error,
  };
}
