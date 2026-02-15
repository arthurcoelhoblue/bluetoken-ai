-- Remove overly permissive "Service can read" policies from cadences and cadence_steps
-- Edge functions use service_role which bypasses RLS, so these are unnecessary

DROP POLICY IF EXISTS "Service can read cadences" ON public.cadences;
DROP POLICY IF EXISTS "Service can read cadence_steps" ON public.cadence_steps;