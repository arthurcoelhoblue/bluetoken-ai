-- Drop old unique constraint that prevents multiple investments per year
ALTER TABLE cs_contracts DROP CONSTRAINT IF EXISTS cs_contracts_customer_id_ano_fiscal_key;

-- Add new columns for Tokeniza investment details
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS oferta_id TEXT;
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS oferta_nome TEXT;
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS tipo TEXT;

-- New unique constraint: customer + year + offer (Blue keeps oferta_id=NULL, still unique per year)
ALTER TABLE cs_contracts ADD CONSTRAINT cs_contracts_customer_oferta_key 
  UNIQUE (customer_id, ano_fiscal, oferta_id);