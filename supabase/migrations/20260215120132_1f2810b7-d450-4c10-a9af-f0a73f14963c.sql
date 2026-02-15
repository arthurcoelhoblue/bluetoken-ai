
-- Tabela de telemetria de uso de IA
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  tokens_input int,
  tokens_output int,
  custo_estimado numeric(10,6),
  latency_ms int,
  success boolean DEFAULT true,
  error_message text,
  empresa text,
  created_at timestamptz DEFAULT now()
);

-- RLS: service_role insere, ADMIN pode ler
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins podem ler todos os logs
CREATE POLICY "Admins can read ai_usage_log"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Index para queries por function e data
CREATE INDEX idx_ai_usage_log_function ON public.ai_usage_log (function_name, created_at DESC);
CREATE INDEX idx_ai_usage_log_empresa ON public.ai_usage_log (empresa, created_at DESC);
