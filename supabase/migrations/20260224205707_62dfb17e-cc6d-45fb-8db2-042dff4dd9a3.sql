
-- Deduplicate emails: keep the most recent (by created_at), soft-delete older duplicates
WITH email_dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY lower(email), empresa 
    ORDER BY created_at DESC
  ) AS rn
  FROM contacts
  WHERE email IS NOT NULL AND is_active = true
)
UPDATE contacts SET is_active = false, updated_at = now()
WHERE id IN (SELECT id FROM email_dupes WHERE rn > 1);

-- Deduplicate telefone_e164: keep the most recent, soft-delete older duplicates
WITH phone_dupes AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY telefone_e164, empresa 
    ORDER BY created_at DESC
  ) AS rn
  FROM contacts
  WHERE telefone_e164 IS NOT NULL AND is_active = true
)
UPDATE contacts SET is_active = false, updated_at = now()
WHERE id IN (SELECT id FROM phone_dupes WHERE rn > 1);

-- Now create the unique partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_empresa_unique
  ON contacts (lower(email), empresa)
  WHERE email IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_telefone_e164_empresa_unique
  ON contacts (telefone_e164, empresa)
  WHERE telefone_e164 IS NOT NULL AND is_active = true;
