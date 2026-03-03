
ALTER TABLE public.message_templates
ADD COLUMN connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

CREATE INDEX idx_message_templates_connection_id ON public.message_templates(connection_id);
