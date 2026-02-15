
-- Task 14: Tabela de eventos de adoção para métricas de uso
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  empresa TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'navigation',
  metadata JSONB DEFAULT '{}'::JSONB,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name, created_at DESC);
CREATE INDEX idx_analytics_events_empresa ON public.analytics_events(empresa, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics events"
  ON public.analytics_events FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Authenticated users can insert events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Task 16: Tabela de rate limiting
CREATE TABLE public.rate_limit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  empresa TEXT,
  function_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INT NOT NULL DEFAULT 1,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_window ON public.rate_limit_log(function_name, user_id, window_start);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limits"
  ON public.rate_limit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Task 18: Tabela de versionamento de prompts
CREATE TABLE public.prompt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  prompt_key TEXT NOT NULL DEFAULT 'system',
  version INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prompt_versions_active ON public.prompt_versions(function_name, prompt_key) WHERE is_active = true;
CREATE INDEX idx_prompt_versions_fn ON public.prompt_versions(function_name, version DESC);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prompts"
  ON public.prompt_versions FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Task 17: Tabela de horários ideais de follow-up
CREATE TABLE public.follow_up_optimal_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora INT NOT NULL CHECK (hora BETWEEN 0 AND 23),
  taxa_resposta NUMERIC(5,2) DEFAULT 0,
  total_envios INT DEFAULT 0,
  total_respostas INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_follow_up_hours ON public.follow_up_optimal_hours(empresa, canal, dia_semana, hora);

ALTER TABLE public.follow_up_optimal_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view optimal hours"
  ON public.follow_up_optimal_hours FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service can manage optimal hours"
  ON public.follow_up_optimal_hours FOR ALL
  USING (true);
