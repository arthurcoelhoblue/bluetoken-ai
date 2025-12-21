-- Adicionar coluna para assunto de e-mail nos templates
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS assunto_template text;

-- Comentário explicativo
COMMENT ON COLUMN public.message_templates.assunto_template IS 'Assunto do e-mail para templates do canal EMAIL';