-- ============================================
-- MARKETING LEAD LISTS
-- Permite criar listas de leads para o marketing
-- trabalhar no lugar dos vendedores
-- ============================================

-- Tabela de listas
CREATE TABLE IF NOT EXISTS marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  empresa TEXT NOT NULL DEFAULT 'BLUE',
  tipo TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, FILTRO_AUTOMATICO
  filtros JSONB DEFAULT '{}', -- Para listas automáticas: critérios de filtro
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  total_leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de membros da lista (leads/contatos)
CREATE TABLE IF NOT EXISTS marketing_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES marketing_lists(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  legacy_lead_id TEXT, -- Para leads que ainda não são contacts
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, CONTATADO, CONVERTIDO, REMOVIDO
  notas TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  contatado_at TIMESTAMPTZ,
  UNIQUE(list_id, contact_id),
  UNIQUE(list_id, legacy_lead_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_lists_empresa ON marketing_lists(empresa);
CREATE INDEX IF NOT EXISTS idx_marketing_lists_active ON marketing_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_list_members_list ON marketing_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_marketing_list_members_status ON marketing_list_members(status);
CREATE INDEX IF NOT EXISTS idx_marketing_list_members_contact ON marketing_list_members(contact_id);

-- RLS
ALTER TABLE marketing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_lists_auth" ON marketing_lists FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "marketing_list_members_auth" ON marketing_list_members FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_marketing_list_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketing_lists
  SET total_leads = (
    SELECT COUNT(*) FROM marketing_list_members
    WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
    AND status != 'REMOVIDO'
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_list_count
AFTER INSERT OR UPDATE OR DELETE ON marketing_list_members
FOR EACH ROW EXECUTE FUNCTION update_marketing_list_count();
