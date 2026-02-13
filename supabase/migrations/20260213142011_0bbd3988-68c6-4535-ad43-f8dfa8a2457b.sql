
-- ============================================================
-- FRENTE 1: GAMIFICAÇÃO — Tabelas, triggers, seed, RLS
-- ============================================================

-- 1. seller_badges
CREATE TABLE public.seller_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text NOT NULL DEFAULT 'trophy',
  categoria text NOT NULL DEFAULT 'FECHAMENTO',
  criterio_valor int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_badges_read" ON public.seller_badges FOR SELECT TO authenticated USING (true);

-- 2. seller_badge_awards
CREATE TABLE public.seller_badge_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  badge_key text NOT NULL REFERENCES public.seller_badges(key),
  empresa text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  referencia text,
  UNIQUE(user_id, badge_key, referencia)
);
ALTER TABLE public.seller_badge_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badge_awards_read" ON public.seller_badge_awards FOR SELECT TO authenticated
  USING (empresa = public.get_user_empresa(auth.uid()));

-- 3. seller_points_log
CREATE TABLE public.seller_points_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  empresa text NOT NULL,
  pontos int NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'DEAL_GANHO',
  referencia_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_log_read" ON public.seller_points_log FOR SELECT TO authenticated
  USING (empresa = public.get_user_empresa(auth.uid()));

-- 4. View: seller_leaderboard
CREATE OR REPLACE VIEW public.seller_leaderboard AS
WITH pontos_mes AS (
  SELECT user_id, empresa, SUM(pontos) AS pontos_mes
  FROM public.seller_points_log
  WHERE created_at >= date_trunc('month', now())
  GROUP BY user_id, empresa
),
badges_count AS (
  SELECT user_id, empresa, COUNT(*) AS total_badges
  FROM public.seller_badge_awards
  GROUP BY user_id, empresa
),
streak AS (
  SELECT da.user_id,
         COALESCE(c.empresa::text, 'BLUE') AS empresa,
         COUNT(DISTINCT da.created_at::date) AS streak_dias
  FROM public.deal_activities da
  LEFT JOIN public.deals d ON d.id = da.deal_id
  LEFT JOIN public.contacts c ON c.id = d.contact_id
  WHERE da.created_at >= now() - interval '30 days'
  GROUP BY da.user_id, c.empresa
)
SELECT
  p.id AS user_id,
  p.nome AS vendedor_nome,
  p.avatar_url AS vendedor_avatar,
  COALESCE(pm.empresa, bc.empresa, s.empresa, 'BLUE') AS empresa,
  COALESCE(pm.pontos_mes, 0) AS pontos_mes,
  COALESCE(bc.total_badges, 0)::int AS total_badges,
  COALESCE(s.streak_dias, 0)::int AS streak_dias,
  ROW_NUMBER() OVER (
    PARTITION BY COALESCE(pm.empresa, bc.empresa, s.empresa, 'BLUE')
    ORDER BY COALESCE(pm.pontos_mes, 0) DESC
  )::int AS ranking_posicao
FROM public.profiles p
LEFT JOIN pontos_mes pm ON pm.user_id = p.id
LEFT JOIN badges_count bc ON bc.user_id = p.id AND bc.empresa = pm.empresa
LEFT JOIN streak s ON s.user_id = p.id AND s.empresa = COALESCE(pm.empresa, bc.empresa)
WHERE COALESCE(pm.pontos_mes, 0) > 0 OR COALESCE(bc.total_badges, 0) > 0;

-- 5. Trigger: pontuar ao ganhar deal
CREATE OR REPLACE FUNCTION public.fn_gamify_deal_ganho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa text;
  v_pontos int;
  v_total_ganhos int;
BEGIN
  IF NEW.status = 'GANHO' AND (OLD.status IS DISTINCT FROM 'GANHO') AND NEW.owner_id IS NOT NULL THEN
    SELECT c.empresa::text INTO v_empresa FROM contacts c WHERE c.id = NEW.contact_id;
    IF v_empresa IS NULL THEN v_empresa := 'BLUE'; END IF;
    v_pontos := GREATEST(10, COALESCE(NEW.valor, 0) / 1000);
    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.owner_id, v_empresa, v_pontos, 'DEAL_GANHO', NEW.id);
    SELECT COUNT(*) INTO v_total_ganhos FROM deals WHERE owner_id = NEW.owner_id AND status = 'GANHO';
    IF v_total_ganhos >= 1 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'first_deal', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
    IF v_total_ganhos >= 10 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'deal_10', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
    IF v_total_ganhos >= 50 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'deal_50', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gamify_deal_ganho
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.fn_gamify_deal_ganho();

