import type { Database } from '@/integrations/supabase/types';

export type EmpresaTipo = Database['public']['Enums']['empresa_tipo'];

export interface ZadarmaConfig {
  id: string;
  empresa: EmpresaTipo;
  api_key: string;
  api_secret: string;
  webhook_enabled: boolean;
  webrtc_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZadarmaExtension {
  id: string;
  empresa: EmpresaTipo;
  extension_number: string;
  user_id: string;
  sip_login: string | null;
  is_active: boolean;
  created_at: string;
  // joined
  user_nome?: string;
}

export interface Call {
  id: string;
  empresa: EmpresaTipo;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  direcao: 'INBOUND' | 'OUTBOUND';
  status: 'RINGING' | 'ANSWERED' | 'MISSED' | 'BUSY' | 'FAILED';
  pbx_call_id: string;
  caller_number: string | null;
  destination_number: string | null;
  duracao_segundos: number;
  recording_url: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
  // joined
  contact_nome?: string;
  user_nome?: string;
}

export interface CallEvent {
  id: string;
  call_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CallStats {
  user_id: string;
  user_nome: string | null;
  empresa: EmpresaTipo;
  ano: number;
  mes: number;
  total_chamadas: number;
  atendidas: number;
  perdidas: number;
  duracao_media: number;
  duracao_total: number;
}

export type PhoneWidgetState = 'idle' | 'dialing' | 'ringing' | 'active' | 'ended';

export interface DialEvent {
  number: string;
  contactName?: string;
  dealId?: string;
}
