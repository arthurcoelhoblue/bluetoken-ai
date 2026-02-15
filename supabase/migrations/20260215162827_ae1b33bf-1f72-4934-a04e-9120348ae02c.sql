
-- Tabela de insights proativos
CREATE TABLE public.copilot_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  empresa text NOT NULL,
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'MEDIA',
  deal_id UUID REFERENCES deals(id),
  lead_id UUID,
  dispensado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE copilot_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own insights" ON copilot_insights
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Índice para busca rápida de histórico do copilot
CREATE INDEX IF NOT EXISTS idx_copilot_messages_user_ctx 
  ON copilot_messages(user_id, context_type, context_id, empresa, created_at DESC);

-- RLS para copilot_messages (permitir usuários verem/salvarem suas próprias mensagens)
CREATE POLICY "Users manage own copilot messages" ON copilot_messages
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
