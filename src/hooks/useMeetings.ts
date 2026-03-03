import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Meeting {
  id: string;
  empresa: string;
  vendedor_id: string;
  lead_id: string | null;
  deal_id: string | null;
  convidado_nome: string | null;
  convidado_email: string | null;
  convidado_telefone: string | null;
  data_hora_inicio: string;
  data_hora_fim: string;
  fuso_horario: string;
  status: 'AGENDADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA' | 'NO_SHOW';
  google_event_id: string | null;
  google_meet_link: string | null;
  titulo: string | null;
  descricao: string | null;
  agendado_por: string;
  transcricao_processada: boolean;
  transcricao_metadata: TranscriptionMetadata | null;
  created_at: string;
}

export interface TranscriptionMetadata {
  resumo: string;
  pontos_chave: string[];
  proximos_passos: string[];
  objecoes_levantadas: string[];
  interesse_detectado: string;
  produtos_mencionados: string[];
  sentimento_geral: string;
  duracao_estimada_minutos: number | null;
  participantes_detectados: string[];
  decisoes_tomadas: string[];
  perguntas_pendentes: string[];
}

export function useMeetings(dealId?: string, leadId?: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    if (!dealId && !leadId) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase.from('meetings').select('*');
      if (dealId) query = query.eq('deal_id', dealId);
      else if (leadId) query = query.eq('lead_id', leadId);
      query = query.order('data_hora_inicio', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setMeetings((data as Meeting[]) || []);
    } catch (err) {
      console.error('Failed to fetch meetings', err);
    } finally {
      setLoading(false);
    }
  }, [dealId, leadId]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const updateMeetingStatus = async (meetingId: string, status: Meeting['status']) => {
    try {
      const { error } = await supabase.from('meetings').update({ status, updated_at: new Date().toISOString() }).eq('id', meetingId);
      if (error) throw error;
      toast.success(`Status atualizado para ${status}`);
      await fetchMeetings();
    } catch (err) {
      toast.error('Erro ao atualizar status');
    }
  };

  const uploadTranscription = async (meetingId: string, file: File) => {
    try {
      const text = await file.text();
      toast.info('Processando transcrição...');
      
      const { data, error } = await supabase.functions.invoke('meeting-transcription', {
        body: { meeting_id: meetingId, transcription_text: text },
      });

      if (error) throw error;
      toast.success('Transcrição processada! Metadados extraídos.');
      await fetchMeetings();
      return data?.metadata as TranscriptionMetadata;
    } catch (err) {
      toast.error('Erro ao processar transcrição');
      console.error(err);
      return null;
    }
  };

  return { meetings, loading, updateMeetingStatus, uploadTranscription, refresh: fetchMeetings };
}
