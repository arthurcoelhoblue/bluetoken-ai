
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcription_channels JSONB;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS talk_ratio JSONB;

COMMENT ON COLUMN public.calls.transcription_channels IS 'Dialogue array: [{speaker, text, start, end}]';
COMMENT ON COLUMN public.calls.talk_ratio IS 'Talk ratio: {seller_pct, client_pct, seller_words, client_words}';
