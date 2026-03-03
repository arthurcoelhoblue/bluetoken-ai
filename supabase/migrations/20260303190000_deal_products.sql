-- Patch 2: Cadastro de produtos no Deal
-- Tabela de produtos disponíveis por empresa
CREATE TABLE IF NOT EXISTS catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens de produto vinculados a um deal
CREATE TABLE IF NOT EXISTS deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  catalog_product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_tipo TEXT NOT NULL DEFAULT 'PERCENTUAL' CHECK (desconto_tipo IN ('PERCENTUAL', 'VALOR')),
  desconto_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN desconto_tipo = 'PERCENTUAL' THEN quantidade * preco_unitario * (1 - desconto_valor / 100)
      ELSE quantidade * preco_unitario - desconto_valor
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_products_deal_id ON deal_products(deal_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_empresa ON catalog_products(empresa);

-- RLS
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_products_select" ON catalog_products FOR SELECT USING (true);
CREATE POLICY "catalog_products_insert" ON catalog_products FOR INSERT WITH CHECK (true);
CREATE POLICY "catalog_products_update" ON catalog_products FOR UPDATE USING (true);

CREATE POLICY "deal_products_select" ON deal_products FOR SELECT USING (true);
CREATE POLICY "deal_products_insert" ON deal_products FOR INSERT WITH CHECK (true);
CREATE POLICY "deal_products_update" ON deal_products FOR UPDATE USING (true);
CREATE POLICY "deal_products_delete" ON deal_products FOR DELETE USING (true);
