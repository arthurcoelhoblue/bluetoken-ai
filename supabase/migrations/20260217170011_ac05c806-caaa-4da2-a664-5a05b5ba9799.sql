
-- =====================================================
-- MULTI-EMPRESA: Schema + Function + RLS Policies
-- =====================================================

-- 1. Alterar constraint de user_access_assignments
ALTER TABLE public.user_access_assignments
  DROP CONSTRAINT user_access_assignments_user_id_key;

ALTER TABLE public.user_access_assignments
  ADD CONSTRAINT user_access_assignments_user_empresa_key
  UNIQUE (user_id, empresa);

ALTER TABLE public.user_access_assignments
  ALTER COLUMN empresa SET NOT NULL;

-- 2. Criar função get_user_empresas() que retorna array
CREATE OR REPLACE FUNCTION public.get_user_empresas(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(empresa::text), ARRAY[]::text[])
  FROM public.user_access_assignments
  WHERE user_id = _user_id
$$;

-- 3. Atualizar TODAS as RLS policies que usam get_user_empresa()
-- Substituir = get_user_empresa(...) por = ANY(get_user_empresas(...))
DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  create_cmd TEXT;
  roles_str TEXT;
  permissive_str TEXT;
BEGIN
  FOR pol IN
    SELECT
      p.schemaname, p.tablename, p.policyname,
      p.permissive, p.roles, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.qual LIKE '%get_user_empresa(%' OR p.with_check LIKE '%get_user_empresa(%')
    ORDER BY p.tablename, p.policyname
  LOOP
    new_qual := pol.qual;
    new_with_check := pol.with_check;

    -- Pattern 1: COALESCE(get_user_empresa(...), empresa) → ANY(get_user_empresas(...))
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual,
        'COALESCE(get_user_empresa(auth.uid()), empresa)',
        'ANY(get_user_empresas(auth.uid()))');
    END IF;
    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check,
        'COALESCE(get_user_empresa(auth.uid()), empresa)',
        'ANY(get_user_empresas(auth.uid()))');
    END IF;

    -- Pattern 2: IS NULL OR pattern (capture_forms) → simplified
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual,
        '(get_user_empresa(auth.uid()) IS NULL) OR (empresa = get_user_empresa(auth.uid()))',
        'empresa = ANY(get_user_empresas(auth.uid()))');
    END IF;
    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check,
        '(get_user_empresa(auth.uid()) IS NULL) OR (empresa = get_user_empresa(auth.uid()))',
        'empresa = ANY(get_user_empresas(auth.uid()))');
    END IF;

    -- Pattern 3: Profiles cross-user comparison
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual,
        '(get_user_empresa(auth.uid()) IS NULL) OR (get_user_empresa(id) IS NULL) OR (get_user_empresa(auth.uid()) = get_user_empresa(id))',
        '(get_user_empresas(auth.uid()) = ARRAY[]::text[]) OR (get_user_empresas(id) = ARRAY[]::text[]) OR (get_user_empresas(auth.uid()) && get_user_empresas(id))');
    END IF;

    -- Pattern 4: Simple replacement for all remaining occurrences
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'get_user_empresa(auth.uid())', 'ANY(get_user_empresas(auth.uid()))');
    END IF;
    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check, 'get_user_empresa(auth.uid())', 'ANY(get_user_empresas(auth.uid()))');
    END IF;

    -- Drop old policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    -- Build roles string
    roles_str := array_to_string(pol.roles, ', ');
    permissive_str := CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

    -- Create new policy
    create_cmd := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname, pol.schemaname, pol.tablename, permissive_str, pol.cmd, roles_str);

    IF new_qual IS NOT NULL THEN
      create_cmd := create_cmd || ' USING (' || new_qual || ')';
    END IF;
    IF new_with_check IS NOT NULL THEN
      create_cmd := create_cmd || ' WITH CHECK (' || new_with_check || ')';
    END IF;

    EXECUTE create_cmd;

    RAISE NOTICE 'Updated policy: %.% - %', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
END $$;
