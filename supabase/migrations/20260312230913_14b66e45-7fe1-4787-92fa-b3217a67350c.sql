
-- =============================================
-- Playbook de Vendas — Fase 1: Fundação
-- =============================================

-- 1. ENUMS
CREATE TYPE public.playbook_step_tipo AS ENUM ('MENSAGEM_AUTO', 'MENSAGEM_MANUAL', 'LIGACAO', 'REUNIAO', 'TAREFA');
CREATE TYPE public.playbook_executor AS ENUM ('IA', 'HUMANO');
CREATE TYPE public.playbook_run_status AS ENUM ('ATIVA', 'CONCLUIDA', 'PAUSADA', 'CANCELADA', 'AGUARDANDO_HUMANO');
CREATE TYPE public.playbook_evento_tipo AS ENUM ('AGENDADO', 'EXECUTADO', 'PULADO', 'ATRASADO', 'FALLBACK_IA', 'PAUSADO', 'RETOMADO', 'CANCELADO', 'ESCALADO');

-- 2. TABELA: playbooks (molde)
CREATE TABLE public.playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  versao INT NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES public.playbooks(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA: playbook_steps (passos do molde)
CREATE TABLE public.playbook_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo public.playbook_step_tipo NOT NULL,
  executor public.playbook_executor NOT NULL,
  canal public.canal_tipo,
  offset_dias INT NOT NULL DEFAULT 0,
  offset_horas INT NOT NULL DEFAULT 0,
  duracao_estimada_min INT,
  fallback_habilitado BOOLEAN NOT NULL DEFAULT false,
  fallback_offset_horas INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playbook_id, ordem)
);

-- 4. TABELA: deal_playbook_runs (instância ativa)
CREATE TABLE public.deal_playbook_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE RESTRICT,
  status public.playbook_run_status NOT NULL DEFAULT 'ATIVA',
  current_step_ordem INT NOT NULL DEFAULT 1,
  next_step_at TIMESTAMPTZ,
  owner_id UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA: deal_playbook_events (log)
CREATE TABLE public.deal_playbook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.deal_playbook_runs(id) ON DELETE CASCADE,
  step_ordem INT NOT NULL,
  tipo_evento public.playbook_evento_tipo NOT NULL,
  descricao TEXT,
  notas_vendedor TEXT,
  resultado TEXT,
  ai_response TEXT,
  user_id UUID REFERENCES public.profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. INDEXES
