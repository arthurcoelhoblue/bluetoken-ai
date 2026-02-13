import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ZadarmaConfig, ZadarmaExtension, Call, CallStats, EmpresaTipo } from '@/types/patch13';

// ─── Config ────────────────────────────────────────
export function useZadarmaConfig(empresa: EmpresaTipo | null) {
  return useQuery({
    queryKey: ['zadarma-config', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zadarma_config')
        .select('*')
        .eq('empresa', empresa!)
        .maybeSingle();
      if (error) throw error;
      return data as ZadarmaConfig | null;
    },
  });
}

export function useSaveZadarmaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: { empresa: EmpresaTipo; api_key: string; api_secret: string; webhook_enabled?: boolean; webrtc_enabled?: boolean }) => {
      const { data, error } = await supabase
        .from('zadarma_config')
        .upsert({
          empresa: config.empresa,
          api_key: config.api_key,
          api_secret: config.api_secret,
          webhook_enabled: config.webhook_enabled ?? true,
          webrtc_enabled: config.webrtc_enabled ?? true,
        }, { onConflict: 'empresa' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['zadarma-config', vars.empresa] });
    },
  });
}

// ─── Extensions ────────────────────────────────────
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
      return (data ?? []).map((e: any) => ({
        ...e,
        user_nome: e.profiles?.nome ?? null,
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
      return (data ?? []).map((c: any) => ({
        ...c,
        contact_nome: c.contacts?.nome ?? null,
        user_nome: c.profiles?.nome ?? null,
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
