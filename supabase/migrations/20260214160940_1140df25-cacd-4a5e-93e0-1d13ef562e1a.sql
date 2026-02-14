
-- =============================================
-- Sprint 2: Notifications table + Deal scoring
-- =============================================

-- 1. Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  entity_id TEXT,
  entity_type TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, lida) WHERE lida = false;
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2. Score probabilidade column on deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS score_probabilidade INTEGER NOT NULL DEFAULT 0;

-- 3. Scoring function
CREATE OR REPLACE FUNCTION public.fn_calc_deal_score(p_deal_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal RECORD;
  v_stage_rate NUMERIC := 0;
  v_time_score NUMERIC := 0;
  v_temp_score NUMERIC := 0;
  v_engagement_score NUMERIC := 0;
  v_final_score INTEGER := 0;
  v_avg_time NUMERIC;
  v_current_time NUMERIC;
BEGIN
  SELECT d.*, ps.posicao, ps.is_won, ps.is_lost
  INTO v_deal
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = p_deal_id;

  IF v_deal IS NULL OR v_deal.status != 'ABERTO' THEN
    RETURN 0;
  END IF;

  -- 1. Stage conversion rate (40%)
  SELECT COALESCE(scr.taxa_conversao, 0.5) INTO v_stage_rate
  FROM stage_conversion_rates scr
  WHERE scr.stage_id = v_deal.stage_id
  LIMIT 1;
  
  -- If view doesn't exist or no data, use position-based heuristic
  IF v_stage_rate IS NULL OR v_stage_rate = 0 THEN
    v_stage_rate := 0.5;
  END IF;

  -- 2. Time in stage vs average (20%) - less time = better
  SELECT AVG(EXTRACT(EPOCH FROM (dsh2.created_at - dsh1.created_at)) / 86400)
  INTO v_avg_time
  FROM deal_stage_history dsh1
  JOIN deal_stage_history dsh2 ON dsh2.deal_id = dsh1.deal_id 
    AND dsh2.from_stage_id = dsh1.to_stage_id
  WHERE dsh1.to_stage_id = v_deal.stage_id;

  v_current_time := EXTRACT(EPOCH FROM (now() - v_deal.updated_at)) / 86400;
  
  IF v_avg_time IS NOT NULL AND v_avg_time > 0 THEN
    v_time_score := GREATEST(0, LEAST(1, 1 - (v_current_time / (v_avg_time * 2))));
  ELSE
    v_time_score := CASE WHEN v_current_time < 7 THEN 0.8 WHEN v_current_time < 30 THEN 0.5 ELSE 0.2 END;
  END IF;

  -- 3. Temperature (15%)
  v_temp_score := CASE v_deal.temperatura
    WHEN 'QUENTE' THEN 1.0
    WHEN 'MORNO' THEN 0.5
    WHEN 'FRIO' THEN 0.15
    ELSE 0.3
  END;

  -- 4. Engagement scores average (25%)
  v_engagement_score := (
    COALESCE(v_deal.score_engajamento, 0) +
    COALESCE(v_deal.score_intencao, 0) +
    COALESCE(v_deal.score_valor, 0) +
    COALESCE(v_deal.score_urgencia, 0)
  ) / 400.0;

  -- Weighted final score
  v_final_score := ROUND(
    (v_stage_rate * 40) +
    (v_time_score * 20) +
    (v_temp_score * 15) +
    (v_engagement_score * 25)
  )::INTEGER;

  RETURN GREATEST(1, LEAST(99, v_final_score));
END;
$$;

-- 4. Trigger to recalculate score on deal changes
CREATE OR REPLACE FUNCTION public.fn_update_deal_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'ABERTO' AND (
    OLD.stage_id IS DISTINCT FROM NEW.stage_id OR
    OLD.temperatura IS DISTINCT FROM NEW.temperatura OR
    OLD.score_engajamento IS DISTINCT FROM NEW.score_engajamento OR
    OLD.score_intencao IS DISTINCT FROM NEW.score_intencao
  ) THEN
    NEW.score_probabilidade := fn_calc_deal_score(NEW.id);
  END IF;
  
  IF NEW.status != 'ABERTO' THEN
    NEW.score_probabilidade := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_deal_score
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_deal_score();
