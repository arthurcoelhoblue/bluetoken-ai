
-- ============================================================
-- PATCH 2: Contatos, Organizações, Campos Customizáveis, Pipelines Reais
-- ============================================================

-- Enable pg_trgm for trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.custom_field_entity_type AS ENUM ('CONTACT', 'ORGANIZATION', 'DEAL');
CREATE TYPE public.custom_field_value_type AS ENUM (
  'TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME',
  'BOOLEAN', 'SELECT', 'MULTISELECT', 'EMAIL', 'PHONE', 'URL', 'PERCENT', 'TAG'
);

-- ============================================================
-- 2. ORGANIZATIONS
-- ============================================================
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  setor TEXT,
  porte TEXT,
  website TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  pais TEXT DEFAULT 'BR',
  owner_id UUID REFERENCES public.profiles(id),
  tags TEXT[] DEFAULT '{}',
  notas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_organizations_cnpj_empresa ON public.organizations (cnpj, empresa) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_organizations_nome_trgm ON public.organizations USING gin (nome gin_trgm_ops);
CREATE INDEX idx_organizations_empresa ON public.organizations (empresa);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Admins can manage organizations"
  ON public.organizations FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));
CREATE POLICY "Closers can manage organizations"
  ON public.organizations FOR ALL USING (has_role(auth.uid(), 'CLOSER'::user_role));

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. ALTER contacts
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS primeiro_nome TEXT,
  ADD COLUMN IF NOT EXISTS sobrenome TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS telegram TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS is_cliente BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON public.contacts (organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_cliente ON public.contacts (is_cliente);
CREATE INDEX IF NOT EXISTS idx_contacts_nome_trgm ON public.contacts USING gin (nome gin_trgm_ops);

-- ============================================================
-- 4. ALTER deals
-- ============================================================
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS data_ganho TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_perda TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS score_engajamento INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_intencao INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_valor INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_urgencia INTEGER DEFAULT 0;

-- Validation trigger for scores (0-100)
CREATE OR REPLACE FUNCTION public.validate_deal_scores()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.score_engajamento IS NOT NULL AND (NEW.score_engajamento < 0 OR NEW.score_engajamento > 100) THEN
    RAISE EXCEPTION 'score_engajamento must be between 0 and 100';
  END IF;
  IF NEW.score_intencao IS NOT NULL AND (NEW.score_intencao < 0 OR NEW.score_intencao > 100) THEN
    RAISE EXCEPTION 'score_intencao must be between 0 and 100';
  END IF;
  IF NEW.score_valor IS NOT NULL AND (NEW.score_valor < 0 OR NEW.score_valor > 100) THEN
    RAISE EXCEPTION 'score_valor must be between 0 and 100';
  END IF;
  IF NEW.score_urgencia IS NOT NULL AND (NEW.score_urgencia < 0 OR NEW.score_urgencia > 100) THEN
    RAISE EXCEPTION 'score_urgencia must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_deal_scores_trigger
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.validate_deal_scores();

-- ============================================================
-- 5. CUSTOM FIELD DEFINITIONS (EAV)
-- ============================================================
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  entity_type public.custom_field_entity_type NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  value_type public.custom_field_value_type NOT NULL,
  options_json JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  grupo TEXT NOT NULL DEFAULT 'Geral',
  posicao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cfd_slug_entity_empresa ON public.custom_field_definitions (slug, entity_type, empresa);
CREATE INDEX idx_cfd_entity_type ON public.custom_field_definitions (entity_type);
CREATE INDEX idx_cfd_empresa ON public.custom_field_definitions (empresa);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom_field_definitions"
  ON public.custom_field_definitions FOR SELECT USING (true);
CREATE POLICY "Admins can manage custom_field_definitions"
  ON public.custom_field_definitions FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE TRIGGER update_cfd_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. CUSTOM FIELD VALUES
-- ============================================================
CREATE TABLE public.custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_type public.custom_field_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date TIMESTAMPTZ,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cfv_field_entity ON public.custom_field_values (field_id, entity_id);
CREATE INDEX idx_cfv_entity ON public.custom_field_values (entity_type, entity_id);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom_field_values"
  ON public.custom_field_values FOR SELECT USING (true);
CREATE POLICY "Admins can manage custom_field_values"
  ON public.custom_field_values FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));
CREATE POLICY "Closers can manage custom_field_values"
  ON public.custom_field_values FOR ALL USING (has_role(auth.uid(), 'CLOSER'::user_role));

