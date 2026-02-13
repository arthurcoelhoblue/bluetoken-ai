
-- =====================================================
-- PATCH 13: Zadarma Telephony Integration
-- Tables: zadarma_config, zadarma_extensions, calls, call_events
-- View: call_stats_by_user
-- =====================================================

-- 1. zadarma_config — one config per empresa
CREATE TABLE public.zadarma_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  webhook_enabled BOOLEAN NOT NULL DEFAULT true,
  webrtc_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zadarma_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin SELECT zadarma_config"
  ON public.zadarma_config FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin INSERT zadarma_config"
  ON public.zadarma_config FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin UPDATE zadarma_config"
  ON public.zadarma_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin DELETE zadarma_config"
  ON public.zadarma_config FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service zadarma_config"
  ON public.zadarma_config FOR SELECT
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_zadarma_config_updated_at
  BEFORE UPDATE ON public.zadarma_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. zadarma_extensions — PBX extension to user mapping
CREATE TABLE public.zadarma_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  extension_number TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  sip_login TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa, extension_number)
);

ALTER TABLE public.zadarma_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated SELECT zadarma_extensions"
  ON public.zadarma_extensions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR empresa::text = public.get_user_empresa(auth.uid())
  );

CREATE POLICY "Admin INSERT zadarma_extensions"
  ON public.zadarma_extensions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin UPDATE zadarma_extensions"
  ON public.zadarma_extensions FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin DELETE zadarma_extensions"
  ON public.zadarma_extensions FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service zadarma_extensions"
  ON public.zadarma_extensions FOR ALL
  USING (auth.role() = 'service_role');

-- 3. calls — call log
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  deal_id UUID REFERENCES public.deals(id),
  contact_id UUID REFERENCES public.contacts(id),
  user_id UUID REFERENCES public.profiles(id),
  direcao TEXT NOT NULL CHECK (direcao IN ('INBOUND', 'OUTBOUND')),
  status TEXT NOT NULL DEFAULT 'RINGING' CHECK (status IN ('RINGING', 'ANSWERED', 'MISSED', 'BUSY', 'FAILED')),
  pbx_call_id TEXT NOT NULL,
  caller_number TEXT,
  destination_number TEXT,
  duracao_segundos INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_empresa ON public.calls(empresa);
CREATE INDEX idx_calls_deal_id ON public.calls(deal_id);
CREATE INDEX idx_calls_contact_id ON public.calls(contact_id);
CREATE INDEX idx_calls_user_id ON public.calls(user_id);
CREATE INDEX idx_calls_pbx_call_id ON public.calls(pbx_call_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users SELECT calls by empresa"
  ON public.calls FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR empresa::text = public.get_user_empresa(auth.uid())
  );

CREATE POLICY "Service INSERT calls"
  ON public.calls FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service UPDATE calls"
  ON public.calls FOR UPDATE
  USING (auth.role() = 'service_role');

-- 4. call_events — raw webhook events
CREATE TABLE public.call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES public.calls(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_events_call_id ON public.call_events(call_id);

ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin SELECT call_events"
  ON public.call_events FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service INSERT call_events"
  ON public.call_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service SELECT call_events"
  ON public.call_events FOR SELECT
  USING (auth.role() = 'service_role');

-- 5. View: call_stats_by_user (SECURITY INVOKER)
CREATE OR REPLACE VIEW public.call_stats_by_user
WITH (security_invoker = true)
AS
SELECT
  c.user_id,
  p.nome AS user_nome,
  c.empresa,
  EXTRACT(YEAR FROM c.started_at)::INT AS ano,
  EXTRACT(MONTH FROM c.started_at)::INT AS mes,
  COUNT(*)::INT AS total_chamadas,
  COUNT(*) FILTER (WHERE c.status = 'ANSWERED')::INT AS atendidas,
  COUNT(*) FILTER (WHERE c.status = 'MISSED')::INT AS perdidas,
  COALESCE(AVG(c.duracao_segundos) FILTER (WHERE c.status = 'ANSWERED'), 0)::INT AS duracao_media,
  COALESCE(SUM(c.duracao_segundos) FILTER (WHERE c.status = 'ANSWERED'), 0)::INT AS duracao_total
FROM public.calls c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE c.started_at IS NOT NULL
GROUP BY c.user_id, p.nome, c.empresa, ano, mes;

-- Enable realtime for calls table
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
