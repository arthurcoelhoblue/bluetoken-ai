-- =============================================
-- PATCH: Handoff Interno entre Empresas (Ana ↔ Pedro)
-- =============================================

-- 1. Adicionar coluna para marcar handoff pendente
ALTER TABLE public.lead_conversation_state 
ADD COLUMN IF NOT EXISTS empresa_proxima_msg public.empresa_tipo DEFAULT NULL;

-- 2. Adicionar nova ação ao enum sdr_acao_tipo
ALTER TYPE public.sdr_acao_tipo ADD VALUE IF NOT EXISTS 'HANDOFF_EMPRESA';

-- 3. Criar índice para busca eficiente de handoffs pendentes
CREATE INDEX IF NOT EXISTS idx_conversation_state_handoff 
ON public.lead_conversation_state (empresa_proxima_msg) 
WHERE empresa_proxima_msg IS NOT NULL;

-- 4. Comentário explicativo
COMMENT ON COLUMN public.lead_conversation_state.empresa_proxima_msg IS 
'Quando preenchido, indica que a próxima mensagem do lead deve ser roteada para esta empresa (handoff interno Ana ↔ Pedro)';