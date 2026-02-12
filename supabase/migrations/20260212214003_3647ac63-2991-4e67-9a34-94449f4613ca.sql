
-- Insert Super Admin profile with ALL permissions
INSERT INTO public.access_profiles (nome, descricao, is_system, permissions)
VALUES (
  'Super Admin',
  'Acesso total e irrestrito ao sistema. Não pode ser editado ou atribuído manualmente.',
  true,
  jsonb_build_object(
    'dashboard', jsonb_build_object('view', true, 'edit', true),
    'pipeline', jsonb_build_object('view', true, 'edit', true),
    'contatos', jsonb_build_object('view', true, 'edit', true),
    'conversas', jsonb_build_object('view', true, 'edit', true),
    'metas', jsonb_build_object('view', true, 'edit', true),
    'renovacao', jsonb_build_object('view', true, 'edit', true),
    'cockpit', jsonb_build_object('view', true, 'edit', true),
    'amelia', jsonb_build_object('view', true, 'edit', true),
    'cadencias', jsonb_build_object('view', true, 'edit', true),
    'leads_cadencia', jsonb_build_object('view', true, 'edit', true),
    'proximas_acoes', jsonb_build_object('view', true, 'edit', true),
    'templates', jsonb_build_object('view', true, 'edit', true),
    'knowledge_base', jsonb_build_object('view', true, 'edit', true),
    'integracoes', jsonb_build_object('view', true, 'edit', true),
    'benchmark_ia', jsonb_build_object('view', true, 'edit', true),
    'monitor_sgt', jsonb_build_object('view', true, 'edit', true),
    'leads_quentes', jsonb_build_object('view', true, 'edit', true),
    'configuracoes', jsonb_build_object('view', true, 'edit', true)
  )
);

-- Assign Super Admin to Arthur Coelho
INSERT INTO public.user_access_assignments (user_id, access_profile_id, empresa)
SELECT '3eb15a6a-9856-4e21-a856-b87eeff933b1', id, null
FROM public.access_profiles WHERE nome = 'Super Admin'
ON CONFLICT (user_id) DO UPDATE SET
  access_profile_id = EXCLUDED.access_profile_id,
  empresa = null,
  updated_at = now();

-- Assign Super Admin to Filipe Chagas
INSERT INTO public.user_access_assignments (user_id, access_profile_id, empresa)
SELECT 'e93b132b-e104-4c37-ae73-2501cf4cc19e', id, null
FROM public.access_profiles WHERE nome = 'Super Admin'
ON CONFLICT (user_id) DO UPDATE SET
  access_profile_id = EXCLUDED.access_profile_id,
  empresa = null,
  updated_at = now();
