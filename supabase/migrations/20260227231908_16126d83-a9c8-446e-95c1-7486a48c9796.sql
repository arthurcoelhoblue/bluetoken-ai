
-- Add approval columns to mass_action_jobs
ALTER TABLE public.mass_action_jobs
  ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Index for pending approval queries
CREATE INDEX IF NOT EXISTS idx_mass_action_jobs_approval_status 
  ON public.mass_action_jobs (status, started_by) 
  WHERE status = 'AGUARDANDO_APROVACAO';
