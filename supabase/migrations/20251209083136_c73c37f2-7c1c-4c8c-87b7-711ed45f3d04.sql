-- ========================================
-- PATCH 5E: Tabela de logs do cadence-runner
-- ========================================

-- Tabela para registrar execuções do runner
CREATE TABLE IF NOT EXISTS public.cadence_runner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  steps_executed int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  runs_touched int NOT NULL DEFAULT 0,
  duration_ms int DEFAULT NULL,
  details jsonb DEFAULT NULL,
  trigger_source text DEFAULT 'CRON' -- CRON, MANUAL, TEST
);

-- Índice para consultas por data
CREATE INDEX idx_cadence_runner_logs_executed_at ON public.cadence_runner_logs(executed_at DESC);

-- RLS para tabela de logs
ALTER TABLE public.cadence_runner_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem ver logs
CREATE POLICY "Admins can view cadence_runner_logs"
ON public.cadence_runner_logs
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- Service pode inserir logs
CREATE POLICY "Service can insert cadence_runner_logs"
ON public.cadence_runner_logs
FOR INSERT
WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE public.cadence_runner_logs IS 'Logs de execução do cadence-runner (CRON)';

-- ========================================
-- Habilitar extensões necessárias para CRON
-- ========================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;