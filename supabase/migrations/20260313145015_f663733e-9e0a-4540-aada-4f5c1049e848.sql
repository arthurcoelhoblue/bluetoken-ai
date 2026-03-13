ALTER TABLE public.mautic_company_config ADD COLUMN segment_ids JSONB DEFAULT '{}';

UPDATE public.mautic_company_config 
SET segment_ids = jsonb_build_object('default', segment_id)
WHERE segment_id IS NOT NULL AND segment_id != '';

ALTER TABLE public.mautic_company_config DROP COLUMN segment_id;