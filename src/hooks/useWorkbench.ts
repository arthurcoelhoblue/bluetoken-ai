import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkbenchTarefa, WorkbenchSLAAlert, WorkbenchPipelineSummary, RecentDeal } from '@/types/workbench';

type EmpresaEnum = 'BLUE' | 'TOKENIZA';

function empresaFilter(activeCompany: string): EmpresaEnum | null {
  if (activeCompany === 'ALL') return null;
  return activeCompany as EmpresaEnum;
}

export function useWorkbenchTarefas() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const empresa = empresaFilter(activeCompany);

  return useQuery({
    queryKey: ['workbench-tarefas', empresa, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<WorkbenchTarefa[]> => {
      let query = supabase
        .from('workbench_tarefas')
        .select('*')
        .eq('owner_id', user!.id)
        .order('tarefa_prazo', { ascending: true, nullsFirst: false });

      if (empresa) {
        query = query.eq('pipeline_empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchTarefa[];
    },
  });
}

export function useWorkbenchSLAAlerts() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const empresa = empresaFilter(activeCompany);

  return useQuery({
    queryKey: ['workbench-sla', empresa, user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async (): Promise<WorkbenchSLAAlert[]> => {
      let query = supabase
        .from('workbench_sla_alerts')
        .select('*')
        .eq('owner_id', user!.id)
        .order('sla_percentual', { ascending: false });

      if (empresa) {
        query = query.eq('pipeline_empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchSLAAlert[];
    },
  });
}

export function useWorkbenchPipelineSummary() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const empresa = empresaFilter(activeCompany);

  return useQuery({
    queryKey: ['workbench-pipeline-summary', empresa, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<WorkbenchPipelineSummary[]> => {
      let query = supabase
        .from('workbench_pipeline_summary')
        .select('*')
        .eq('owner_id', user!.id);

      if (empresa) {
        query = query.eq('pipeline_empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkbenchPipelineSummary[];
    },
  });
}

export function useWorkbenchRecentDeals() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const empresa = empresaFilter(activeCompany);

  return useQuery({
    queryKey: ['workbench-recent-deals', empresa, user?.id],
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

      if (empresa) {
        query = query.eq('pipelines.empresa', empresa);
      }

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