CREATE INDEX idx_playbooks_empresa ON public.playbooks(empresa);
CREATE INDEX idx_playbooks_pipeline ON public.playbooks(pipeline_id) WHERE pipeline_id IS NOT NULL;
CREATE INDEX idx_playbooks_parent ON public.playbooks(parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX idx_playbook_steps_playbook ON public.playbook_steps(playbook_id);
CREATE INDEX idx_playbook_steps_order ON public.playbook_steps(playbook_id, ordem);

CREATE INDEX idx_deal_playbook_runs_deal ON public.deal_playbook_runs(deal_id);
CREATE INDEX idx_deal_playbook_runs_status ON public.deal_playbook_runs(status) WHERE status IN ('ATIVA', 'AGUARDANDO_HUMANO');
CREATE INDEX idx_deal_playbook_runs_next ON public.deal_playbook_runs(next_step_at) WHERE status = 'ATIVA' AND next_step_at IS NOT NULL;
CREATE INDEX idx_deal_playbook_runs_owner ON public.deal_playbook_runs(owner_id) WHERE status IN ('ATIVA', 'AGUARDANDO_HUMANO');

CREATE INDEX idx_deal_playbook_events_run ON public.deal_playbook_events(run_id);
CREATE INDEX idx_deal_playbook_events_tipo ON public.deal_playbook_events(run_id, tipo_evento);

-- 7. RLS
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_playbook_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_playbook_events ENABLE ROW LEVEL SECURITY;

-- playbooks: admin full, authenticated read own empresa
CREATE POLICY "Admin full access on playbooks"
  ON public.playbooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users read playbooks of their empresa"
  ON public.playbooks FOR SELECT TO authenticated
  USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

-- playbook_steps: inherit from playbooks
CREATE POLICY "Admin full access on playbook_steps"
  ON public.playbook_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playbooks p WHERE p.id = playbook_id AND public.has_role(auth.uid(), 'ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.playbooks p WHERE p.id = playbook_id AND public.has_role(auth.uid(), 'ADMIN')));

CREATE POLICY "Users read playbook_steps of their empresa"
  ON public.playbook_steps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playbooks p
    WHERE p.id = playbook_id
      AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

-- deal_playbook_runs: admin full, users own empresa deals
CREATE POLICY "Admin full access on deal_playbook_runs"
  ON public.deal_playbook_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users manage runs of their empresa deals"
  ON public.deal_playbook_runs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_id
      AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_id
      AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

-- deal_playbook_events: admin full, users own empresa
CREATE POLICY "Admin full access on deal_playbook_events"
  ON public.deal_playbook_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users manage events of their empresa runs"
  ON public.deal_playbook_events FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_playbook_runs r
    JOIN public.deals d ON d.id = r.deal_id
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE r.id = run_id
      AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deal_playbook_runs r
    JOIN public.deals d ON d.id = r.deal_id
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE r.id = run_id
      AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

-- 8. TRIGGER: updated_at automático
CREATE TRIGGER set_updated_at_playbooks
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_playbook_steps
  BEFORE UPDATE ON public.playbook_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_deal_playbook_runs
  BEFORE UPDATE ON public.deal_playbook_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. TRIGGER: playbook event → deal_activities
CREATE OR REPLACE FUNCTION public.fn_playbook_event_to_deal_activity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_deal_id UUID;
  v_step_titulo TEXT;
  v_step_tipo TEXT;
  v_activity_tipo TEXT;
  v_desc TEXT;
BEGIN
  -- Only create activity for actionable events
  IF NEW.tipo_evento NOT IN ('EXECUTADO', 'PULADO', 'FALLBACK_IA', 'ESCALADO') THEN
    RETURN NEW;
  END IF;

  -- Get deal_id from run
  SELECT r.deal_id INTO v_deal_id
  FROM deal_playbook_runs r WHERE r.id = NEW.run_id;

  -- Get step info
  SELECT s.titulo, s.tipo::text INTO v_step_titulo, v_step_tipo
  FROM deal_playbook_runs r
  JOIN playbook_steps s ON s.playbook_id = r.playbook_id AND s.ordem = NEW.step_ordem
  WHERE r.id = NEW.run_id;

  -- Map to deal activity type
  v_activity_tipo := CASE
    WHEN v_step_tipo = 'LIGACAO' THEN 'LIGACAO'
    WHEN v_step_tipo = 'REUNIAO' THEN 'REUNIAO'
    WHEN v_step_tipo IN ('MENSAGEM_AUTO', 'MENSAGEM_MANUAL') THEN 'WHATSAPP'
    WHEN v_step_tipo = 'TAREFA' THEN 'TAREFA'
    ELSE 'NOTA'
  END;

  -- Build description
  v_desc := CASE NEW.tipo_evento
    WHEN 'EXECUTADO' THEN '✅ Playbook: ' || COALESCE(v_step_titulo, 'Step ' || NEW.step_ordem) || ' concluído'
    WHEN 'PULADO' THEN '⏭️ Playbook: ' || COALESCE(v_step_titulo, 'Step ' || NEW.step_ordem) || ' pulado'
    WHEN 'FALLBACK_IA' THEN '🤖 Playbook: IA assumiu — ' || COALESCE(v_step_titulo, 'Step ' || NEW.step_ordem)
    WHEN 'ESCALADO' THEN '🚨 Playbook: Escalado — ' || COALESCE(v_step_titulo, 'Step ' || NEW.step_ordem)
    ELSE 'Playbook: ' || NEW.tipo_evento::text
  END;

  INSERT INTO deal_activities (deal_id, tipo, descricao, user_id, metadata)
  VALUES (
    v_deal_id,
    v_activity_tipo::deal_activity_tipo,
    v_desc,
    NEW.user_id,
    jsonb_build_object(
      'source', 'playbook',
      'playbook_run_id', NEW.run_id,
      'step_ordem', NEW.step_ordem,
      'tipo_evento', NEW.tipo_evento::text,
      'notas', NEW.notas_vendedor,
      'resultado', NEW.resultado
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_playbook_event_to_activity
  AFTER INSERT ON public.deal_playbook_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_playbook_event_to_deal_activity();

-- 10. TRIGGER: playbook ativo pausa cadências
CREATE OR REPLACE FUNCTION public.fn_pause_cadence_on_playbook()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'ATIVA' THEN
    -- Pause all active cadence runs for this deal
    UPDATE public.deal_cadence_runs
    SET status = 'PAUSED', updated_at = now()
    WHERE deal_id = NEW.deal_id
      AND status = 'ACTIVE';

    -- Also pause the underlying lead_cadence_runs
    UPDATE public.lead_cadence_runs
    SET status = 'PAUSADA'::cadence_run_status, updated_at = now()
    WHERE id IN (
      SELECT cadence_run_id FROM public.deal_cadence_runs
      WHERE deal_id = NEW.deal_id
    ) AND status = 'ATIVA'::cadence_run_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pause_cadence_on_playbook
  AFTER INSERT OR UPDATE OF status ON public.deal_playbook_runs
  FOR EACH ROW
  WHEN (NEW.status = 'ATIVA')
  EXECUTE FUNCTION public.fn_pause_cadence_on_playbook();

-- 11. VIEWS DE PERFORMANCE

-- v_playbook_stats: métricas por playbook
CREATE OR REPLACE VIEW public.v_playbook_stats AS
SELECT
  p.id AS playbook_id,
  p.empresa,
  p.nome,
  p.versao,
  COUNT(r.id) AS total_runs,
  COUNT(r.id) FILTER (WHERE r.status = 'ATIVA') AS runs_ativas,
  COUNT(r.id) FILTER (WHERE r.status = 'AGUARDANDO_HUMANO') AS runs_aguardando,
  COUNT(r.id) FILTER (WHERE r.status = 'CONCLUIDA') AS runs_concluidas,
  COUNT(r.id) FILTER (WHERE r.status = 'CANCELADA') AS runs_canceladas,
  AVG(EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) / 86400)
    FILTER (WHERE r.status = 'CONCLUIDA' AND r.completed_at IS NOT NULL) AS tempo_medio_ciclo_dias
FROM public.playbooks p
LEFT JOIN public.deal_playbook_runs r ON r.playbook_id = p.id
GROUP BY p.id, p.empresa, p.nome, p.versao;

-- v_playbook_step_performance: por step
CREATE OR REPLACE VIEW public.v_playbook_step_performance AS
SELECT
  s.playbook_id,
  s.ordem,
  s.titulo,
  s.tipo,
  s.executor,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'EXECUTADO') AS total_executados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'PULADO') AS total_pulados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'ATRASADO') AS total_atrasados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'FALLBACK_IA') AS total_fallbacks,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'ESCALADO') AS total_escalados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento IN ('EXECUTADO', 'PULADO', 'FALLBACK_IA')) AS total_resolvidos
