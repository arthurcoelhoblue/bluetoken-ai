
-- =============================================
-- PART 1: RLS - Vendedores só veem seus deals
-- =============================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users view deals by empresa" ON deals;

-- New SELECT policy: vendedores only see their own deals
CREATE POLICY "Users view deals by empresa and owner"
ON deals FOR SELECT TO authenticated
USING (
  -- ADMINs see everything
  has_role(auth.uid(), 'ADMIN'::user_role)
  OR (
    -- Vendedores: only their own deals
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_vendedor = true)
    AND owner_id = auth.uid()
  )
  OR (
    -- Non-vendedores: see by empresa (via pipeline)
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_vendedor = true)
    AND EXISTS (
      SELECT 1 FROM pipelines pip
      WHERE pip.id = deals.pipeline_id
      AND pip.empresa::text = COALESCE(get_user_empresa(auth.uid()), pip.empresa::text)
    )
  )
);

-- =============================================
-- PART 2: permissions_override column
-- =============================================

ALTER TABLE user_access_assignments
ADD COLUMN IF NOT EXISTS permissions_override JSONB DEFAULT NULL;

-- =============================================
-- PART 3: Trigger - Deal must have owner on INSERT
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_deal_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Deal deve ter um vendedor (owner_id) atribuído';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_owner_required
BEFORE INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION public.validate_deal_owner();
