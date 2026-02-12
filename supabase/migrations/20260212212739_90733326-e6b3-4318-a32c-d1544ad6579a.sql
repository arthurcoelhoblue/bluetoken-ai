
-- Tabela de perfis de acesso customizáveis
CREATE TABLE public.access_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Tabela de atribuição de perfil a usuário
CREATE TABLE public.user_access_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  empresa public.empresa_tipo,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS para access_profiles
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view access_profiles"
  ON public.access_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert access_profiles"
  ON public.access_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

CREATE POLICY "Admins can update access_profiles"
  ON public.access_profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

CREATE POLICY "Admins can delete access_profiles"
  ON public.access_profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

-- RLS para user_access_assignments
ALTER TABLE public.user_access_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON public.user_access_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert assignments"
  ON public.user_access_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

CREATE POLICY "Admins can update assignments"
  ON public.user_access_assignments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

CREATE POLICY "Admins can delete assignments"
  ON public.user_access_assignments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

-- Trigger para updated_at
CREATE TRIGGER update_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_access_assignments_updated_at
  BEFORE UPDATE ON public.user_access_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: perfis do sistema
INSERT INTO public.access_profiles (nome, descricao, is_system, permissions) VALUES
(
  'Administrador',
  'Acesso total ao sistema',
  true,
  '{"dashboard":{"view":true,"edit":true},"pipeline":{"view":true,"edit":true},"contatos":{"view":true,"edit":true},"conversas":{"view":true,"edit":true},"metas":{"view":true,"edit":true},"renovacao":{"view":true,"edit":true},"cockpit":{"view":true,"edit":true},"amelia":{"view":true,"edit":true},"cadencias":{"view":true,"edit":true},"leads_cadencia":{"view":true,"edit":true},"proximas_acoes":{"view":true,"edit":true},"templates":{"view":true,"edit":true},"knowledge_base":{"view":true,"edit":true},"integracoes":{"view":true,"edit":true},"benchmark_ia":{"view":true,"edit":true},"monitor_sgt":{"view":true,"edit":true},"leads_quentes":{"view":true,"edit":true},"configuracoes":{"view":true,"edit":true}}'::jsonb
),
(
  'Closer',
  'Acesso comercial e atendimento',
  true,
  '{"dashboard":{"view":true,"edit":true},"pipeline":{"view":true,"edit":true},"contatos":{"view":true,"edit":true},"conversas":{"view":true,"edit":true},"metas":{"view":true,"edit":false},"renovacao":{"view":true,"edit":false},"cockpit":{"view":true,"edit":false},"amelia":{"view":false,"edit":false},"cadencias":{"view":false,"edit":false},"leads_cadencia":{"view":true,"edit":false},"proximas_acoes":{"view":true,"edit":true},"templates":{"view":false,"edit":false},"knowledge_base":{"view":false,"edit":false},"integracoes":{"view":false,"edit":false},"benchmark_ia":{"view":false,"edit":false},"monitor_sgt":{"view":false,"edit":false},"leads_quentes":{"view":true,"edit":false},"configuracoes":{"view":false,"edit":false}}'::jsonb
),
(
  'Marketing',
  'Acesso a campanhas e analytics',
  true,
  '{"dashboard":{"view":true,"edit":true},"pipeline":{"view":true,"edit":false},"contatos":{"view":true,"edit":false},"conversas":{"view":false,"edit":false},"metas":{"view":false,"edit":false},"renovacao":{"view":false,"edit":false},"cockpit":{"view":false,"edit":false},"amelia":{"view":false,"edit":false},"cadencias":{"view":true,"edit":true},"leads_cadencia":{"view":true,"edit":false},"proximas_acoes":{"view":false,"edit":false},"templates":{"view":true,"edit":true},"knowledge_base":{"view":false,"edit":false},"integracoes":{"view":false,"edit":false},"benchmark_ia":{"view":false,"edit":false},"monitor_sgt":{"view":false,"edit":false},"leads_quentes":{"view":false,"edit":false},"configuracoes":{"view":false,"edit":false}}'::jsonb
),
(
  'Auditor',
  'Somente visualização em todas as telas',
  true,
  '{"dashboard":{"view":true,"edit":false},"pipeline":{"view":true,"edit":false},"contatos":{"view":true,"edit":false},"conversas":{"view":true,"edit":false},"metas":{"view":true,"edit":false},"renovacao":{"view":true,"edit":false},"cockpit":{"view":true,"edit":false},"amelia":{"view":true,"edit":false},"cadencias":{"view":true,"edit":false},"leads_cadencia":{"view":true,"edit":false},"proximas_acoes":{"view":true,"edit":false},"templates":{"view":true,"edit":false},"knowledge_base":{"view":true,"edit":false},"integracoes":{"view":true,"edit":false},"benchmark_ia":{"view":true,"edit":false},"monitor_sgt":{"view":true,"edit":false},"leads_quentes":{"view":true,"edit":false},"configuracoes":{"view":true,"edit":false}}'::jsonb
),
(
  'Somente Leitura',
  'Acesso apenas ao dashboard',
  true,
  '{"dashboard":{"view":true,"edit":false},"pipeline":{"view":false,"edit":false},"contatos":{"view":false,"edit":false},"conversas":{"view":false,"edit":false},"metas":{"view":false,"edit":false},"renovacao":{"view":false,"edit":false},"cockpit":{"view":false,"edit":false},"amelia":{"view":false,"edit":false},"cadencias":{"view":false,"edit":false},"leads_cadencia":{"view":false,"edit":false},"proximas_acoes":{"view":false,"edit":false},"templates":{"view":false,"edit":false},"knowledge_base":{"view":false,"edit":false},"integracoes":{"view":false,"edit":false},"benchmark_ia":{"view":false,"edit":false},"monitor_sgt":{"view":false,"edit":false},"leads_quentes":{"view":false,"edit":false},"configuracoes":{"view":false,"edit":false}}'::jsonb
);
