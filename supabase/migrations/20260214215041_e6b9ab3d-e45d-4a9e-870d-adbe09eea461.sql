
-- Fix permissive INSERT policy on revenue_forecast_log
DROP POLICY IF EXISTS "Service role inserts forecasts" ON public.revenue_forecast_log;
CREATE POLICY "Admins can insert forecasts"
  ON public.revenue_forecast_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
