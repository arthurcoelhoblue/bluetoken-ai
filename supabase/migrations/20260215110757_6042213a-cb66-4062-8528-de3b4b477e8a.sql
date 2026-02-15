
-- BUG 4: Add metadata JSONB column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
