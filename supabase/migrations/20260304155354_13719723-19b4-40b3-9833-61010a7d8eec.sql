-- Trigger function: auto-insert CLOSER when user gets access assignment
CREATE OR REPLACE FUNCTION public.fn_ensure_legacy_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'CLOSER')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_ensure_legacy_role
AFTER INSERT ON user_access_assignments
FOR EACH ROW EXECUTE FUNCTION fn_ensure_legacy_role();

-- Backfill: ensure ALL existing assigned users have at least one role
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT uaa.user_id, 'CLOSER'::user_role
FROM user_access_assignments uaa
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = uaa.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;