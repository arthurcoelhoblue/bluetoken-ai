
-- Patch 2: Catalog Products & Deal Products tables with secure RLS

-- catalog_products: product catalog per empresa
CREATE TABLE public.catalog_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'un',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deal_products: products attached to a deal
CREATE TABLE public.deal_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  desconto NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) GENERATED ALWAYS AS (preco_unitario * quantidade * (1 - desconto / 100)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_catalog_products_empresa ON public.catalog_products(empresa);
CREATE INDEX idx_deal_products_deal_id ON public.deal_products(deal_id);

-- Enable RLS
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_products ENABLE ROW LEVEL SECURITY;

-- RLS for catalog_products: scoped by empresa via user access
CREATE POLICY "Users see catalog products of their empresas"
ON public.catalog_products FOR SELECT TO authenticated
USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can insert catalog products for their empresas"
ON public.catalog_products FOR INSERT TO authenticated
WITH CHECK (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can update catalog products of their empresas"
ON public.catalog_products FOR UPDATE TO authenticated
USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can delete catalog products of their empresas"
ON public.catalog_products FOR DELETE TO authenticated
USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

-- RLS for deal_products: scoped by empresa via deal -> pipeline
CREATE POLICY "Users see deal products of their empresas"
ON public.deal_products FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_products.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  )
);

CREATE POLICY "Users can insert deal products for their empresas"
ON public.deal_products FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_products.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  )
);

CREATE POLICY "Users can update deal products of their empresas"
ON public.deal_products FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_products.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  )
);

CREATE POLICY "Users can delete deal products of their empresas"
ON public.deal_products FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_products.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  )
);
