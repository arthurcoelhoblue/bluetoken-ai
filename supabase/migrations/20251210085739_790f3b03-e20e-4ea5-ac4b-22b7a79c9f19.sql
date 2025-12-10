-- Remove a constraint antiga e cria uma nova incluindo UNMATCHED
ALTER TABLE public.lead_messages DROP CONSTRAINT IF EXISTS lead_messages_estado_check;

ALTER TABLE public.lead_messages ADD CONSTRAINT lead_messages_estado_check 
CHECK (estado IN ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'ERRO', 'RECEBIDO', 'UNMATCHED', 'DUPLICATE'));