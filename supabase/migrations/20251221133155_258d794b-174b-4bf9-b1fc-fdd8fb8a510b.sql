-- Adicionar coluna justificativa JSONB para explicabilidade da classificação
ALTER TABLE public.lead_classifications 
ADD COLUMN IF NOT EXISTS justificativa JSONB DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.lead_classifications.justificativa IS 'Estrutura JSON com razões detalhadas da classificação: icp_razao, temperatura_razao, prioridade_razao, score_breakdown, dados_utilizados';