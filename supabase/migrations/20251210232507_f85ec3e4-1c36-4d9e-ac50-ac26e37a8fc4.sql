-- ============================================
-- PATCH 6 - SDR Conversacional Inteligente
-- Fase 1: Estrutura de Dados
-- ============================================

-- ENUMs para relacionamento e estado de conversa
CREATE TYPE pessoa_relacao_tipo AS ENUM (
  'CLIENTE_IR',
  'LEAD_IR', 
  'INVESTIDOR',
  'LEAD_INVESTIDOR',
  'DESCONHECIDO'
);

CREATE TYPE estado_funil_tipo AS ENUM (
  'SAUDACAO',
  'DIAGNOSTICO',
  'QUALIFICACAO',
  'OBJECOES',
  'FECHAMENTO',
  'POS_VENDA'
);

CREATE TYPE framework_tipo AS ENUM (
  'GPCT',
  'BANT',
  'SPIN',
  'NONE'
);

-- ============================================
-- TABELA: pessoas (entidade global)
-- Unifica a mesma pessoa entre Blue e Tokeniza
-- ============================================
CREATE TABLE pessoas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT NOT NULL,
  telefone_e164    TEXT NULL,           -- +5561998317422 (formato completo)
  telefone_base    TEXT NULL,           -- 98317422 (últimos 8 dígitos, SEM o 9º)
  ddd              TEXT NULL,           -- 61
  email_principal  TEXT NULL,
  idioma_preferido TEXT NOT NULL DEFAULT 'PT',
  perfil_disc      TEXT NULL CHECK (perfil_disc IN ('D', 'I', 'S', 'C')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice único no telefone_base + ddd para matching flexível (ignora 9º dígito)
-- Permite que +556198317422 e +5561998317422 sejam reconhecidos como mesma pessoa
CREATE UNIQUE INDEX idx_pessoas_telefone_base 
  ON pessoas(telefone_base, ddd) 
  WHERE telefone_base IS NOT NULL AND ddd IS NOT NULL;

-- Índice único no email (para matching secundário)
CREATE UNIQUE INDEX idx_pessoas_email 
  ON pessoas(email_principal) 
  WHERE email_principal IS NOT NULL;

-- Índice no nome para buscas
CREATE INDEX idx_pessoas_nome ON pessoas(nome);

-- ============================================
-- TABELA: lead_conversation_state
-- Estado da conversa por lead/empresa/canal
-- ============================================
CREATE TABLE lead_conversation_state (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             TEXT NOT NULL,
  empresa             empresa_tipo NOT NULL,
  canal               canal_tipo NOT NULL DEFAULT 'WHATSAPP',
  estado_funil        estado_funil_tipo NOT NULL DEFAULT 'SAUDACAO',
  framework_ativo     framework_tipo NOT NULL DEFAULT 'NONE',
  framework_data      JSONB DEFAULT '{}',
  perfil_disc         TEXT NULL CHECK (perfil_disc IN ('D', 'I', 'S', 'C')),
  idioma_preferido    TEXT NOT NULL DEFAULT 'PT',
  ultima_pergunta_id  TEXT NULL,
  ultimo_contato_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(lead_id, empresa, canal)
);

-- Índices para consultas frequentes
CREATE INDEX idx_lcs_lead_empresa ON lead_conversation_state(lead_id, empresa);
CREATE INDEX idx_lcs_ultimo_contato ON lead_conversation_state(ultimo_contato_em DESC);

-- ============================================
-- FK em lead_contacts para pessoa global
-- ============================================
ALTER TABLE lead_contacts
  ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES pessoas(id);

CREATE INDEX idx_lead_contacts_pessoa ON lead_contacts(pessoa_id) WHERE pessoa_id IS NOT NULL;

-- ============================================
-- Trigger para updated_at
-- ============================================
CREATE TRIGGER update_pessoas_updated_at
  BEFORE UPDATE ON pessoas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_conversation_state_updated_at
  BEFORE UPDATE ON lead_conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_conversation_state ENABLE ROW LEVEL SECURITY;

-- pessoas: Service pode tudo, Admins podem ver
CREATE POLICY "Service pode gerenciar pessoas"
  ON pessoas FOR ALL USING (true);
  
CREATE POLICY "Admins podem ver pessoas"
  ON pessoas FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "SDR_IA pode ver pessoas"
  ON pessoas FOR SELECT USING (has_role(auth.uid(), 'SDR_IA'::user_role));

-- lead_conversation_state: Service pode tudo, Admins e SDR_IA podem gerenciar
CREATE POLICY "Service pode gerenciar conversation_state"
  ON lead_conversation_state FOR ALL USING (true);
  
CREATE POLICY "Admins podem ver conversation_state"
  ON lead_conversation_state FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "SDR_IA pode gerenciar conversation_state"
  ON lead_conversation_state FOR ALL USING (has_role(auth.uid(), 'SDR_IA'::user_role));