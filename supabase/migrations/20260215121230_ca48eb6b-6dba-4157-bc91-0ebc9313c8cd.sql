
-- Fix overly permissive policy on follow_up_optimal_hours
DROP POLICY "Service can manage optimal hours" ON public.follow_up_optimal_hours;

-- Only admins can manage (edge functions use service_role which bypasses RLS)
CREATE POLICY "Admins can manage optimal hours"
  ON public.follow_up_optimal_hours FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));
