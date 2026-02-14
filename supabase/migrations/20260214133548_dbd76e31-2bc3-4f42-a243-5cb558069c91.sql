ALTER TABLE public.profiles
  ADD COLUMN is_vendedor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_vendedor
  IS 'Flag que indica se o usuario e vendedor ativo (aparece em metas, comissoes e rankings)';