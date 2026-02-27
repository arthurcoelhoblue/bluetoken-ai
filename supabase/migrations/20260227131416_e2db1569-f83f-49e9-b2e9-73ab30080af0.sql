
-- Add empresas_ativas column to zadarma_config
ALTER TABLE public.zadarma_config ADD COLUMN IF NOT EXISTS empresas_ativas TEXT[] DEFAULT '{}';

-- Migrate existing BLUE row: set empresas_ativas and remove empresa constraint
UPDATE public.zadarma_config SET empresas_ativas = ARRAY['BLUE'] WHERE empresa = 'BLUE';

-- Drop the unique constraint on empresa (find and drop it)
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name 
  FROM pg_constraint 
  WHERE conrelid = 'public.zadarma_config'::regclass 
    AND contype = 'u' 
    AND array_to_string(conkey, ',') = (
      SELECT attnum::text FROM pg_attribute 
      WHERE attrelid = 'public.zadarma_config'::regclass AND attname = 'empresa'
    );
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.zadarma_config DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Make empresa column nullable (it's no longer meaningful for singleton)
ALTER TABLE public.zadarma_config ALTER COLUMN empresa DROP NOT NULL;