FROM public.playbook_steps s
LEFT JOIN public.deal_playbook_runs r ON r.playbook_id = s.playbook_id
LEFT JOIN public.deal_playbook_events e ON e.run_id = r.id AND e.step_ordem = s.ordem
GROUP BY s.playbook_id, s.ordem, s.titulo, s.tipo, s.executor;

-- v_playbook_vendedor_aderencia: por vendedor
CREATE OR REPLACE VIEW public.v_playbook_vendedor_aderencia AS
SELECT
  r.owner_id AS user_id,
  p.empresa,
  COUNT(DISTINCT r.id) AS total_runs,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'EXECUTADO') AS steps_executados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'ATRASADO') AS steps_atrasados,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'FALLBACK_IA') AS steps_fallback,
  COUNT(e.id) FILTER (WHERE e.tipo_evento = 'PULADO') AS steps_pulados,
  CASE
    WHEN COUNT(e.id) FILTER (WHERE e.tipo_evento IN ('EXECUTADO', 'ATRASADO', 'FALLBACK_IA', 'PULADO')) > 0
    THEN ROUND(
      COUNT(e.id) FILTER (WHERE e.tipo_evento = 'EXECUTADO')::NUMERIC /
      COUNT(e.id) FILTER (WHERE e.tipo_evento IN ('EXECUTADO', 'ATRASADO', 'FALLBACK_IA', 'PULADO'))::NUMERIC * 100,
      1
    )
    ELSE 0
  END AS taxa_aderencia_pct
FROM public.deal_playbook_runs r
JOIN public.playbooks p ON p.id = r.playbook_id
LEFT JOIN public.deal_playbook_events e ON e.run_id = r.id
WHERE r.owner_id IS NOT NULL
GROUP BY r.owner_id, p.empresa;
