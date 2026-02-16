
-- =====================================================
-- Etapa 1C: RLS Batch 3 — config/logs tables
-- =====================================================

-- ==================
-- 1. analytics_events — adicionar filtro empresa no SELECT admin
-- ==================
DROP POLICY IF EXISTS "Admins can view analytics events" ON public.analytics_events;
CREATE POLICY "Admins can view analytics events"
  ON public.analytics_events FOR SELECT
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- INSERT já filtra por user_id, mas adicionar filtro empresa
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.analytics_events;
CREATE POLICY "Authenticated users can insert events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- ==================
-- 2. ai_usage_log — adicionar filtro empresa no SELECT
-- ==================
DROP POLICY IF EXISTS "Admins can read ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Admins can read ai_usage_log"
  ON public.ai_usage_log FOR SELECT
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- ==================
-- 3. rate_limit_log — adicionar filtro empresa no SELECT
-- ==================
DROP POLICY IF EXISTS "Admins can view rate limits" ON public.rate_limit_log;
CREATE POLICY "Admins can view rate limits"
  ON public.rate_limit_log FOR SELECT
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- ==================
-- 4. revenue_forecast_log — INSERT com filtro empresa
-- ==================
DROP POLICY IF EXISTS "Admins can insert forecasts" ON public.revenue_forecast_log;
CREATE POLICY "Admins can insert forecasts"
  ON public.revenue_forecast_log FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- ==================
-- 5. deal_loss_categories — remover policy SELECT duplicada
-- ==================
DROP POLICY IF EXISTS "Everyone can read loss categories" ON public.deal_loss_categories;

-- ==================
-- 6. sgt_event_logs — remover INSERT duplicado
-- ==================
DROP POLICY IF EXISTS "Service can insert event logs" ON public.sgt_event_logs;
