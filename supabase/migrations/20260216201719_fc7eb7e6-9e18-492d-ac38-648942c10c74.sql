
-- Tabela de rastreamento de atividade do usuario
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa text NOT NULL,
  action_type text NOT NULL,
  action_detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para queries por usuario + empresa + tempo
CREATE INDEX idx_user_activity_log_user_empresa ON public.user_activity_log (user_id, empresa, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Politicas: usuario so ve/insere suas proprias acoes
CREATE POLICY "Users can view own activity"
ON public.user_activity_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
ON public.user_activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Funcao de limpeza automatica (remove registros com mais de 48h)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_activity_log
  WHERE created_at < now() - interval '48 hours';
  RETURN NEW;
END;
$$;

-- Trigger que limpa registros antigos a cada insert
CREATE TRIGGER trg_cleanup_activity_logs
AFTER INSERT ON public.user_activity_log
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_activity_logs();
