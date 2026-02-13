
-- ========================================
-- PATCH: Score Duplo + LinkedIn + Mautic/Chatwoot extras
-- ========================================

-- 1. Novas colunas em lead_contacts: score_marketing, prioridade_marketing, LinkedIn, Mautic extras, Chatwoot extras
ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS score_marketing integer,
  ADD COLUMN IF NOT EXISTS prioridade_marketing text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS linkedin_cargo text,
  ADD COLUMN IF NOT EXISTS linkedin_empresa text,
  ADD COLUMN IF NOT EXISTS linkedin_setor text,
  ADD COLUMN IF NOT EXISTS linkedin_senioridade text,
  ADD COLUMN IF NOT EXISTS linkedin_conexoes integer,
  ADD COLUMN IF NOT EXISTS mautic_first_visit timestamptz,
  ADD COLUMN IF NOT EXISTS mautic_cidade text,
  ADD COLUMN IF NOT EXISTS mautic_estado text,
  ADD COLUMN IF NOT EXISTS chatwoot_conversas_total integer,
  ADD COLUMN IF NOT EXISTS chatwoot_tempo_resposta_medio integer,
  ADD COLUMN IF NOT EXISTS chatwoot_agente_atual text,
  ADD COLUMN IF NOT EXISTS chatwoot_inbox text,
  ADD COLUMN IF NOT EXISTS chatwoot_status_atendimento text;

-- 2. Coluna score_composto em lead_classifications
ALTER TABLE public.lead_classifications
  ADD COLUMN IF NOT EXISTS score_composto integer;

-- 3. Comentários para documentação
COMMENT ON COLUMN public.lead_contacts.score_marketing IS 'Score de marketing vindo do SGT (0-200)';
COMMENT ON COLUMN public.lead_contacts.prioridade_marketing IS 'Prioridade de marketing do SGT: URGENTE, QUENTE, MORNO, FRIO';
COMMENT ON COLUMN public.lead_classifications.score_composto IS 'Score composto: (score_interno * 0.6) + (min(score_marketing, 100) * 0.4)';
