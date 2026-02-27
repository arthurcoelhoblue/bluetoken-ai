
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_contact_id ON public.lead_messages(contact_id);
