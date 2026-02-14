
-- 1. Trigger deal ganho já existe, garantir que está correto
DROP TRIGGER IF EXISTS trg_gamify_deal_ganho ON deals;
CREATE TRIGGER trg_gamify_deal_ganho
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_deal_ganho();

-- 2. Função e trigger para atividades concluídas
CREATE OR REPLACE FUNCTION fn_gamify_activity_done()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_empresa text;
  v_week_count int;
BEGIN
  IF NEW.tarefa_concluida = true AND (OLD.tarefa_concluida IS DISTINCT FROM true) AND NEW.user_id IS NOT NULL THEN
    SELECT c.empresa::text INTO v_empresa
    FROM deals d JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = NEW.deal_id;
    IF v_empresa IS NULL THEN v_empresa := 'BLUE'; END IF;

    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.user_id, v_empresa, 5, 'TAREFA_CONCLUIDA', NEW.id::text);

    SELECT COUNT(*) INTO v_week_count
    FROM deal_activities
    WHERE user_id = NEW.user_id AND tarefa_concluida = true
      AND created_at >= date_trunc('week', now());
    IF v_week_count >= 50 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.user_id, 'activity_50', v_empresa, to_char(now(), 'IYYY-IW'))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gamify_activity_done ON deal_activities;
CREATE TRIGGER trg_gamify_activity_done
  AFTER UPDATE ON deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_activity_done();

-- 3. Função e trigger para streak check
CREATE OR REPLACE FUNCTION fn_gamify_streak_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_streak int;
BEGIN
  SELECT COUNT(DISTINCT created_at::date) INTO v_streak
  FROM seller_points_log
  WHERE user_id = NEW.user_id AND empresa = NEW.empresa
    AND created_at >= now() - interval '30 days';

  IF v_streak >= 3 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_3', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;
  IF v_streak >= 7 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_7', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;
  IF v_streak >= 30 THEN
    INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
    VALUES (NEW.user_id, 'streak_30', NEW.empresa, 'auto') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gamify_streak_check ON seller_points_log;
CREATE TRIGGER trg_gamify_streak_check
  AFTER INSERT ON seller_points_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_gamify_streak_check();

-- 4. Habilitar realtime (idempotent via IF NOT EXISTS workaround)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'seller_points_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seller_points_log;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'seller_badge_awards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seller_badge_awards;
  END IF;
END $$;