CREATE TRIGGER update_cfv_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. SEED: 5 Real Pipelines (delete generics without deals)
-- ============================================================
DELETE FROM public.pipeline_stages WHERE pipeline_id IN (
  SELECT id FROM public.pipelines WHERE id NOT IN (SELECT DISTINCT pipeline_id FROM public.deals)
);
DELETE FROM public.pipelines WHERE id NOT IN (SELECT DISTINCT pipeline_id FROM public.deals);

-- Pipeline Comercial (BLUE, default)
WITH p AS (
  INSERT INTO public.pipelines (empresa, nome, descricao, is_default, ativo)
  VALUES ('BLUE', 'Pipeline Comercial', 'Funil comercial principal Blue', true, true)
  RETURNING id
)
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ((SELECT id FROM p), 'MQL', 1, '#8b5cf6', false, false),
  ((SELECT id FROM p), 'Levantada de mão', 2, '#6366f1', false, false),
  ((SELECT id FROM p), 'Atacar agora!', 3, '#f59e0b', false, false),
  ((SELECT id FROM p), 'Contato Iniciado', 4, '#3b82f6', false, false),
  ((SELECT id FROM p), 'Negociação', 5, '#0ea5e9', false, false),
  ((SELECT id FROM p), 'Aguardando pagamento', 6, '#f97316', false, false),
  ((SELECT id FROM p), 'Vendido', 7, '#22c55e', true, false),
  ((SELECT id FROM p), 'Perdido', 8, '#ef4444', false, true);

-- Implantação (BLUE)
WITH p AS (
  INSERT INTO public.pipelines (empresa, nome, descricao, is_default, ativo)
  VALUES ('BLUE', 'Implantação', 'Funil de implantação Blue', false, true)
  RETURNING id
)
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ((SELECT id FROM p), 'Aberto (comercial)', 1, '#8b5cf6', false, false),
  ((SELECT id FROM p), 'Implantação Iniciada', 2, '#6366f1', false, false),
  ((SELECT id FROM p), 'Atendimento Agendado', 3, '#3b82f6', false, false),
  ((SELECT id FROM p), 'Aguard. Retorno do cliente', 4, '#f59e0b', false, false),
  ((SELECT id FROM p), 'Docs recebidos Parcial', 5, '#f97316', false, false),
  ((SELECT id FROM p), 'Docs recebidos Total', 6, '#0ea5e9', false, false),
  ((SELECT id FROM p), 'Implantação Finalizada', 7, '#22c55e', true, false),
  ((SELECT id FROM p), 'Cancelado', 8, '#ef4444', false, true);

-- Novos Negócios (TOKENIZA, default)
WITH p AS (
  INSERT INTO public.pipelines (empresa, nome, descricao, is_default, ativo)
  VALUES ('TOKENIZA', 'Novos Negócios', 'Funil principal Tokeniza', true, true)
  RETURNING id
)
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ((SELECT id FROM p), 'Stand by', 1, '#94a3b8', false, false),
  ((SELECT id FROM p), 'Leads Site', 2, '#8b5cf6', false, false),
  ((SELECT id FROM p), 'Contatado', 3, '#6366f1', false, false),
  ((SELECT id FROM p), 'Fase negociação', 4, '#3b82f6', false, false),
  ((SELECT id FROM p), 'Fase contratual', 5, '#0ea5e9', false, false),
  ((SELECT id FROM p), 'Oferta em estruturação', 6, '#f59e0b', false, false),
  ((SELECT id FROM p), 'Lançada', 7, '#22c55e', true, false),
  ((SELECT id FROM p), 'Perdido', 8, '#ef4444', false, true);

-- Ofertas Públicas (TOKENIZA)
WITH p AS (
  INSERT INTO public.pipelines (empresa, nome, descricao, is_default, ativo)
  VALUES ('TOKENIZA', 'Ofertas Públicas', 'Funil de ofertas públicas Tokeniza', false, true)
  RETURNING id
)
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ((SELECT id FROM p), 'Lead', 1, '#94a3b8', false, false),
  ((SELECT id FROM p), 'Contato Iniciado', 2, '#8b5cf6', false, false),
  ((SELECT id FROM p), 'Contato estabelecido', 3, '#6366f1', false, false),
  ((SELECT id FROM p), 'Apresentação', 4, '#3b82f6', false, false),
  ((SELECT id FROM p), 'Cadastrado na Plataforma', 5, '#0ea5e9', false, false),
  ((SELECT id FROM p), 'Forecasting', 6, '#f59e0b', false, false),
  ((SELECT id FROM p), 'Carteira', 7, '#22c55e', true, false),
  ((SELECT id FROM p), 'Perdido', 8, '#ef4444', false, true);

