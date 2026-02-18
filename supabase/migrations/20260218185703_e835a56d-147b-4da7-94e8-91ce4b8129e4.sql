-- Add enrichment columns to lead_contacts for SGT data
ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS score_mautic integer,
  ADD COLUMN IF NOT EXISTS mautic_page_hits integer,
  ADD COLUMN IF NOT EXISTS mautic_tags text[],
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS sgt_dados_extras jsonb;

-- Add linkedin_senioridade to contacts if missing
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linkedin_senioridade text;

COMMENT ON COLUMN public.lead_contacts.score_mautic IS 'Mautic engagement score from SGT';
COMMENT ON COLUMN public.lead_contacts.mautic_page_hits IS 'Mautic page hits from SGT';
COMMENT ON COLUMN public.lead_contacts.mautic_tags IS 'Mautic tags from SGT';
COMMENT ON COLUMN public.lead_contacts.sgt_dados_extras IS 'Extra SGT data (GA4, Stape, Blue IRPF, Tokeniza details)';
COMMENT ON COLUMN public.lead_contacts.utm_source IS 'UTM source from SGT';
COMMENT ON COLUMN public.lead_contacts.utm_medium IS 'UTM medium from SGT';
COMMENT ON COLUMN public.lead_contacts.utm_campaign IS 'UTM campaign from SGT';