-- PATCH 5H-PLUS: Lead Sanitization & Phone Normalization
-- Fase 0+1: Novas colunas, enum, tabela e sanitização de dados existentes

-- 1. Novas colunas em lead_contacts para normalização de telefone
ALTER TABLE lead_contacts
  ADD COLUMN IF NOT EXISTS telefone_e164          TEXT,
  ADD COLUMN IF NOT EXISTS ddi                    TEXT,
  ADD COLUMN IF NOT EXISTS numero_nacional        TEXT,
  ADD COLUMN IF NOT EXISTS origem_telefone        TEXT DEFAULT 'SGT',
  ADD COLUMN IF NOT EXISTS contato_internacional  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telefone_valido        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS telefone_validado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_placeholder      BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Índice para busca por telefone normalizado
CREATE INDEX IF NOT EXISTS idx_lead_contacts_telefone_e164 
  ON lead_contacts(telefone_e164);

-- 3. Nova ENUM para tipos de issues de contato
DO $$ BEGIN
  CREATE TYPE lead_contact_issue_tipo AS ENUM (
    'SEM_CANAL_CONTATO',
    'EMAIL_PLACEHOLDER',
    'EMAIL_INVALIDO',
    'TELEFONE_LIXO',
    'TELEFONE_SEM_WHATSAPP',
    'DADO_SUSPEITO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Nova tabela lead_contact_issues
CREATE TABLE IF NOT EXISTS lead_contact_issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           TEXT NOT NULL,
  empresa           empresa_tipo NOT NULL,
  issue_tipo        lead_contact_issue_tipo NOT NULL,
  severidade        TEXT NOT NULL CHECK (severidade IN ('ALTA', 'MEDIA', 'BAIXA')),
  mensagem          TEXT NOT NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido         BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_por     UUID REFERENCES profiles(id),
  resolvido_em      TIMESTAMPTZ
);

-- 5. Índices para lead_contact_issues
CREATE INDEX IF NOT EXISTS idx_lead_contact_issues_lead ON lead_contact_issues(lead_id, empresa);
CREATE INDEX IF NOT EXISTS idx_lead_contact_issues_open ON lead_contact_issues(empresa, resolvido, criado_em DESC);

-- 6. RLS para lead_contact_issues
ALTER TABLE lead_contact_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_contact_issues" ON lead_contact_issues
  FOR ALL USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view lead_contact_issues" ON lead_contact_issues
  FOR SELECT USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "Service can manage lead_contact_issues" ON lead_contact_issues
  FOR ALL USING (true);

-- 7. Fase 0: Sanitização de dados existentes
-- Normalizar telefones existentes para E.164
UPDATE lead_contacts
SET 
  telefone_e164 = CASE
    -- Se já está normalizado (só dígitos com 12-13 chars)
    WHEN telefone ~ '^\d{12,13}$' THEN '+' || telefone
    -- Se começa com 55 e tem 12-13 dígitos
    WHEN REGEXP_REPLACE(telefone, '\D', '', 'g') ~ '^55\d{10,11}$' 
      THEN '+' || REGEXP_REPLACE(telefone, '\D', '', 'g')
    -- Se tem 10-11 dígitos (BR sem DDI), adiciona +55
    WHEN LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11) 
      THEN '+55' || REGEXP_REPLACE(telefone, '\D', '', 'g')
    ELSE NULL
  END,
  ddi = CASE
    WHEN REGEXP_REPLACE(telefone, '\D', '', 'g') ~ '^55\d{10,11}$' THEN '55'
    WHEN LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11) THEN '55'
    ELSE NULL
  END,
  numero_nacional = CASE
    WHEN REGEXP_REPLACE(telefone, '\D', '', 'g') ~ '^55\d{10,11}$' 
      THEN SUBSTRING(REGEXP_REPLACE(telefone, '\D', '', 'g') FROM 3)
    WHEN LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11) 
      THEN REGEXP_REPLACE(telefone, '\D', '', 'g')
    ELSE NULL
  END,
  telefone_valido = CASE
    WHEN telefone IS NOT NULL AND LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) >= 10 THEN true
    ELSE false
  END,
  telefone_validado_em = NOW()
WHERE telefone IS NOT NULL AND telefone_e164 IS NULL;

-- 8. Detectar emails placeholder nos dados existentes
UPDATE lead_contacts
SET email_placeholder = true
WHERE email IS NOT NULL AND (
  LOWER(email) LIKE 'sememail@%' OR
  LOWER(email) LIKE 'sem-email@%' OR
  LOWER(email) LIKE 'noemail@%' OR
  LOWER(email) LIKE 'sem@%' OR
  LOWER(email) LIKE 'teste@teste%' OR
  LOWER(email) LIKE 'email@email%' OR
  LOWER(email) LIKE 'x@x.%' OR
  LOWER(email) LIKE 'a@a.%' OR
  LOWER(email) LIKE '%@exemplo.%' OR
  LOWER(email) LIKE '%@example.%' OR
  LOWER(email) LIKE '%placeholder%'
);

-- 9. Criar issues para leads existentes com problemas
INSERT INTO lead_contact_issues (lead_id, empresa, issue_tipo, severidade, mensagem)
SELECT 
  lead_id, 
  empresa,
  'EMAIL_PLACEHOLDER'::lead_contact_issue_tipo,
  'MEDIA',
  'E-mail identificado como placeholder. Usar telefone como canal principal.'
FROM lead_contacts
WHERE email_placeholder = true
ON CONFLICT DO NOTHING;