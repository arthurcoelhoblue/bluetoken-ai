-- Add tags array column to deals table
ALTER TABLE public.deals ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array queries
CREATE INDEX idx_deals_tags ON public.deals USING GIN(tags);