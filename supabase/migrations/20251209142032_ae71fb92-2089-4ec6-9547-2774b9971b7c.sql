-- PATCH 5G-B: Evolução do Motor SDR IA
-- Fase 1: Database Migration

-- 1.1 Adicionar novos valores ao enum lead_intent_tipo
ALTER TYPE lead_intent_tipo ADD VALUE IF NOT EXISTS 'INTERESSE_IR';
ALTER TYPE lead_intent_tipo ADD VALUE IF NOT EXISTS 'OBJECAO_PRECO';
ALTER TYPE lead_intent_tipo ADD VALUE IF NOT EXISTS 'OBJECAO_RISCO';
ALTER TYPE lead_intent_tipo ADD VALUE IF NOT EXISTS 'SEM_INTERESSE';
ALTER TYPE lead_intent_tipo ADD VALUE IF NOT EXISTS 'DUVIDA_TECNICA';

-- 1.2 Adicionar novo valor ao enum sdr_acao_tipo
ALTER TYPE sdr_acao_tipo ADD VALUE IF NOT EXISTS 'ENVIAR_RESPOSTA_AUTOMATICA';

-- 1.3 Adicionar colunas para resposta automática na tabela lead_message_intents
ALTER TABLE lead_message_intents 
ADD COLUMN IF NOT EXISTS resposta_automatica_texto TEXT NULL,
ADD COLUMN IF NOT EXISTS resposta_enviada_em TIMESTAMPTZ NULL;