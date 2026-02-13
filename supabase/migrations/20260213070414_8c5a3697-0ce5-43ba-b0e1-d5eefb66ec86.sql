
-- ============================================================
-- Patch 5: Deal Detail — Migration
-- ============================================================

-- 1. Add missing columns to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS canal_origem TEXT,
  ADD COLUMN IF NOT EXISTS data_previsao_fechamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create deal_activities table
CREATE TABLE public.deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'NOTA','LIGACAO','EMAIL','REUNIAO','TAREFA',
    'STAGE_CHANGE','VALOR_CHANGE','GANHO','PERDA','REABERTO',
    'CRIACAO','ARQUIVO','WHATSAPP','OUTRO'
  )),
  descricao TEXT,
  metadata JSONB DEFAULT '{}',
  tarefa_concluida BOOLEAN DEFAULT false,
  tarefa_prazo TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deal_activities_deal ON public.deal_activities(deal_id, created_at DESC);
CREATE INDEX idx_deal_activities_tipo ON public.deal_activities(tipo);
CREATE INDEX idx_deal_activities_tarefa ON public.deal_activities(tipo, tarefa_concluida) WHERE tipo = 'TAREFA';

-- RLS
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON public.deal_activities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert activities"
  ON public.deal_activities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own activities"
  ON public.deal_activities FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service can manage activities"
  ON public.deal_activities FOR ALL
  USING (true);

-- 3. Trigger: auto-log deal changes
CREATE OR REPLACE FUNCTION public.log_deal_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Stage change
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
    VALUES (NEW.id, 'STAGE_CHANGE', 'Movido de estágio',
      jsonb_build_object('from_stage_id', OLD.stage_id, 'to_stage_id', NEW.stage_id));
  END IF;

  -- Value change
  IF OLD.valor IS DISTINCT FROM NEW.valor THEN
    INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
    VALUES (NEW.id, 'VALOR_CHANGE', 'Valor alterado',
      jsonb_build_object('old_valor', OLD.valor, 'new_valor', NEW.valor));
  END IF;

  -- Won
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'GANHO' THEN
    INSERT INTO deal_activities (deal_id, tipo, descricao)
    VALUES (NEW.id, 'GANHO', 'Deal marcado como ganho');
  END IF;

  -- Lost
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'PERDIDO' THEN
    INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
    VALUES (NEW.id, 'PERDA', 'Deal marcado como perdido',
      jsonb_build_object('motivo', NEW.motivo_perda, 'categoria', NEW.categoria_perda_closer));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_activity_log
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_activity();

-- 4. View: deals_full_detail
CREATE OR REPLACE VIEW public.deals_full_detail AS
SELECT
  d.*,
  c.nome AS contact_nome,
  c.email AS contact_email,
  c.telefone AS contact_telefone,
  c.foto_url AS contact_foto_url,
  o.nome AS org_nome,
  ps.nome AS stage_nome,
  ps.cor AS stage_cor,
  ps.posicao AS stage_posicao,
  ps.is_won AS stage_is_won,
  ps.is_lost AS stage_is_lost,
  ps.sla_minutos,
  ps.tempo_minimo_dias,
  p.nome AS pipeline_nome,
  p.empresa AS pipeline_empresa,
  pr.nome AS owner_nome,
  pr.email AS owner_email,
  pr.avatar_url AS owner_avatar_url,
  EXTRACT(EPOCH FROM (now() - COALESCE(
    (SELECT MAX(dsh.created_at) FROM deal_stage_history dsh WHERE dsh.deal_id = d.id),
    d.created_at
  ))) / 60 AS minutos_no_stage
FROM deals d
LEFT JOIN contacts c ON c.id = d.contact_id
LEFT JOIN organizations o ON o.id = d.organization_id
LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
LEFT JOIN pipelines p ON p.id = d.pipeline_id
LEFT JOIN profiles pr ON pr.id = d.owner_id;

ALTER VIEW public.deals_full_detail SET (security_invoker = on);
