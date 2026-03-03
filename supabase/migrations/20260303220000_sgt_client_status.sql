-- ============================================
-- SGT CLIENT STATUS
-- Tabela intermediária para receber status de
-- declarações do SGT/Notion e disparar renovações
-- ============================================

CREATE TABLE IF NOT EXISTS sgt_client_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL DEFAULT 'BLUE',
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  status_declaracao TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, EM_ANDAMENTO, FINALIZADA
  data_finalizacao TIMESTAMPTZ,
  plano_atual TEXT,
  vendedor_responsavel TEXT,
  renewal_deal_created UUID REFERENCES deals(id),
  processed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sgt_client_status_empresa ON sgt_client_status(empresa);
CREATE INDEX IF NOT EXISTS idx_sgt_client_status_declaracao ON sgt_client_status(status_declaracao);
CREATE INDEX IF NOT EXISTS idx_sgt_client_status_email ON sgt_client_status(email);
CREATE INDEX IF NOT EXISTS idx_sgt_client_status_renewal ON sgt_client_status(renewal_deal_created);

-- RLS
ALTER TABLE sgt_client_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sgt_client_status_auth" ON sgt_client_status FOR ALL USING (auth.role() = 'authenticated');
