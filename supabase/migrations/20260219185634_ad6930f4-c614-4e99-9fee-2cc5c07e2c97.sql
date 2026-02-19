-- 1. Adicionar coluna is_csm na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_csm BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Inserir perfil de sistema "Sucesso do Cliente" em access_profiles
INSERT INTO public.access_profiles (nome, descricao, is_system, permissions)
VALUES (
  'Sucesso do Cliente',
  'Perfil para membros do time de CS. Acesso às telas de sucesso do cliente e pendências de CS.',
  true,
  '{
    "cs_dashboard":       {"view": true,  "edit": true},
    "cs_clientes":        {"view": true,  "edit": true},
    "cs_pesquisas":       {"view": true,  "edit": true},
    "cs_incidencias":     {"view": true,  "edit": true},
    "cs_playbooks":       {"view": true,  "edit": true},
    "cs_ofertas_admin":   {"view": true,  "edit": true},
    "pendencias_gestor":  {"view": true,  "edit": true},
    "dashboard":          {"view": true,  "edit": false},
    "contatos":           {"view": true,  "edit": false}
  }'::jsonb
)
ON CONFLICT DO NOTHING;