-- Carteira Private (TOKENIZA)
WITH p AS (
  INSERT INTO public.pipelines (empresa, nome, descricao, is_default, ativo)
  VALUES ('TOKENIZA', 'Carteira Private', 'Funil de carteira private Tokeniza', false, true)
  RETURNING id
)
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ((SELECT id FROM p), 'Base de clientes', 1, '#94a3b8', false, false),
  ((SELECT id FROM p), 'Priorizados', 2, '#8b5cf6', false, false),
  ((SELECT id FROM p), 'Atendimento iniciado', 3, '#6366f1', false, false),
  ((SELECT id FROM p), 'Análise de Perfil', 4, '#3b82f6', false, false),
  ((SELECT id FROM p), 'Definir estratégia', 5, '#0ea5e9', false, false),
  ((SELECT id FROM p), 'Relacionamento recorrente', 6, '#22c55e', true, false),
  ((SELECT id FROM p), 'Perdido', 7, '#ef4444', false, true);

-- ============================================================
-- 8. SEED: ~55 Custom Fields
-- ============================================================

-- CONTACT fields
INSERT INTO public.custom_field_definitions (empresa, entity_type, slug, label, value_type, grupo, posicao, is_system) VALUES
  ('BLUE', 'CONTACT', 'cargo', 'Cargo', 'TEXT', 'Comercial', 1, true),
  ('BLUE', 'CONTACT', 'departamento', 'Departamento', 'TEXT', 'Comercial', 2, true),
  ('BLUE', 'CONTACT', 'linkedin', 'LinkedIn', 'URL', 'Perfil', 3, true),
  ('BLUE', 'CONTACT', 'data_nascimento', 'Data de nascimento', 'DATE', 'Perfil', 4, false),
  ('BLUE', 'CONTACT', 'genero', 'Gênero', 'SELECT', 'Perfil', 5, false),
  ('BLUE', 'CONTACT', 'estado_civil', 'Estado civil', 'SELECT', 'Perfil', 6, false),
  ('BLUE', 'CONTACT', 'profissao', 'Profissão', 'TEXT', 'Perfil', 7, false),
  ('BLUE', 'CONTACT', 'renda_mensal', 'Renda mensal', 'CURRENCY', 'Perfil', 8, false),
  ('BLUE', 'CONTACT', 'patrimonio_estimado', 'Patrimônio estimado', 'CURRENCY', 'Perfil', 9, false),
  ('BLUE', 'CONTACT', 'origem_lead', 'Origem do lead', 'SELECT', 'Marketing', 10, true),
  ('BLUE', 'CONTACT', 'campanha_origem', 'Campanha de origem', 'TEXT', 'Marketing', 11, false),
  ('BLUE', 'CONTACT', 'indicado_por', 'Indicado por', 'TEXT', 'Marketing', 12, false),
  ('BLUE', 'CONTACT', 'perfil_investidor', 'Perfil investidor', 'SELECT', 'Blue CS', 13, false),
  ('BLUE', 'CONTACT', 'tipo_declaracao', 'Tipo de declaração', 'SELECT', 'Blue CS', 14, false),
  ('BLUE', 'CONTACT', 'qtd_dependentes', 'Qtd dependentes', 'NUMBER', 'Blue CS', 15, false),
  ('TOKENIZA', 'CONTACT', 'cargo', 'Cargo', 'TEXT', 'Comercial', 1, true),
  ('TOKENIZA', 'CONTACT', 'departamento', 'Departamento', 'TEXT', 'Comercial', 2, true),
  ('TOKENIZA', 'CONTACT', 'linkedin', 'LinkedIn', 'URL', 'Perfil', 3, true),
  ('TOKENIZA', 'CONTACT', 'data_nascimento', 'Data de nascimento', 'DATE', 'Perfil', 4, false),
  ('TOKENIZA', 'CONTACT', 'wallet_address', 'Endereço de carteira', 'TEXT', 'Cripto', 5, false),
  ('TOKENIZA', 'CONTACT', 'exchange_preferida', 'Exchange preferida', 'SELECT', 'Cripto', 6, false),
  ('TOKENIZA', 'CONTACT', 'investidor_qualificado', 'Investidor qualificado', 'BOOLEAN', 'Tokeniza', 7, false),
  ('TOKENIZA', 'CONTACT', 'patrimonio_declarado', 'Patrimônio declarado', 'CURRENCY', 'Tokeniza', 8, false),
  ('TOKENIZA', 'CONTACT', 'ticket_medio', 'Ticket médio', 'CURRENCY', 'Tokeniza', 9, false),
  ('TOKENIZA', 'CONTACT', 'origem_lead', 'Origem do lead', 'SELECT', 'Marketing', 10, true),
  ('TOKENIZA', 'CONTACT', 'campanha_origem', 'Campanha de origem', 'TEXT', 'Marketing', 11, false);

