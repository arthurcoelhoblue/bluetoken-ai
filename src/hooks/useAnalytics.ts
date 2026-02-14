import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type {
  AnalyticsFunnel,
  AnalyticsConversion,
  AnalyticsVendedor,
  AnalyticsPeriodo,
  AnalyticsMotivosPerda,
  AnalyticsCanalOrigem,
  AnalyticsFunilVisual,
  AnalyticsEvolucaoMensal,
  AnalyticsLTVCohort,
  AnalyticsEsforcoVendedor,
  AnalyticsCanalEsforco,
} from '@/types/analytics';

function empresaFilter(activeCompany: string) {
  if (activeCompany === 'all') return null;
  return activeCompany.toUpperCase() as 'BLUE' | 'TOKENIZA';
}

export function useAnalyticsFunnel(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_funnel', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_funnel' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('posicao', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsFunnel[];
    },
  });
}

export function useAnalyticsConversion(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_conversion', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_conversion' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsConversion[];
    },
  });
}

export function useAnalyticsVendedor() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_vendedor', activeCompany],
    queryFn: async () => {
      let q = supabase.from('analytics_vendedor' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      q = q.order('valor_ganho', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsVendedor[];
    },
  });
}

export function useAnalyticsPeriodo(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_periodo', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_deals_periodo' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('mes', { ascending: false }).limit(12);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsPeriodo[];
    },
  });
}

export function useAnalyticsMotivosPerda(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_motivos_perda', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_motivos_perda' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('quantidade', { ascending: false }).limit(20);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsMotivosPerda[];
    },
  });
}

export function useAnalyticsCanalOrigem(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_canal_origem', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_canal_origem' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('total_deals', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsCanalOrigem[];
    },
  });
}

export function useAnalyticsFunilVisual(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_funil_visual', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_funil_visual' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('posicao', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsFunilVisual[];
    },
  });
}

export function useAnalyticsEvolucao(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_evolucao_mensal', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_evolucao_mensal' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('mes', { ascending: false }).limit(12);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsEvolucaoMensal[];
    },
  });
}

export function useAnalyticsLTV() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_ltv_cohort', activeCompany],
    queryFn: async () => {
      let q = supabase.from('analytics_ltv_cohort' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      q = q.order('cohort_mes', { ascending: false }).limit(24);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsLTVCohort[];
    },
  });
}

export function useAnalyticsEsforco() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_esforco_vendedor', activeCompany],
    queryFn: async () => {
      let q = supabase.from('analytics_esforco_vendedor' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      q = q.order('total_perdidos', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsEsforcoVendedor[];
    },
  });
}

export function useAnalyticsCanalEsforco(pipelineId?: string | null) {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['analytics_canal_esforco', activeCompany, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_canal_esforco' as any).select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('total_deals', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsCanalEsforco[];
    },
  });
}
