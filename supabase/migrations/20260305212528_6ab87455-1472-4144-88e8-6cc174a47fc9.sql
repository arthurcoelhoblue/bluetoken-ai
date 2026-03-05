-- Remove duplicate cs_contracts keeping only the most recent per (customer_id, ano_fiscal)
DELETE FROM public.cs_contracts
WHERE id NOT IN (
  SELECT DISTINCT ON (customer_id, ano_fiscal) id
  FROM public.cs_contracts
  ORDER BY customer_id, ano_fiscal, updated_at DESC
);

-- Now add the unique constraint
ALTER TABLE public.cs_contracts
ADD CONSTRAINT cs_contracts_customer_ano_key UNIQUE (customer_id, ano_fiscal);