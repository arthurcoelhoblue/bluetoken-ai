
CREATE TABLE public.ai_model_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_intent_id uuid REFERENCES public.lead_message_intents(id),
  message_id uuid REFERENCES public.lead_messages(id),
  modelo_ia text NOT NULL,
  intent text,
  intent_confidence numeric(4,2),
  acao_recomendada text,
  resposta_automatica_texto text,
  tokens_usados integer,
  tempo_processamento_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_model_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_model_benchmarks"
  ON public.ai_model_benchmarks
  FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Service can manage ai_model_benchmarks"
  ON public.ai_model_benchmarks
  FOR ALL
  USING (true);
