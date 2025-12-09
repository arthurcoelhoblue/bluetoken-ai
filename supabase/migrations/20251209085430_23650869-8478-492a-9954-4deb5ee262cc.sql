-- ========================================
-- PATCH 5F: Preparação para WhatsApp Inbound
-- ========================================

-- 1. Permitir lead_id nullable para mensagens de números desconhecidos
ALTER TABLE public.lead_messages ALTER COLUMN lead_id DROP NOT NULL;

-- 2. Adicionar coluna para timestamp original do inbound
ALTER TABLE public.lead_messages 
ADD COLUMN IF NOT EXISTS recebido_em timestamptz DEFAULT NULL;

-- 3. Criar índice para busca por telefone normalizado
CREATE INDEX IF NOT EXISTS idx_lead_contacts_telefone 
ON public.lead_contacts(telefone);

-- 4. Criar índice para buscar mensagens por whatsapp_message_id (evitar duplicados)
CREATE INDEX IF NOT EXISTS idx_lead_messages_whatsapp_id 
ON public.lead_messages(whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;

-- 5. Criar índice para buscar runs ativas por lead
CREATE INDEX IF NOT EXISTS idx_lead_cadence_runs_lead_status 
ON public.lead_cadence_runs(lead_id, status) 
WHERE status = 'ATIVA';

-- Comentário
COMMENT ON COLUMN public.lead_messages.recebido_em IS 'Timestamp original da mensagem inbound (do provedor)';