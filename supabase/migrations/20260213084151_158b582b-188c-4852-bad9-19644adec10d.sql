
-- =============================================
-- PATCH 10: Metas e Comissões
-- =============================================

-- 1. Tabela metas_vendedor
CREATE TABLE public.metas_vendedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  empresa TEXT NOT NULL,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta_deals INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa, ano, mes)
);

ALTER TABLE public.metas_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view metas" ON public.metas_vendedor
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage metas" ON public.metas_vendedor
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER update_metas_vendedor_updated_at
  BEFORE UPDATE ON public.metas_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela comissao_regras
CREATE TABLE public.comissao_regras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PERCENTUAL', 'FIXO', 'ESCALONADO')),
  percentual NUMERIC(5,2),
  valor_fixo NUMERIC(14,2),
  escalas JSONB,
  valor_minimo_deal NUMERIC(14,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comissao_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view regras" ON public.comissao_regras
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage regras" ON public.comissao_regras
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER update_comissao_regras_updated_at
  BEFORE UPDATE ON public.comissao_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabela comissao_lancamentos
CREATE TABLE public.comissao_lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  regra_id UUID NOT NULL REFERENCES public.comissao_regras(id),
  empresa TEXT NOT NULL,
  deal_valor NUMERIC(14,2) NOT NULL,
  comissao_valor NUMERIC(14,2) NOT NULL,
  percentual_aplicado NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'PAGO', 'CANCELADO')),
  aprovado_por UUID REFERENCES public.profiles(id),
  aprovado_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  referencia_ano INT NOT NULL,
  referencia_mes INT NOT NULL CHECK (referencia_mes BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, user_id)
);

ALTER TABLE public.comissao_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lancamentos" ON public.comissao_lancamentos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can manage lancamentos" ON public.comissao_lancamentos
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER update_comissao_lancamentos_updated_at
  BEFORE UPDATE ON public.comissao_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trigger function calc_comissao_deal
CREATE OR REPLACE FUNCTION public.calc_comissao_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa TEXT;
  v_stage_won BOOLEAN;
  v_regra RECORD;
  v_comissao NUMERIC(14,2) := 0;
  v_percentual NUMERIC(5,2) := 0;
  v_acumulado NUMERIC(14,2);
  v_faixa RECORD;
  v_deal_valor NUMERIC(14,2);
  v_ref_ano INT;
  v_ref_mes INT;
