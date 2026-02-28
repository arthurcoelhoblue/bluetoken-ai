
-- 1. Drop old constraint that includes ano_fiscal
ALTER TABLE public.cs_contracts DROP CONSTRAINT IF EXISTS cs_contracts_customer_oferta_key;

-- 2. Add new unique index for Tokeniza: (customer_id, oferta_id) — ignores ano_fiscal
CREATE UNIQUE INDEX IF NOT EXISTS cs_contracts_customer_oferta_uq 
ON public.cs_contracts (customer_id, oferta_id) 
WHERE oferta_id IS NOT NULL;

-- 3. Keep Blue's constraint: (customer_id, ano_fiscal) where oferta_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS cs_contracts_customer_ano_fiscal_uq
ON public.cs_contracts (customer_id, ano_fiscal)
WHERE oferta_id IS NULL;
