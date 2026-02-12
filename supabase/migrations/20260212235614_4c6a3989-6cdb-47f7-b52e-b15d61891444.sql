
-- Add origin/closing stage tracking and status to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS stage_origem_id UUID REFERENCES public.pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS stage_fechamento_id UUID REFERENCES public.pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ABERTO';

-- Add minimum time per stage
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS tempo_minimo_minutos INTEGER;

-- Backfill stage_origem_id for existing deals from deal_stage_history
UPDATE public.deals d
SET stage_origem_id = (
  SELECT to_stage_id FROM public.deal_stage_history h
  WHERE h.deal_id = d.id AND h.from_stage_id IS NULL
  ORDER BY h.created_at ASC LIMIT 1
)
WHERE d.stage_origem_id IS NULL;

-- For deals without history, set origin to current stage
UPDATE public.deals
SET stage_origem_id = stage_id
WHERE stage_origem_id IS NULL;

-- Backfill status for deals in won/lost stages
UPDATE public.deals d
SET status = 'GANHO',
    stage_fechamento_id = d.stage_id,
    data_ganho = COALESCE(d.data_ganho, d.updated_at),
    fechado_em = COALESCE(d.fechado_em, d.updated_at)
FROM public.pipeline_stages ps
WHERE ps.id = d.stage_id AND ps.is_won = true AND d.status = 'ABERTO';

UPDATE public.deals d
SET status = 'PERDIDO',
    stage_fechamento_id = d.stage_id,
    data_perda = COALESCE(d.data_perda, d.updated_at),
    fechado_em = COALESCE(d.fechado_em, d.updated_at)
FROM public.pipeline_stages ps
WHERE ps.id = d.stage_id AND ps.is_lost = true AND d.status = 'ABERTO';
