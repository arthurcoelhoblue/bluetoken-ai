
CREATE OR REPLACE FUNCTION public.prevent_non_admin_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se is_active nao mudou, permitir
  IF OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Verificar se o caller e ADMIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores podem ativar/inativar usuarios';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_non_admin_deactivation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_deactivation();
