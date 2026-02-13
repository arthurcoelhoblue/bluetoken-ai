
-- 1. Enum atendimento_modo
CREATE TYPE public.atendimento_modo AS ENUM ('SDR_IA', 'MANUAL', 'HIBRIDO');

-- 2. lead_conversation_state — novos campos
ALTER TABLE public.lead_conversation_state
  ADD COLUMN modo public.atendimento_modo NOT NULL DEFAULT 'SDR_IA',
  ADD COLUMN assumido_por UUID REFERENCES public.profiles(id),
  ADD COLUMN assumido_em TIMESTAMPTZ,
  ADD COLUMN devolvido_em TIMESTAMPTZ,
  ADD COLUMN perfil_investidor TEXT CHECK (perfil_investidor IN ('CONSERVADOR', 'ARROJADO'));

CREATE INDEX idx_lcs_modo ON public.lead_conversation_state(modo);
CREATE INDEX idx_lcs_assumido_por ON public.lead_conversation_state(assumido_por);

-- 3. conversation_takeover_log (nova tabela)
CREATE TABLE public.conversation_takeover_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  empresa public.empresa_tipo NOT NULL,
  canal public.canal_tipo NOT NULL DEFAULT 'WHATSAPP',
  acao TEXT NOT NULL CHECK (acao IN ('ASSUMIR', 'DEVOLVER')),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_takeover_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view takeover logs"
  ON public.conversation_takeover_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin and Closer can insert takeover logs"
  ON public.conversation_takeover_log FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'CLOSER')
    )
  );

-- 4. lead_messages — novos campos
ALTER TABLE public.lead_messages
  ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'AMELIA' CHECK (sender_type IN ('AMELIA', 'VENDEDOR', 'SISTEMA')),
  ADD COLUMN sender_id UUID REFERENCES public.profiles(id);

-- 5. copilot_messages (nova tabela)
CREATE TABLE public.copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  context_type TEXT NOT NULL CHECK (context_type IN ('LEAD', 'DEAL', 'PIPELINE', 'GERAL')),
  context_id TEXT,
  empresa public.empresa_tipo NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_input INT,
  tokens_output INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own copilot messages"
  ON public.copilot_messages FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own copilot messages"
  ON public.copilot_messages FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Enable realtime for takeover awareness
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_takeover_log;
