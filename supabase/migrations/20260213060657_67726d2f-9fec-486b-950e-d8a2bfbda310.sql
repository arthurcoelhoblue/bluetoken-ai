
-- Fix SECURITY DEFINER on views (use INVOKER instead)
ALTER VIEW public.contacts_with_stats SET (security_invoker = on);
ALTER VIEW public.organizations_with_stats SET (security_invoker = on);
