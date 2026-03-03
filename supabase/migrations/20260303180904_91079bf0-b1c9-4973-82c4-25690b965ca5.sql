
-- Tabela api_keys para integração com sistemas externos
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa public.empresa_tipo NOT NULL,
  label text NOT NULL,
  key_hash text NOT NULL,
  key_preview text NOT NULL,
  permissions text[] NOT NULL DEFAULT ARRAY['lead:write', 'meta:read'],
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único no hash para lookup rápido
CREATE UNIQUE INDEX idx_api_keys_key_hash ON public.api_keys (key_hash);

-- Índice para busca por empresa
CREATE INDEX idx_api_keys_empresa ON public.api_keys (empresa, is_active);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas admins podem gerenciar API keys
CREATE POLICY "Admins can manage api_keys"
  ON public.api_keys
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.fn_api_keys_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_api_keys_updated_at();