-- ORGANIZATION fields
INSERT INTO public.custom_field_definitions (empresa, entity_type, slug, label, value_type, grupo, posicao, is_system) VALUES
  ('BLUE', 'ORGANIZATION', 'razao_social', 'Razão social', 'TEXT', 'Dados PJ', 1, true),
  ('BLUE', 'ORGANIZATION', 'inscricao_estadual', 'Inscrição estadual', 'TEXT', 'Dados PJ', 2, false),
  ('BLUE', 'ORGANIZATION', 'regime_tributario', 'Regime tributário', 'SELECT', 'Dados PJ', 3, false),
  ('BLUE', 'ORGANIZATION', 'faturamento_anual', 'Faturamento anual', 'CURRENCY', 'Dados PJ', 4, false),
  ('BLUE', 'ORGANIZATION', 'qtd_funcionarios', 'Qtd funcionários', 'NUMBER', 'Dados PJ', 5, false),
  ('BLUE', 'ORGANIZATION', 'data_fundacao', 'Data de fundação', 'DATE', 'Dados PJ', 6, false),
  ('TOKENIZA', 'ORGANIZATION', 'razao_social', 'Razão social', 'TEXT', 'Dados PJ', 1, true),
  ('TOKENIZA', 'ORGANIZATION', 'inscricao_estadual', 'Inscrição estadual', 'TEXT', 'Dados PJ', 2, false),
  ('TOKENIZA', 'ORGANIZATION', 'tipo_empresa', 'Tipo de empresa', 'SELECT', 'Dados PJ', 3, false),
  ('TOKENIZA', 'ORGANIZATION', 'segmento_atuacao', 'Segmento de atuação', 'TEXT', 'Dados PJ', 4, false),
  ('TOKENIZA', 'ORGANIZATION', 'faturamento_anual', 'Faturamento anual', 'CURRENCY', 'Dados PJ', 5, false);

-- DEAL fields
INSERT INTO public.custom_field_definitions (empresa, entity_type, slug, label, value_type, grupo, posicao, is_system) VALUES
  ('BLUE', 'DEAL', 'tipo_servico', 'Tipo de serviço', 'SELECT', 'Comercial', 1, true),
  ('BLUE', 'DEAL', 'modelo_contrato', 'Modelo de contrato', 'SELECT', 'Comercial', 2, false),
  ('BLUE', 'DEAL', 'vigencia_contrato', 'Vigência do contrato', 'DATE', 'Comercial', 3, false),
  ('BLUE', 'DEAL', 'recorrencia', 'Recorrência', 'SELECT', 'Comercial', 4, false),
  ('BLUE', 'DEAL', 'motivo_interesse', 'Motivo do interesse', 'TEXTAREA', 'Comercial', 5, false),
  ('BLUE', 'DEAL', 'concorrente', 'Concorrente', 'TEXT', 'Comercial', 6, false),
  ('BLUE', 'DEAL', 'probabilidade_fechamento', 'Probabilidade de fechamento', 'PERCENT', 'Scores', 7, false),
  ('BLUE', 'DEAL', 'nota_qualificacao', 'Nota de qualificação', 'NUMBER', 'Scores', 8, false),
  ('BLUE', 'DEAL', 'pipedrive_id', 'Pipedrive ID', 'TEXT', 'Integrações', 9, true),
  ('TOKENIZA', 'DEAL', 'tipo_ativo', 'Tipo de ativo', 'SELECT', 'Tokeniza', 1, true),
  ('TOKENIZA', 'DEAL', 'nome_oferta', 'Nome da oferta', 'TEXT', 'Tokeniza', 2, true),
  ('TOKENIZA', 'DEAL', 'valor_minimo', 'Valor mínimo', 'CURRENCY', 'Tokeniza', 3, false),
  ('TOKENIZA', 'DEAL', 'rentabilidade_alvo', 'Rentabilidade alvo', 'PERCENT', 'Tokeniza', 4, false),
  ('TOKENIZA', 'DEAL', 'prazo_meses', 'Prazo (meses)', 'NUMBER', 'Tokeniza', 5, false),
  ('TOKENIZA', 'DEAL', 'garantia', 'Garantia', 'SELECT', 'Tokeniza', 6, false),
  ('TOKENIZA', 'DEAL', 'data_lancamento', 'Data de lançamento', 'DATE', 'Tokeniza', 7, false),
  ('TOKENIZA', 'DEAL', 'probabilidade_fechamento', 'Probabilidade de fechamento', 'PERCENT', 'Scores', 8, false),
  ('TOKENIZA', 'DEAL', 'nota_qualificacao', 'Nota de qualificação', 'NUMBER', 'Scores', 9, false);
