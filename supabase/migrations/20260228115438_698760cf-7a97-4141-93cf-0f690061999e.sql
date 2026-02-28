
-- Create RPC to increment FAQ use_count atomically
CREATE OR REPLACE FUNCTION public.increment_faq_use_count(faq_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE knowledge_faq SET use_count = use_count + 1, updated_at = now() WHERE id = faq_id;
END;
$$;
