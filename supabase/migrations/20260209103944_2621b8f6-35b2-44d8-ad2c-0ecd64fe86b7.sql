
CREATE TABLE public.integration_company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa public.empresa_tipo NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('bluechat', 'mensageria')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (empresa, channel)
);

ALTER TABLE public.integration_company_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integration_company_config"
  ON public.integration_company_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service can read integration_company_config"
  ON public.integration_company_config
  FOR SELECT
  USING (true);

INSERT INTO public.integration_company_config (empresa, channel, enabled) VALUES
  ('BLUE', 'bluechat', true),
  ('BLUE', 'mensageria', false),
  ('TOKENIZA', 'bluechat', false),
  ('TOKENIZA', 'mensageria', true);

CREATE OR REPLACE FUNCTION public.enforce_channel_exclusivity()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.enabled = true THEN
    UPDATE public.integration_company_config
    SET enabled = false, updated_at = now()
    WHERE empresa = NEW.empresa
      AND channel != NEW.channel
      AND enabled = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_channel_exclusivity
  AFTER INSERT OR UPDATE ON public.integration_company_config
  FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_exclusivity();
