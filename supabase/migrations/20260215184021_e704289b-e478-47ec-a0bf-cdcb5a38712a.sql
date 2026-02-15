
-- A/B Testing columns for prompt_versions
ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS ab_weight int NOT NULL DEFAULT 100;
ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS ab_group text;

-- Track which prompt version was used in AI calls
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS prompt_version_id uuid;

-- Store feature engineering data in revenue forecast
ALTER TABLE public.revenue_forecast_log ADD COLUMN IF NOT EXISTS features jsonb;
