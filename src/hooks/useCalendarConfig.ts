import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ========================================
// TYPES
// ========================================

export interface AvailabilitySlot {
  id?: string;
  user_id: string;
  dia_semana: number; // 0=dom, 6=sab
  hora_inicio: string; // "09:00"
  hora_fim: string; // "18:00"
  ativo: boolean;
}

export interface MeetingConfig {
  id?: string;
  user_id: string;
  duracao_minutos: number;
  intervalo_entre_reunioes: number;
  antecedencia_minima_horas: number;
  antecedencia_maxima_dias: number;
  fuso_horario: string;
  google_meet_automatico: boolean;
  aprovado_por?: string | null;
  aprovado_em?: string | null;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  expired: boolean;
  google_email: string | null;
  connected_at: string | null;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ========================================
// HOOK
// ========================================

export function useCalendarConfig(targetUserId?: string) {
  const { profile, roles } = useAuth();
  const userId = targetUserId || profile?.id;
  const isAdmin = roles?.includes('ADMIN');
  const isOwnProfile = !targetUserId || targetUserId === profile?.id;

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ========================================
  // FETCH
  // ========================================

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch availability
      const { data: availData } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', userId)
        .order('dia_semana')
        .order('hora_inicio');
      setAvailability((availData as AvailabilitySlot[]) || []);

      // Fetch meeting config
      const { data: configData } = await supabase
        .from('user_meeting_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setMeetingConfig(configData as MeetingConfig | null);

      // Fetch calendar status
      const { data: tokenData } = await supabase
        .from('user_google_tokens')
        .select('google_email, connected_at, token_expiry')
        .eq('user_id', userId)
        .maybeSingle();
      
      setCalendarStatus({
        connected: !!tokenData,
        expired: tokenData ? new Date(tokenData.token_expiry as string) < new Date() : false,
        google_email: (tokenData?.google_email as string) || null,
        connected_at: (tokenData?.connected_at as string) || null,
      });
    } catch (err) {
      console.error('Failed to fetch calendar config', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ========================================
  // AVAILABILITY CRUD
  // ========================================

  const addAvailabilitySlot = async (slot: Omit<AvailabilitySlot, 'id'>) => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_availability').insert({ ...slot, user_id: userId });
      if (error) throw error;
      toast.success(`Horário adicionado: ${DIAS_SEMANA[slot.dia_semana]} ${slot.hora_inicio}-${slot.hora_fim}`);
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao adicionar horário');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateAvailabilitySlot = async (id: string, updates: Partial<AvailabilitySlot>) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('user_availability').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Horário atualizado');
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao atualizar horário');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const removeAvailabilitySlot = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('user_availability').delete().eq('id', id);
      if (error) throw error;
      toast.success('Horário removido');
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao remover horário');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // MEETING CONFIG
  // ========================================

  const updateMeetingConfig = async (updates: Partial<MeetingConfig>) => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = { ...updates, user_id: userId };
      // If admin is approving for another user
      if (isAdmin && !isOwnProfile) {
        payload.aprovado_por = profile?.id;
        payload.aprovado_em = new Date().toISOString();
      }
      const { error } = await supabase.from('user_meeting_config').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Configuração de reunião atualizada');
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao atualizar configuração');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // GOOGLE CALENDAR CONNECTION
  // ========================================

  const connectGoogleCalendar = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'get_auth_url', user_id: userId },
      });
      if (error) throw error;
      // Open OAuth popup
      window.open(data.url, 'google-calendar-auth', 'width=600,height=700');
    } catch (err) {
      toast.error('Erro ao conectar Google Calendar');
      console.error(err);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect', user_id: userId },
      });
      if (error) throw error;
      toast.success('Google Calendar desconectado');
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao desconectar');
      console.error(err);
    }
  };

  return {
    // Data
    availability,
    meetingConfig,
    calendarStatus,
    loading,
    saving,
    // Permissions
    isAdmin,
    isOwnProfile,
    canEdit: isOwnProfile || isAdmin,
    // Actions
    addAvailabilitySlot,
    updateAvailabilitySlot,
    removeAvailabilitySlot,
    updateMeetingConfig,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    refresh: fetchAll,
    // Constants
    DIAS_SEMANA,
  };
}