BEGIN
  -- Only fire when fechado_em changes from NULL to NOT NULL
  IF OLD.fechado_em IS NOT NULL OR NEW.fechado_em IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if stage is_won
  SELECT ps.is_won INTO v_stage_won
  FROM pipeline_stages ps WHERE ps.id = NEW.stage_id;

  IF NOT COALESCE(v_stage_won, false) THEN
    RETURN NEW;
  END IF;

  -- Get empresa via pipeline (CORRECAO: deals nao tem empresa)
  SELECT p.empresa::TEXT INTO v_empresa
  FROM pipelines p WHERE p.id = NEW.pipeline_id;

  v_deal_valor := COALESCE(NEW.valor, 0);
  v_ref_ano := EXTRACT(YEAR FROM NEW.fechado_em)::INT;
  v_ref_mes := EXTRACT(MONTH FROM NEW.fechado_em)::INT;

  -- Find matching active rule
  SELECT * INTO v_regra
  FROM comissao_regras cr
  WHERE cr.empresa = v_empresa
    AND cr.ativo = true
    AND COALESCE(cr.valor_minimo_deal, 0) <= v_deal_valor
    AND (cr.pipeline_id IS NULL OR cr.pipeline_id = NEW.pipeline_id)
  ORDER BY cr.pipeline_id IS NOT NULL DESC, cr.valor_minimo_deal DESC
  LIMIT 1;

  IF v_regra IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate commission based on type
  IF v_regra.tipo = 'PERCENTUAL' THEN
    v_percentual := COALESCE(v_regra.percentual, 0);
    v_comissao := v_deal_valor * v_percentual / 100;

  ELSIF v_regra.tipo = 'FIXO' THEN
    v_comissao := COALESCE(v_regra.valor_fixo, 0);
    v_percentual := CASE WHEN v_deal_valor > 0 THEN (v_comissao / v_deal_valor * 100) ELSE 0 END;

  ELSIF v_regra.tipo = 'ESCALONADO' THEN
    -- Get accumulated monthly value for this seller+empresa
    SELECT COALESCE(SUM(d.valor), 0) INTO v_acumulado
    FROM deals d
    JOIN pipelines pip ON d.pipeline_id = pip.id
    JOIN pipeline_stages pst ON d.stage_id = pst.id
    WHERE d.owner_id = NEW.owner_id
      AND pip.empresa::TEXT = v_empresa
      AND pst.is_won = true
      AND d.fechado_em IS NOT NULL
      AND EXTRACT(YEAR FROM d.fechado_em) = v_ref_ano
      AND EXTRACT(MONTH FROM d.fechado_em) = v_ref_mes
      AND d.id != NEW.id;

    -- Find applicable tier
    v_percentual := 0;
    FOR v_faixa IN
      SELECT
        (f->>'ate')::NUMERIC as ate,
        (f->>'percentual')::NUMERIC as pct
      FROM jsonb_array_elements(v_regra.escalas) AS f
      ORDER BY (f->>'ate')::NUMERIC ASC
    LOOP
      IF v_acumulado + v_deal_valor <= v_faixa.ate OR v_faixa.ate IS NULL THEN
        v_percentual := v_faixa.pct;
        EXIT;
      END IF;
      v_percentual := v_faixa.pct;
    END LOOP;

    v_comissao := v_deal_valor * v_percentual / 100;
  END IF;

  -- Upsert commission entry
  INSERT INTO comissao_lancamentos (
    deal_id, user_id, regra_id, empresa, deal_valor,
    comissao_valor, percentual_aplicado, status,
    referencia_ano, referencia_mes
  ) VALUES (
    NEW.id, NEW.owner_id, v_regra.id, v_empresa, v_deal_valor,
    v_comissao, v_percentual, 'PENDENTE',
    v_ref_ano, v_ref_mes
  )
  ON CONFLICT (deal_id, user_id) DO UPDATE SET
    regra_id = EXCLUDED.regra_id,
    deal_valor = EXCLUDED.deal_valor,
    comissao_valor = EXCLUDED.comissao_valor,
    percentual_aplicado = EXCLUDED.percentual_aplicado,
    referencia_ano = EXCLUDED.referencia_ano,
    referencia_mes = EXCLUDED.referencia_mes,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_comissao_deal
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_comissao_deal();

