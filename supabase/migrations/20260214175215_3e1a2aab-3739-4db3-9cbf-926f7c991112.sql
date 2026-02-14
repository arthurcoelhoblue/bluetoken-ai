
-- =============================================
-- BLOCO 3: Realtime para deals
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;

-- =============================================
-- BLOCO 4: Campo tipo na tabela pipelines
-- =============================================
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'COMERCIAL';

-- Atualizar pipelines existentes com nome contendo "renovacao" ou "churn"
UPDATE public.pipelines
SET tipo = 'RENOVACAO'
WHERE lower(translate(nome, 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC')) ILIKE '%renovacao%'
   OR lower(nome) ILIKE '%churn%';

-- =============================================
-- BLOCO 6: Campo sentimento em lead_message_intents
-- =============================================
ALTER TABLE public.lead_message_intents ADD COLUMN IF NOT EXISTS sentimento TEXT DEFAULT NULL;

COMMENT ON COLUMN public.lead_message_intents.sentimento IS 'Análise de sentimento: POSITIVO, NEUTRO, NEGATIVO';
