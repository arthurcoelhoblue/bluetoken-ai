import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { MetaProgresso, ComissaoRegra, ComissaoLancamento, ComissaoResumoMensal, ComissaoStatus } from '@/types/metas';
import { toast } from '@/hooks/use-toast';

function useEmpresa() {
  const { activeCompany } = useCompany();
  return activeCompany === 'ALL' ? 'BLUE' : activeCompany;
}

// ─── Sazonalidade ───

export interface SazonalidadeIndice {
  id: string;
  empresa: string;
  mes: number;
  indice: number;
  updated_at: string;
  updated_by: string | null;
}

export function useSazonalidade() {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['sazonalidade', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sazonalidade_indices')
        .select('*')
        .eq('empresa', empresa)
        .order('mes');
      if (error) throw error;
      return (data || []) as unknown as SazonalidadeIndice[];
    },
  });
}

export function useUpdateSazonalidade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (indices: { id: string; indice: number }[]) => {
      for (const idx of indices) {
        const { error } = await supabase
          .from('sazonalidade_indices')
          .update({ indice: idx.indice, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
          .eq('id', idx.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sazonalidade'] });
      toast({ title: 'Índices de sazonalidade salvos' });
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' }),
  });
}

export function useUpsertMetasBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (metas: { user_id: string; empresa: string; ano: number; mes: number; meta_valor: number; meta_deals: number }[]) => {
      for (const m of metas) {
        const { error } = await supabase
          .from('metas_vendedor')
          .upsert(m, { onConflict: 'user_id,empresa,ano,mes' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-progresso'] });
      toast({ title: 'Metas anuais distribuídas com sucesso' });
    },
    onError: (e: unknown) => toast({ title: 'Erro ao distribuir metas', description: (e as Error).message, variant: 'destructive' }),
  });
}

export function useMetaProgresso(ano: number, mes: number) {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['meta-progresso', empresa, ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_progresso')
        .select('*')
        .eq('empresa', empresa)
        .eq('ano', ano)
        .eq('mes', mes)
        .order('realizado_valor', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MetaProgresso[];
    },
  });
}

export function useMyMetaProgresso(ano: number, mes: number) {
  const empresa = useEmpresa();
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-meta-progresso', empresa, ano, mes, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_progresso')
        .select('*')
        .eq('empresa', empresa)
        .eq('ano', ano)
        .eq('mes', mes)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MetaProgresso | null;
    },
  });
}

export function useUpsertMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; empresa: string; ano: number; mes: number; meta_valor: number; meta_deals: number }) => {
      const { error } = await supabase
        .from('metas_vendedor')
        .upsert(payload, { onConflict: 'user_id,empresa,ano,mes' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-progresso'] });
      toast({ title: 'Meta salva com sucesso' });
    },
    onError: (e: unknown) => toast({ title: 'Erro ao salvar meta', description: (e as Error).message, variant: 'destructive' }),
  });
}

export function useComissaoRegras() {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['comissao-regras', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissao_regras')
        .select('*')
        .eq('empresa', empresa)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ComissaoRegra[];
    },
  });
}

export function useUpsertComissaoRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ComissaoRegra> & { empresa: string; nome: string; tipo: string }) => {
      const { id, created_at, updated_at, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from('comissao_regras').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('comissao_regras').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comissao-regras'] });
      toast({ title: 'Regra salva' });
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' }),
  });
}

export function useComissaoLancamentos(ano: number, mes: number) {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['comissao-lancamentos', empresa, ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissao_lancamentos')
        .select('*, deals:deal_id(titulo), profiles:user_id(nome), comissao_regras:regra_id(nome)')
        .eq('empresa', empresa)
        .eq('referencia_ano', ano)
        .eq('referencia_mes', mes)
        .order('created_at', { ascending: false });
      if (error) throw error;
      type LancamentoRow = typeof data[number];
      return (data || []).map((d: LancamentoRow) => ({
        ...d,
        deal_titulo: (d.deals as unknown as { titulo: string } | null)?.titulo,
        vendedor_nome: (d.profiles as unknown as { nome: string } | null)?.nome,
        regra_nome: (d.comissao_regras as unknown as { nome: string } | null)?.nome,
      })) as ComissaoLancamento[];
    },
  });
}

export function useUpdateComissaoStatus() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ComissaoStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'APROVADO') {
        updates.aprovado_por = user?.id;
        updates.aprovado_em = new Date().toISOString();
      }
      if (status === 'PAGO') {
        updates.pago_em = new Date().toISOString();
      }
      const { error } = await supabase.from('comissao_lancamentos').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comissao-lancamentos'] });
      qc.invalidateQueries({ queryKey: ['meta-progresso'] });
      toast({ title: 'Status atualizado' });
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' }),
  });
}

export function useComissaoResumo(ano: number, mes: number) {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['comissao-resumo', empresa, ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissao_resumo_mensal')
        .select('*')
        .eq('empresa', empresa)
        .eq('ano', ano)
        .eq('mes', mes);
      if (error) throw error;
      return (data || []) as unknown as ComissaoResumoMensal[];
    },
  });
}
