-- Remove unique constraints on email and telefone to allow duplicate contacts
-- Deduplication is now handled via duplicate_pendencies table
DROP INDEX IF EXISTS idx_contacts_email_empresa_unique;
DROP INDEX IF EXISTS idx_contacts_telefone_e164_empresa_unique;

-- Keep non-unique indexes for query performance
CREATE INDEX IF NOT EXISTS idx_contacts_email_empresa ON public.contacts (lower(email), empresa) WHERE email IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_contacts_telefone_e164_empresa ON public.contacts (telefone_e164, empresa) WHERE telefone_e164 IS NOT NULL AND is_active = true;