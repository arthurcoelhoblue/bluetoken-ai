-- ========================================
-- SISTEMA DE AGENDAMENTO GOOGLE CALENDAR
-- Tabelas: tokens OAuth, disponibilidade, reuniões, transcrições
-- ========================================

-- 1. Tokens OAuth do Google Calendar por vendedor
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/calendar',
  google_email TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Configuração de disponibilidade por vendedor
-- Cada linha = um bloco de disponibilidade (ex: seg 09:00-12:00, seg 14:00-18:00)
CREATE TABLE IF NOT EXISTS user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);

-- 3. Configurações de reunião por vendedor
CREATE TABLE IF NOT EXISTS user_meeting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duracao_minutos INTEGER NOT NULL DEFAULT 45,
  intervalo_entre_reunioes INTEGER NOT NULL DEFAULT 15, -- minutos de buffer entre reuniões
  antecedencia_minima_horas INTEGER NOT NULL DEFAULT 2, -- não agendar com menos de X horas
  antecedencia_maxima_dias INTEGER NOT NULL DEFAULT 14, -- não agendar com mais de X dias
  fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  google_meet_automatico BOOLEAN NOT NULL DEFAULT true,
  aprovado_por UUID REFERENCES profiles(id),
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 4. Reuniões agendadas
CREATE TYPE meeting_status AS ENUM ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'NO_SHOW');

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id TEXT, -- legacy lead_id
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  empresa TEXT NOT NULL,
  
  -- Google Calendar
  google_event_id TEXT,
  google_meet_link TEXT,
  
  -- Dados da reunião
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ NOT NULL,
  fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  
  -- Convidados
  convidado_email TEXT,
  convidado_nome TEXT,
  convidado_telefone TEXT,
  
  -- Status e controle
  status meeting_status NOT NULL DEFAULT 'AGENDADA',
  agendado_por TEXT NOT NULL DEFAULT 'AMELIA', -- 'AMELIA' | 'MANUAL' | 'LEAD'
  cancelado_motivo TEXT,
  
  -- Metadados pós-reunião
  realizada_em TIMESTAMPTZ,
  duracao_real_minutos INTEGER,
  notas TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Metadados extraídos de transcrições de reunião
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Metadados extraídos (arquivo original é descartado)
  resumo TEXT,
  pontos_chave JSONB DEFAULT '[]'::jsonb, -- array de strings
  action_items JSONB DEFAULT '[]'::jsonb, -- array de {descricao, responsavel, prazo}
  objecoes_detectadas JSONB DEFAULT '[]'::jsonb, -- array de strings
  sentimento_geral TEXT, -- POSITIVO, NEUTRO, NEGATIVO
  interesse_nivel INTEGER CHECK (interesse_nivel BETWEEN 1 AND 10),
  proximos_passos TEXT,
  palavras_chave JSONB DEFAULT '[]'::jsonb,
  duracao_transcricao_minutos INTEGER,
  
  -- Controle
  extraido_por TEXT NOT NULL DEFAULT 'LLM', -- 'LLM' | 'MANUAL'
  modelo_usado TEXT, -- ex: 'claude-sonnet-4'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Estado de agendamento pendente (quando Amélia propõe horários e aguarda resposta)
CREATE TABLE IF NOT EXISTS meeting_scheduling_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa TEXT NOT NULL,
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  deal_id UUID REFERENCES deals(id),
  
  -- Horários propostos
  slots_propostos JSONB NOT NULL DEFAULT '[]'::jsonb, -- array de {inicio, fim, label}
  tentativa_numero INTEGER NOT NULL DEFAULT 1,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_RESPOSTA' CHECK (status IN ('AGUARDANDO_RESPOSTA', 'ACEITO', 'REJEITADO', 'EXPIRADO', 'CANCELADO')),
  slot_escolhido INTEGER, -- índice do slot escolhido (0, 1, 2)
  meeting_id UUID REFERENCES meetings(id), -- preenchido quando agendado
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(lead_id, empresa, status) -- apenas um agendamento pendente por lead/empresa
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_user ON user_google_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_user ON user_availability(user_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_meetings_vendedor ON meetings(vendedor_id, data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_meetings_deal ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status, data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_meeting_scheduling_state_lead ON meeting_scheduling_state(lead_id, empresa, status);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting ON meeting_transcripts(meeting_id);

-- ========================================
-- RLS
-- ========================================
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_meeting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_scheduling_state ENABLE ROW LEVEL SECURITY;

-- Tokens: apenas o próprio usuário ou admin
CREATE POLICY "user_google_tokens_own" ON user_google_tokens FOR ALL USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')
);

-- Availability: próprio usuário ou admin (gestor pode editar via admin)
CREATE POLICY "user_availability_own" ON user_availability FOR ALL USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')
);

-- Meeting config: próprio usuário ou admin
CREATE POLICY "user_meeting_config_own" ON user_meeting_config FOR ALL USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')
);

-- Meetings: todos podem ver, apenas dono ou admin pode editar
CREATE POLICY "meetings_select" ON meetings FOR SELECT USING (true);
CREATE POLICY "meetings_insert" ON meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "meetings_update" ON meetings FOR UPDATE USING (
  vendedor_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')
);

-- Transcripts: todos podem ver
CREATE POLICY "meeting_transcripts_select" ON meeting_transcripts FOR SELECT USING (true);
CREATE POLICY "meeting_transcripts_insert" ON meeting_transcripts FOR INSERT WITH CHECK (true);

-- Scheduling state: service role only (edge functions)
CREATE POLICY "meeting_scheduling_state_all" ON meeting_scheduling_state FOR ALL USING (true);

-- ========================================
-- ENUM: nova ação no SDR
-- ========================================
ALTER TYPE sdr_acao_tipo ADD VALUE IF NOT EXISTS 'AGENDAR_REUNIAO_CALENDAR';

-- ========================================
-- TRIGGER: updated_at automático
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_google_tokens_updated_at
  BEFORE UPDATE ON user_google_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_availability_updated_at
  BEFORE UPDATE ON user_availability FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_meeting_config_updated_at
  BEFORE UPDATE ON user_meeting_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_scheduling_state_updated_at
  BEFORE UPDATE ON meeting_scheduling_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
