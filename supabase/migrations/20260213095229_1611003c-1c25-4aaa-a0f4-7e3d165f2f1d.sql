
-- ============================================
-- Patch 12: Views de Projeção + Tabela Mass Action
-- ============================================

-- View 1: stage_conversion_rates (SECURITY INVOKER)
CREATE OR REPLACE VIEW public.stage_conversion_rates
WITH (security_invoker = true)
AS
SELECT
  ps.id AS stage_id,
  ps.nome AS stage_nome,
  ps.pipeline_id,
  p.nome AS pipeline_nome,
  p.empresa,
  COUNT(DISTINCT dsh.deal_id) AS total_deals,
  COUNT(DISTINCT CASE WHEN d.status = 'GANHO' THEN dsh.deal_id END) AS deals_ganhos,
  CASE
    WHEN COUNT(DISTINCT dsh.deal_id) > 0
    THEN ROUND(COUNT(DISTINCT CASE WHEN d.status = 'GANHO' THEN dsh.deal_id END)::NUMERIC / COUNT(DISTINCT dsh.deal_id) * 100, 1)
    ELSE 0
  END AS taxa_conversao
FROM pipeline_stages ps
JOIN pipelines p ON ps.pipeline_id = p.id
LEFT JOIN deal_stage_history dsh ON dsh.to_stage_id = ps.id
LEFT JOIN deals d ON dsh.deal_id = d.id
GROUP BY ps.id, ps.nome, ps.pipeline_id, p.nome, p.empresa;

-- View 2: pipeline_stage_projection (SECURITY INVOKER)
CREATE OR REPLACE VIEW public.pipeline_stage_projection
WITH (security_invoker = true)
AS
SELECT
  ps.id AS stage_id,
  ps.nome AS stage_nome,
  d.pipeline_id,
  p.nome AS pipeline_nome,
  p.empresa,
  d.owner_id,
  COUNT(d.id) AS deals_count,
  COALESCE(SUM(d.valor), 0) AS valor_total,
  COALESCE(scr.taxa_conversao, 0) AS taxa_conversao,
  ROUND(COALESCE(SUM(d.valor), 0) * COALESCE(scr.taxa_conversao, 0) / 100, 2) AS valor_projetado
FROM deals d
JOIN pipeline_stages ps ON d.stage_id = ps.id
JOIN pipelines p ON d.pipeline_id = p.id
LEFT JOIN stage_conversion_rates scr ON scr.stage_id = ps.id
WHERE d.status = 'ABERTO'
  AND ps.is_won IS NOT TRUE
  AND ps.is_lost IS NOT TRUE
GROUP BY ps.id, ps.nome, d.pipeline_id, p.nome, p.empresa, d.owner_id, scr.taxa_conversao;

-- Tabela mass_action_jobs
CREATE TABLE public.mass_action_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CADENCIA_MODELO', 'CAMPANHA_ADHOC')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATING', 'PREVIEW', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL')),
  deal_ids UUID[] NOT NULL DEFAULT '{}',
  cadence_id UUID REFERENCES public.cadences(id),
  instrucao TEXT,
  canal TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (canal IN ('WHATSAPP', 'EMAIL')),
  messages_preview JSONB DEFAULT '[]'::JSONB,
  total INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  succeeded INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  started_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mass_action_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can SELECT
CREATE POLICY "Authenticated users can view mass action jobs"
  ON public.mass_action_jobs FOR SELECT
  TO authenticated
  USING (true);

-- RLS: ADMIN/CLOSER can INSERT
CREATE POLICY "Admin and Closer can create mass action jobs"
  ON public.mass_action_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN'::public.user_role)
    OR public.has_role(auth.uid(), 'CLOSER'::public.user_role)
  );

-- RLS: ADMIN/CLOSER can UPDATE
CREATE POLICY "Admin and Closer can update mass action jobs"
  ON public.mass_action_jobs FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN'::public.user_role)
    OR public.has_role(auth.uid(), 'CLOSER'::public.user_role)
  );

-- RLS: ADMIN can DELETE
CREATE POLICY "Admin can delete mass action jobs"
  ON public.mass_action_jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.user_role));

-- Trigger updated_at
CREATE TRIGGER update_mass_action_jobs_updated_at
  BEFORE UPDATE ON public.mass_action_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
