import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkbenchTarefa, WorkbenchSLAAlert, WorkbenchPipelineSummary, RecentDeal } from '@/types/workbench';

export function useWorkbenchTarefas() {
  const { activeCompanies } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime for deal_activities (tasks)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`workbench-tasks-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deal_activities' },
        () => {
          qc.invalidateQueries({ queryKey: ['workbench-tarefas'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  return useQuery({
    queryKey: ['workbench-tarefas', activeCompanies, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<WorkbenchTarefa[]> => {
      let query = supabase
        .from('workbench_tarefas')
        .select('*')
        .eq('owner_id', user!.id)
        .order('tarefa_prazo', { ascending: true, nullsFirst: false });

      query = query.in('pipeline_empresa', activeCompanies);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchTarefa[];
    },
  });
}

export function useWorkbenchSLAAlerts() {
  const { activeCompanies } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime: invalidate SLA alerts when deals change
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`workbench-sla-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        () => {
          qc.invalidateQueries({ queryKey: ['workbench-sla'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  return useQuery({
    queryKey: ['workbench-sla', activeCompanies, user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000, // Reduced from 60s to 30s
    queryFn: async (): Promise<WorkbenchSLAAlert[]> => {
      let query = supabase
        .from('workbench_sla_alerts')
        .select('*')
        .eq('owner_id', user!.id)
        .order('sla_percentual', { ascending: false });

      query = query.in('pipeline_empresa', activeCompanies);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchSLAAlert[];
    },
  });
}

export function useWorkbenchPipelineSummary() {
  const { activeCompanies } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['workbench-pipeline-summary', activeCompanies, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<WorkbenchPipelineSummary[]> => {
      let query = supabase
        .from('workbench_pipeline_summary')
        .select('*')
        .eq('owner_id', user!.id);

      query = query.in('pipeline_empresa', activeCompanies);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchPipelineSummary[];
    },
  });
}

export function useWorkbenchRecentDeals() {
  const { activeCompanies } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['workbench-recent-deals', activeCompanies, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<RecentDeal[]> => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let query = supabase
        .from('deals')
        .select(`
          id, titulo, valor, status, created_at, updated_at, temperatura,
          contacts!inner(nome),
          pipeline_stages!inner(nome, cor),
          pipelines!inner(nome, empresa)
        `)
        .eq('owner_id', user!.id)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(20);

      query = query.in('pipelines.empresa', activeCompanies);

      const { data, error } = await query;
      if (error) throw error;

      type DealRow = typeof data[number];
      return (data ?? []).map((d: DealRow) => ({
        id: d.id,
        titulo: d.titulo,
        valor: d.valor,
        status: d.status,
        created_at: d.created_at,
        updated_at: d.updated_at,
        temperatura: d.temperatura,
        contact_nome: (d.contacts as unknown as { nome: string })?.nome ?? '',
        stage_nome: (d.pipeline_stages as unknown as { nome: string; cor: string })?.nome ?? '',
        stage_cor: (d.pipeline_stages as unknown as { nome: string; cor: string })?.cor ?? '#6366f1',
        pipeline_nome: (d.pipelines as unknown as { nome: string; empresa: string })?.nome ?? '',
      }));
    },
  });
}
