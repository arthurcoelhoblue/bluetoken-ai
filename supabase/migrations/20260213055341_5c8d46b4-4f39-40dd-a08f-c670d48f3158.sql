-- Adicionar campo owner_id em lead_contacts para ownership do lead
ALTER TABLE public.lead_contacts 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) NULL;

-- Índice para busca por owner
CREATE INDEX IF NOT EXISTS idx_lead_contacts_owner_id ON public.lead_contacts(owner_id);
