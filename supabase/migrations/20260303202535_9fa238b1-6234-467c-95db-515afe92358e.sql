
-- =============================================
-- Google Calendar + Meetings System
-- =============================================

-- 1. user_google_tokens: stores OAuth2 tokens per user
CREATE TABLE public.user_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google tokens"
  ON public.user_google_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. user_availability: weekly availability slots per user
CREATE TABLE public.user_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, dia_semana)
);

ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own availability"
  ON public.user_availability FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. user_meeting_config: meeting preferences per user
CREATE TABLE public.user_meeting_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duracao_minutos INT NOT NULL DEFAULT 30,
  buffer_minutos INT NOT NULL DEFAULT 10,
  max_por_dia INT NOT NULL DEFAULT 8,
  google_meet_enabled BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_meeting_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meeting config"
  ON public.user_meeting_config FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. meetings: core meetings table WITH transcription columns inline
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  empresa TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  google_event_id TEXT,
  google_meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'AGENDADA',
  notas TEXT,
  -- transcription fields (inline, not separate table)
  transcricao_metadata JSONB,
  transcricao_processada BOOLEAN DEFAULT false,
  transcricao_processada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see meetings of their empresas"
  ON public.meetings FOR SELECT TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users insert meetings of their empresas"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users update meetings of their empresas"
  ON public.meetings FOR UPDATE TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users delete meetings of their empresas"
  ON public.meetings FOR DELETE TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

-- 5. meeting_scheduling_state: SDR scheduling flow state
CREATE TABLE public.meeting_scheduling_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  empresa TEXT NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  slots_oferecidos JSONB,
  slot_escolhido JSONB,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_scheduling_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see scheduling state of their empresas"
  ON public.meeting_scheduling_state FOR SELECT TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users insert scheduling state of their empresas"
  ON public.meeting_scheduling_state FOR INSERT TO authenticated
  WITH CHECK (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users update scheduling state of their empresas"
  ON public.meeting_scheduling_state FOR UPDATE TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

-- Partial unique index: only one PENDENTE per lead+empresa
CREATE UNIQUE INDEX idx_meeting_scheduling_state_pendente
  ON public.meeting_scheduling_state (lead_id, empresa)
  WHERE status = 'PENDENTE';

-- Indexes for meetings
CREATE INDEX idx_meetings_deal_id ON public.meetings(deal_id);
CREATE INDEX idx_meetings_contact_id ON public.meetings(contact_id);
CREATE INDEX idx_meetings_owner_id ON public.meetings(owner_id);
CREATE INDEX idx_meetings_data_inicio ON public.meetings(data_inicio);

-- updated_at triggers
CREATE TRIGGER update_user_google_tokens_updated_at BEFORE UPDATE ON public.user_google_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_availability_updated_at BEFORE UPDATE ON public.user_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_meeting_config_updated_at BEFORE UPDATE ON public.user_meeting_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meeting_scheduling_state_updated_at BEFORE UPDATE ON public.meeting_scheduling_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
