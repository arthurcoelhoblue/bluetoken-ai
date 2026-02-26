-- =============================================
-- Phase 2: Meta Cloud Template Sending + 24h Window
-- =============================================

-- 1. Add last_inbound_at to lead_conversation_state for 24h window tracking
ALTER TABLE public.lead_conversation_state
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

-- Index for 24h window queries
CREATE INDEX IF NOT EXISTS idx_lcs_last_inbound ON lead_conversation_state(last_inbound_at DESC);

-- 2. Add template_id to mass_action_jobs for template-based mass sending
ALTER TABLE public.mass_action_jobs
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id),
  ADD COLUMN IF NOT EXISTS template_variables JSONB DEFAULT '{}';

-- 3. Comment for documentation
COMMENT ON COLUMN lead_conversation_state.last_inbound_at IS 'Timestamp of last inbound message from lead, used for Meta 24h window validation';
COMMENT ON COLUMN mass_action_jobs.template_id IS 'Reference to Meta-approved template for template-based mass actions';
COMMENT ON COLUMN mass_action_jobs.template_variables IS 'Variable mappings for template placeholders';