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

function useEmpresaFilter() {
  const { activeCompanies } = useCompany();
  return activeCompanies;
}

export function useAnalyticsFunnel(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_funnel', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_funnel').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('posicao', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsFunnel[];
    },
  });
}

export function useAnalyticsConversion(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_conversion', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_conversion').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsConversion[];
    },
  });
}

export function useAnalyticsVendedor() {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_vendedor', companies],
    queryFn: async () => {
      let q = supabase.from('analytics_vendedor').select('*');
      q = q.in('empresa', companies);
      q = q.order('valor_ganho', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsVendedor[];
    },
  });
}

export function useAnalyticsPeriodo(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_periodo', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_deals_periodo').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('mes', { ascending: false }).limit(12);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsPeriodo[];
    },
  });
}

export function useAnalyticsMotivosPerda(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_motivos_perda', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_motivos_perda').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('quantidade', { ascending: false }).limit(20);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsMotivosPerda[];
    },
  });
}

export function useAnalyticsCanalOrigem(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_canal_origem', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_canal_origem').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('total_deals', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsCanalOrigem[];
    },
  });
}

export function useAnalyticsFunilVisual(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_funil_visual', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_funil_visual').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('posicao', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsFunilVisual[];
    },
  });
}

export function useAnalyticsEvolucao(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_evolucao_mensal', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_evolucao_mensal').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('mes', { ascending: false }).limit(12);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsEvolucaoMensal[];
    },
  });
}

export function useAnalyticsLTV() {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_ltv_cohort', companies],
    queryFn: async () => {
      let q = supabase.from('analytics_ltv_cohort').select('*');
      q = q.in('empresa', companies);
      q = q.order('cohort_mes', { ascending: false }).limit(24);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsLTVCohort[];
    },
  });
}

export function useAnalyticsEsforco() {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_esforco_vendedor', companies],
    queryFn: async () => {
      let q = supabase.from('analytics_esforco_vendedor').select('*');
      q = q.in('empresa', companies);
      q = q.order('total_perdidos', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsEsforcoVendedor[];
    },
  });
}

export function useAnalyticsCanalEsforco(pipelineId?: string | null) {
  const companies = useEmpresaFilter();
  return useQuery({
    queryKey: ['analytics_canal_esforco', companies, pipelineId],
    queryFn: async () => {
      let q = supabase.from('analytics_canal_esforco').select('*');
      q = q.in('empresa', companies);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      q = q.order('total_deals', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsCanalEsforco[];
    },
  });
}