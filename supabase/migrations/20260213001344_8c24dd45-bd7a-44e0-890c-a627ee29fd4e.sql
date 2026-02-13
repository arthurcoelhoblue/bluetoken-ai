
-- 1. Rename tempo_minimo_minutos to tempo_minimo_dias in pipeline_stages
ALTER TABLE public.pipeline_stages ADD COLUMN tempo_minimo_dias INTEGER;
UPDATE public.pipeline_stages SET tempo_minimo_dias = CEIL(tempo_minimo_minutos / 1440.0) WHERE tempo_minimo_minutos IS NOT NULL;
ALTER TABLE public.pipeline_stages DROP COLUMN tempo_minimo_minutos;

-- 2. Add gestor_id to profiles
ALTER TABLE public.profiles ADD COLUMN gestor_id UUID REFERENCES public.profiles(id);

-- 3. Add loss analysis columns to deals
ALTER TABLE public.deals ADD COLUMN motivo_perda_closer TEXT;
ALTER TABLE public.deals ADD COLUMN motivo_perda_ia TEXT;
ALTER TABLE public.deals ADD COLUMN categoria_perda_closer TEXT;
ALTER TABLE public.deals ADD COLUMN categoria_perda_ia TEXT;
ALTER TABLE public.deals ADD COLUMN motivo_perda_final TEXT;
ALTER TABLE public.deals ADD COLUMN categoria_perda_final TEXT;
ALTER TABLE public.deals ADD COLUMN perda_resolvida BOOLEAN DEFAULT false;
ALTER TABLE public.deals ADD COLUMN perda_resolvida_por UUID REFERENCES public.profiles(id);
ALTER TABLE public.deals ADD COLUMN perda_resolvida_em TIMESTAMPTZ;

-- 4. Create deal_loss_categories table
CREATE TABLE public.deal_loss_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  descricao TEXT,
  posicao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_loss_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read loss categories"
ON public.deal_loss_categories FOR SELECT
TO authenticated
USING (true);

-- 5. Seed loss categories
INSERT INTO public.deal_loss_categories (codigo, label, descricao, posicao) VALUES
  ('PRECO', 'Preço', 'O prospect considerou o preço alto demais', 1),
  ('CONCORRENCIA', 'Concorrência', 'O prospect escolheu um concorrente', 2),
  ('TIMING', 'Timing', 'Não é o momento certo para o prospect', 3),
  ('SEM_NECESSIDADE', 'Sem Necessidade', 'O prospect não tem necessidade do produto', 4),
  ('SEM_RESPOSTA', 'Sem Resposta', 'O prospect parou de responder', 5),
  ('PRODUTO_INADEQUADO', 'Produto Inadequado', 'O produto não atende às necessidades', 6),
  ('OUTRO', 'Outro', 'Outro motivo não listado', 7);

-- 6. Backfill existing lost deals: copy motivo_perda to motivo_perda_closer and motivo_perda_final
UPDATE public.deals 
SET motivo_perda_closer = motivo_perda,
    motivo_perda_final = motivo_perda,
    perda_resolvida = true
WHERE status = 'PERDIDO' AND motivo_perda IS NOT NULL;
