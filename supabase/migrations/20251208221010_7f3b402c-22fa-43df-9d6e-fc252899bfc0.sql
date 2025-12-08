-- Add external ID columns to lead_contacts for PATCH 3.4
ALTER TABLE public.lead_contacts 
ADD COLUMN IF NOT EXISTS pipedrive_person_id text,
ADD COLUMN IF NOT EXISTS pipedrive_deal_id text,
ADD COLUMN IF NOT EXISTS tokeniza_investor_id text,
ADD COLUMN IF NOT EXISTS blue_client_id text;

-- Add indexes for external IDs
CREATE INDEX IF NOT EXISTS idx_lead_contacts_pipedrive_person ON public.lead_contacts(pipedrive_person_id) WHERE pipedrive_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_contacts_pipedrive_deal ON public.lead_contacts(pipedrive_deal_id) WHERE pipedrive_deal_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.lead_contacts.pipedrive_person_id IS 'ID do contato no Pipedrive';
COMMENT ON COLUMN public.lead_contacts.pipedrive_deal_id IS 'ID do deal no Pipedrive';
COMMENT ON COLUMN public.lead_contacts.tokeniza_investor_id IS 'ID do investidor na plataforma Tokeniza';
COMMENT ON COLUMN public.lead_contacts.blue_client_id IS 'ID do cliente na plataforma Blue';