-- 6. Seed badges
INSERT INTO public.seller_badges (key, nome, descricao, icone, categoria, criterio_valor) VALUES
  ('first_deal', 'Primeiro Fechamento', 'Fechou seu primeiro deal', 'trophy', 'FECHAMENTO', 1),
  ('deal_10', 'Decacampeão', 'Fechou 10 deals', 'award', 'FECHAMENTO', 10),
  ('deal_50', 'Máquina de Vendas', 'Fechou 50 deals', 'zap', 'FECHAMENTO', 50),
  ('streak_3', 'Fogo Aceso', '3 dias consecutivos com atividades', 'flame', 'STREAK', 3),
  ('streak_7', 'Semana Perfeita', '7 dias consecutivos com atividades', 'calendar-check', 'STREAK', 7),
  ('streak_30', 'Incansável', '30 dias consecutivos com atividades', 'shield-check', 'STREAK', 30),
  ('top_month', 'Top do Mês', '#1 no ranking mensal', 'crown', 'RANKING', 1),
  ('meta_100', 'Meta Batida', 'Atingiu 100% da meta', 'target', 'FECHAMENTO', 100),
  ('meta_150', 'Super Meta', 'Atingiu 150% da meta', 'rocket', 'FECHAMENTO', 150),
  ('activity_50', 'Produtivo', '50 atividades na semana', 'activity', 'ATIVIDADE', 50);

-- ============================================================
-- FRENTE 2: ANALYTICS AVANÇADO — Views
-- ============================================================

-- 7. analytics_funil_visual
CREATE OR REPLACE VIEW public.analytics_funil_visual AS
WITH stages AS (
  SELECT ps.id AS stage_id, ps.nome AS stage_nome, ps.posicao,
         ps.pipeline_id, pi.nome AS pipeline_nome, pi.empresa::text AS empresa
  FROM public.pipeline_stages ps
  JOIN public.pipelines pi ON pi.id = ps.pipeline_id
),
stage_deals AS (
  SELECT d.stage_id, COUNT(*) AS deals_count, COALESCE(SUM(d.valor), 0) AS deals_valor
  FROM public.deals d WHERE d.status = 'ABERTO'
  GROUP BY d.stage_id
)
SELECT
  s.pipeline_id, s.pipeline_nome, s.empresa,
  s.stage_id, s.stage_nome, s.posicao,
  COALESCE(sd.deals_count, 0)::int AS deals_entrada,
  COALESCE(LEAD(sd.deals_count) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0)::int AS deals_saida,
  CASE WHEN COALESCE(sd.deals_count, 0) > 0
    THEN ROUND(COALESCE(LEAD(sd.deals_count) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0)::numeric / sd.deals_count * 100, 1)
    ELSE 0 END AS taxa_conversao,
  COALESCE(sd.deals_valor, 0) AS valor_entrada,
  COALESCE(LEAD(sd.deals_valor) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0) AS valor_saida
FROM stages s
LEFT JOIN stage_deals sd ON sd.stage_id = s.stage_id
ORDER BY s.pipeline_id, s.posicao;

-- 8. analytics_evolucao_mensal
CREATE OR REPLACE VIEW public.analytics_evolucao_mensal AS
SELECT
  to_char(d.created_at, 'YYYY-MM') AS mes,
  c.empresa::text AS empresa,
  d.pipeline_id,
  COUNT(*) AS deals_criados,
  COUNT(*) FILTER (WHERE d.status = 'GANHO') AS deals_ganhos,
  COUNT(*) FILTER (WHERE d.status = 'PERDIDO') AS deals_perdidos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'GANHO'), 0) AS valor_ganho,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'PERDIDO'), 0) AS valor_perdido,
  CASE WHEN COUNT(*) FILTER (WHERE d.status IN ('GANHO','PERDIDO')) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE d.status = 'GANHO')::numeric / COUNT(*) FILTER (WHERE d.status IN ('GANHO','PERDIDO')) * 100, 1)
    ELSE 0 END AS win_rate,
  CASE WHEN COUNT(*) FILTER (WHERE d.status = 'GANHO') > 0
    THEN ROUND(SUM(d.valor) FILTER (WHERE d.status = 'GANHO')::numeric / COUNT(*) FILTER (WHERE d.status = 'GANHO'), 0)
    ELSE 0 END AS ticket_medio
FROM public.deals d
JOIN public.contacts c ON c.id = d.contact_id
WHERE d.created_at >= now() - interval '12 months'
GROUP BY to_char(d.created_at, 'YYYY-MM'), c.empresa, d.pipeline_id
ORDER BY mes DESC;

-- 9. analytics_ltv_cohort
CREATE OR REPLACE VIEW public.analytics_ltv_cohort AS
SELECT
  to_char(d.created_at, 'YYYY-MM') AS cohort_mes,
  c.empresa::text AS empresa,
  COUNT(*) AS total_deals,
  COUNT(*) FILTER (WHERE d.status = 'GANHO') AS deals_ganhos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'GANHO'), 0) AS valor_total,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'GANHO'), 0)::numeric / COUNT(*), 0)
    ELSE 0 END AS ltv_medio,
  CASE WHEN COUNT(*) FILTER (WHERE d.status IN ('GANHO','PERDIDO')) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE d.status = 'GANHO')::numeric / COUNT(*) FILTER (WHERE d.status IN ('GANHO','PERDIDO')) * 100, 1)
    ELSE 0 END AS win_rate
FROM public.deals d
JOIN public.contacts c ON c.id = d.contact_id
GROUP BY to_char(d.created_at, 'YYYY-MM'), c.empresa
ORDER BY cohort_mes DESC;
