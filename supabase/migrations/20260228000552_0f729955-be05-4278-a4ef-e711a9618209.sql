-- =============================================
-- PATCH: Evolução Amélia — summary, lead_facts, usa_llm
-- =============================================

-- 1. Sumarização progressiva: coluna summary na lead_conversation_state
ALTER TABLE public.lead_conversation_state
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2. Memória semântica: coluna lead_facts na lead_conversation_state  
ALTER TABLE public.lead_conversation_state
  ADD COLUMN IF NOT EXISTS lead_facts JSONB DEFAULT '{}';

-- 3. Follow-ups DISC: coluna usa_llm na message_templates
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS usa_llm BOOLEAN DEFAULT false;

-- 4. View de resolução autônoma para dashboard
CREATE OR REPLACE VIEW public.amelia_resolution_stats AS
SELECT 
  date_trunc('day', lmi.created_at) AS dia,
  lmi.empresa,
  COUNT(DISTINCT lmi.lead_id) AS total_conversas,
  COUNT(DISTINCT lmi.lead_id) FILTER (
    WHERE lmi.acao_recomendada IN ('ESCALAR_HUMANO', 'CRIAR_TAREFA_CLOSER')
  ) AS escaladas,
  COUNT(DISTINCT lmi.lead_id) FILTER (
    WHERE lmi.acao_recomendada NOT IN ('ESCALAR_HUMANO', 'CRIAR_TAREFA_CLOSER')
  ) AS resolvidas_autonomamente,
  ROUND(
    100.0 * COUNT(DISTINCT lmi.lead_id) FILTER (
      WHERE lmi.acao_recomendada NOT IN ('ESCALAR_HUMANO', 'CRIAR_TAREFA_CLOSER')
    ) / NULLIF(COUNT(DISTINCT lmi.lead_id), 0),
    1
  ) AS taxa_resolucao_pct
FROM public.lead_message_intents lmi
WHERE lmi.created_at >= NOW() - INTERVAL '90 days'
GROUP BY dia, lmi.empresa
ORDER BY dia DESC;