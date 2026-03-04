
-- Update has_role to also check access profiles.
-- If a user has an access_profile assignment, they are granted the equivalent of ADMIN/CLOSER
-- for RLS purposes. Fine-grained screen access is controlled at the UI layer.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR EXISTS (
    SELECT 1 FROM public.user_access_assignments
    WHERE user_id = _user_id
  )
$$;
