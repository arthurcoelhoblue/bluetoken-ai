import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ZadarmaConfig, ZadarmaExtension, Call, CallStats, EmpresaTipo } from '@/types/telephony';

// ─── Config (global singleton) ─────────────────────
export function useZadarmaConfig() {
  return useQuery({
    queryKey: ['zadarma-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zadarma_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ZadarmaConfig | null;
    },
  });
}

export function useSaveZadarmaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: { id?: string; api_key: string; api_secret: string; webhook_enabled?: boolean; webrtc_enabled?: boolean; empresas_ativas?: string[] }) => {
      if (config.id) {
        // Update existing
        const { data, error } = await supabase
          .from('zadarma_config')
          .update({
            api_key: config.api_key,
            api_secret: config.api_secret,
            webhook_enabled: config.webhook_enabled ?? true,
            webrtc_enabled: config.webrtc_enabled ?? true,
            empresas_ativas: config.empresas_ativas ?? [],
          })
          .eq('id', config.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new singleton
        const { data, error } = await supabase
          .from('zadarma_config')
          .insert({
            api_key: config.api_key,
            api_secret: config.api_secret,
            webhook_enabled: config.webhook_enabled ?? true,
            webrtc_enabled: config.webrtc_enabled ?? true,
            empresas_ativas: config.empresas_ativas ?? [],
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zadarma-config'] });
    },
  });
}

// ─── Extensions (per empresa) ──────────────────────
export function useZadarmaExtensions(empresa: EmpresaTipo | null) {
  return useQuery({
    queryKey: ['zadarma-extensions', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zadarma_extensions')
        .select('*, profiles(nome)')
        .eq('empresa', empresa!)
        .order('extension_number');
      if (error) throw error;
      return (data ?? []).map((e: Record<string, unknown>) => ({
        ...e,
        user_nome: (e.profiles as { nome?: string } | null)?.nome ?? null,
      })) as ZadarmaExtension[];
    },
  });
}

export function useMyExtension(empresa: EmpresaTipo | null, userId: string | null) {
  return useQuery({
    queryKey: ['zadarma-my-extension', empresa, userId],
    enabled: !!empresa && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zadarma_extensions')
        .select('*')
        .eq('empresa', empresa!)
        .eq('user_id', userId!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as ZadarmaExtension | null;
    },
  });
}

export function useSaveExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ext: { id?: string; empresa: EmpresaTipo; extension_number: string; user_id: string; sip_login?: string }) => {
      if (ext.id) {
        const { error } = await supabase.from('zadarma_extensions').update({
          extension_number: ext.extension_number,
          user_id: ext.user_id,
          sip_login: ext.sip_login ?? null,
        }).eq('id', ext.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('zadarma_extensions').insert({
          empresa: ext.empresa,
          extension_number: ext.extension_number,
          user_id: ext.user_id,
          sip_login: ext.sip_login ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zadarma-extensions'] });
    },
  });
}

export function useDeleteExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zadarma_extensions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zadarma-extensions'] });
    },
  });
}

// ─── Calls ─────────────────────────────────────────
export function useDealCalls(dealId: string | null) {
  return useQuery({
    queryKey: ['deal-calls', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*, contacts(nome), profiles(nome)')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        contact_nome: (c.contacts as { nome?: string } | null)?.nome ?? null,
        user_nome: (c.profiles as { nome?: string } | null)?.nome ?? null,
      })) as Call[];
    },
  });
}

export function useCallStats(empresa: EmpresaTipo | null) {
  return useQuery({
    queryKey: ['call-stats', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_stats_by_user')
        .select('*')
        .eq('empresa', empresa!);
      if (error) throw error;
      return (data ?? []) as CallStats[];
    },
  });
}

// ─── Proxy ─────────────────────────────────────────
export function useZadarmaProxy() {
  return useMutation({
    mutationFn: async (params: { action: string; empresa: EmpresaTipo; payload?: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke('zadarma-proxy', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
  });
}

// ─── Statistics (Zadarma API) ─────────────────────
export function useZadarmaStatistics(empresa: EmpresaTipo | null, start: string, end: string) {
  const proxy = useZadarmaProxy();
  return useQuery({
    queryKey: ['zadarma-statistics', empresa, start, end],
    enabled: !!empresa && !!start && !!end,
    queryFn: async () => {
      const result = await proxy.mutateAsync({
        action: 'get_pbx_statistics',
        empresa: empresa!,
        payload: { start, end },
      });
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Tariff ───────────────────────────────────────
export function useZadarmaTariff(empresa: EmpresaTipo | null) {
  const proxy = useZadarmaProxy();
  return useQuery({
    queryKey: ['zadarma-tariff', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const result = await proxy.mutateAsync({
        action: 'get_current_tariff',
        empresa: empresa!,
      });
      return result;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Extension Status (batch) ─────────────────────
export function useExtensionStatuses(empresa: EmpresaTipo | null, extensions: { extension_number: string; user_nome?: string }[]) {
  const proxy = useZadarmaProxy();
  return useQuery({
    queryKey: ['zadarma-ext-statuses', empresa, extensions.map(e => e.extension_number).join(',')],
    enabled: !!empresa && extensions.length > 0,
    queryFn: async () => {
      const results = await Promise.allSettled(
        extensions.map(ext =>
          proxy.mutateAsync({
            action: 'get_extension_status',
            empresa: empresa!,
            payload: { extension: ext.extension_number },
          }).then(r => ({ extension: ext.extension_number, user_nome: ext.user_nome, ...r }))
        )
      );
      return results
        .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
