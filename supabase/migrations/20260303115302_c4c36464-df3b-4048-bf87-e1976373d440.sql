
-- Trigger: auto-transfer is_default when a connection is deactivated
CREATE OR REPLACE FUNCTION public.fn_whatsapp_conn_default_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_id UUID;
BEGIN
  -- Only fire when is_active changes to false and this was the default
  IF NEW.is_active = false AND OLD.is_active = true AND OLD.is_default = true THEN
    -- Remove default from this connection
    NEW.is_default := false;
    
    -- Find next active connection for same empresa
    SELECT id INTO v_next_id
    FROM whatsapp_connections
    WHERE empresa = NEW.empresa
      AND id != NEW.id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Transfer default
    IF v_next_id IS NOT NULL THEN
      UPDATE whatsapp_connections
      SET is_default = true
      WHERE id = v_next_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_whatsapp_conn_default_transfer
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION public.fn_whatsapp_conn_default_transfer();
