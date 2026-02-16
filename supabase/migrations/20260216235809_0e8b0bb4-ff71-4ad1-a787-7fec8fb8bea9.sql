
-- ========================================
-- Fase 4: Triggers de Validação Cross-Tenant
-- Defesa em profundidade para deals e deal_activities
-- ========================================

-- Trigger 1: validate_deal_pipeline_tenant
-- Garante que pipeline_id pertence à mesma empresa do contact_id
CREATE OR REPLACE FUNCTION public.validate_deal_pipeline_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_empresa TEXT;
  v_pipeline_empresa TEXT;
BEGIN
  -- Resolve empresa do contact
  IF NEW.contact_id IS NOT NULL THEN
    SELECT empresa INTO v_contact_empresa
    FROM public.contacts
    WHERE id = NEW.contact_id;
  END IF;

  -- Resolve empresa do pipeline
  IF NEW.pipeline_id IS NOT NULL THEN
    SELECT empresa INTO v_pipeline_empresa
    FROM public.pipelines
    WHERE id = NEW.pipeline_id;
  END IF;

  -- Se ambos existem e divergem, bloqueia
  IF v_contact_empresa IS NOT NULL
     AND v_pipeline_empresa IS NOT NULL
     AND v_contact_empresa <> v_pipeline_empresa THEN
    RAISE EXCEPTION 'Cross-tenant violation: contact empresa=% but pipeline empresa=%',
      v_contact_empresa, v_pipeline_empresa;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_deal_pipeline_tenant ON public.deals;
CREATE TRIGGER trg_validate_deal_pipeline_tenant
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_deal_pipeline_tenant();

-- Trigger 2: validate_activity_tenant
-- Garante que deal_activity pertence ao mesmo tenant do deal
CREATE OR REPLACE FUNCTION public.validate_activity_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_deal_pipeline_empresa TEXT;
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    SELECT p.empresa INTO v_deal_pipeline_empresa
    FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = NEW.deal_id;

    IF v_deal_pipeline_empresa IS NULL THEN
      RAISE EXCEPTION 'Activity references non-existent deal or deal without pipeline: deal_id=%', NEW.deal_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_activity_tenant ON public.deal_activities;
CREATE TRIGGER trg_validate_activity_tenant
  BEFORE INSERT ON public.deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_activity_tenant();