-- 5. View meta_progresso
CREATE OR REPLACE VIEW public.meta_progresso WITH (security_invoker = true) AS
WITH meses AS (
  SELECT m.user_id, m.empresa, m.ano, m.mes, m.meta_valor, m.meta_deals, m.id as meta_id
  FROM metas_vendedor m
),
vendas AS (
  SELECT
    d.owner_id,
    pip.empresa::TEXT as empresa,
    EXTRACT(YEAR FROM d.fechado_em)::INT as ano,
    EXTRACT(MONTH FROM d.fechado_em)::INT as mes,
    COUNT(*) as total_deals,
    SUM(COALESCE(d.valor, 0)) as total_valor
  FROM deals d
  JOIN pipelines pip ON d.pipeline_id = pip.id
  JOIN pipeline_stages ps ON d.stage_id = ps.id
  WHERE d.fechado_em IS NOT NULL AND ps.is_won = true
  GROUP BY d.owner_id, pip.empresa, EXTRACT(YEAR FROM d.fechado_em), EXTRACT(MONTH FROM d.fechado_em)
),
pipeline_aberto AS (
  SELECT
    d.owner_id,
    pip.empresa::TEXT as empresa,
    SUM(COALESCE(d.valor, 0)) as valor_aberto
  FROM deals d
  JOIN pipelines pip ON d.pipeline_id = pip.id
  WHERE d.status = 'ABERTO'
  GROUP BY d.owner_id, pip.empresa
),
comissoes AS (
  SELECT
    cl.user_id,
    cl.empresa,
    cl.referencia_ano as ano,
    cl.referencia_mes as mes,
    SUM(cl.comissao_valor) as comissao_total
  FROM comissao_lancamentos cl
  WHERE cl.status != 'CANCELADO'
  GROUP BY cl.user_id, cl.empresa, cl.referencia_ano, cl.referencia_mes
)
SELECT
  m.meta_id,
  m.user_id,
  m.empresa,
  m.ano,
  m.mes,
  m.meta_valor,
  m.meta_deals,
  p.nome as vendedor_nome,
  p.avatar_url as vendedor_avatar,
  COALESCE(v.total_valor, 0) as realizado_valor,
  COALESCE(v.total_deals, 0)::INT as realizado_deals,
  CASE WHEN m.meta_valor > 0 THEN ROUND(COALESCE(v.total_valor, 0) / m.meta_valor * 100, 1) ELSE 0 END as pct_valor,
  CASE WHEN m.meta_deals > 0 THEN ROUND(COALESCE(v.total_deals, 0)::NUMERIC / m.meta_deals * 100, 1) ELSE 0 END as pct_deals,
  COALESCE(pa.valor_aberto, 0) as pipeline_aberto,
  COALESCE(c.comissao_total, 0) as comissao_mes
FROM meses m
JOIN profiles p ON p.id = m.user_id
LEFT JOIN vendas v ON v.owner_id = m.user_id AND v.empresa = m.empresa AND v.ano = m.ano AND v.mes = m.mes
LEFT JOIN pipeline_aberto pa ON pa.owner_id = m.user_id AND pa.empresa = m.empresa
LEFT JOIN comissoes c ON c.user_id = m.user_id AND c.empresa = m.empresa AND c.ano = m.ano AND c.mes = m.mes;

-- 6. View comissao_resumo_mensal
CREATE OR REPLACE VIEW public.comissao_resumo_mensal WITH (security_invoker = true) AS
SELECT
  cl.user_id,
  p.nome as vendedor_nome,
  cl.empresa,
  cl.referencia_ano as ano,
  cl.referencia_mes as mes,
  COUNT(*) FILTER (WHERE cl.status = 'PENDENTE') as pendentes,
  COUNT(*) FILTER (WHERE cl.status = 'APROVADO') as aprovados,
  COUNT(*) FILTER (WHERE cl.status = 'PAGO') as pagos,
  SUM(cl.comissao_valor) as comissao_total,
  SUM(cl.comissao_valor) FILTER (WHERE cl.status = 'PENDENTE') as valor_pendente,
  SUM(cl.comissao_valor) FILTER (WHERE cl.status = 'APROVADO') as valor_aprovado,
  SUM(cl.comissao_valor) FILTER (WHERE cl.status = 'PAGO') as valor_pago
FROM comissao_lancamentos cl
JOIN profiles p ON p.id = cl.user_id
WHERE cl.status != 'CANCELADO'
GROUP BY cl.user_id, p.nome, cl.empresa, cl.referencia_ano, cl.referencia_mes;

-- 7. Seed data
INSERT INTO public.comissao_regras (empresa, nome, tipo, percentual, valor_minimo_deal) VALUES
  ('BLUE', 'Comissão Blue 10%', 'PERCENTUAL', 10.00, 500.00);

INSERT INTO public.comissao_regras (empresa, nome, tipo, escalas, valor_minimo_deal) VALUES
  ('TOKENIZA', 'Comissão Tokeniza Escalonada', 'ESCALONADO',
   '[{"ate": 50000, "percentual": 5}, {"ate": 100000, "percentual": 8}, {"ate": null, "percentual": 12}]'::JSONB,
   0);
