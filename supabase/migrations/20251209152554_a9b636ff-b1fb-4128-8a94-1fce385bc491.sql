-- ========================================
-- PATCH 5G-C - Fase 1: Campos Opt-Out
-- ========================================

-- Adicionar campos de opt-out na tabela lead_contacts
ALTER TABLE public.lead_contacts
ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS opt_out_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opt_out_motivo TEXT;

-- Comentários descritivos
COMMENT ON COLUMN public.lead_contacts.opt_out IS 'Indica se o lead solicitou não receber mais mensagens';
COMMENT ON COLUMN public.lead_contacts.opt_out_em IS 'Data/hora em que o opt-out foi registrado';
COMMENT ON COLUMN public.lead_contacts.opt_out_motivo IS 'Motivo do opt-out (ex: mensagem do lead)';

-- Índice para consultas rápidas de leads ativos
CREATE INDEX IF NOT EXISTS idx_lead_contacts_opt_out 
ON public.lead_contacts(opt_out) 
WHERE opt_out = FALSE;