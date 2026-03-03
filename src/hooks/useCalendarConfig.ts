import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export interface AvailabilitySlot {
  id?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
}

export interface MeetingConfig {
  duracao_minutos: number;
  buffer_minutos: number;
  max_por_dia: number;
  google_meet_enabled: boolean;
  timezone: string;
}

const DEFAULT_CONFIG: MeetingConfig = {
  duracao_minutos: 30,
  buffer_minutos: 10,
  max_por_dia: 8,
  google_meet_enabled: true,
  timezone: 'America/Sao_Paulo',
};

export function useCalendarConfig(userId?: string) {
  const qc = useQueryClient();

  const { data: availability = [], isLoading: loadingAvail } = useQuery({
    queryKey: ['calendar-availability', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data || []) as AvailabilitySlot[];
    },
  });

  const { data: config = DEFAULT_CONFIG, isLoading: loadingConfig } = useQuery({
    queryKey: ['meeting-config', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_meeting_config')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MeetingConfig) || DEFAULT_CONFIG;
    },
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['google-calendar-status', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };
      const resp = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });
      return resp.data || { connected: false };
    },
  });

  const saveAvailability = useMutation({
    mutationFn: async (slots: AvailabilitySlot[]) => {
      if (!userId) throw new Error('No user');
      // Delete existing and re-insert
      await supabase.from('user_availability').delete().eq('user_id', userId);
      if (slots.length > 0) {
        const { error } = await supabase.from('user_availability').insert(
          slots.map(s => ({ user_id: userId, ...s }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-availability', userId] });
      toast.success('Disponibilidade salva');
    },
    onError: () => toast.error('Erro ao salvar disponibilidade'),
  });

  const saveConfig = useMutation({
    mutationFn: async (cfg: Partial<MeetingConfig>) => {
      if (!userId) throw new Error('No user');
      const { error } = await supabase.from('user_meeting_config').upsert(
        { user_id: userId, ...cfg },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-config', userId] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  return {
    availability,
    config,
    googleStatus: googleStatus as { connected: boolean; expiry?: string } | undefined,
    isLoading: loadingAvail || loadingConfig,
    saveAvailability,
    saveConfig,
    DAYS,
  };
}
