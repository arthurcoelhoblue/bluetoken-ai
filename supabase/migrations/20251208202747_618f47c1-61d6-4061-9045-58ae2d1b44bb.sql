-- ========================================
-- PATCH 5A - Infraestrutura de Mensagens
-- ========================================

-- Tabela de templates de mensagem
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa empresa_tipo NOT NULL,
  canal canal_tipo NOT NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  conteudo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa, codigo)
);

-- Tabela de contatos do lead (cache local)
CREATE TABLE public.lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  primeiro_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, empresa)
);

-- Índices
CREATE INDEX idx_lead_contacts_lead_empresa ON public.lead_contacts(lead_id, empresa);
CREATE INDEX idx_message_templates_empresa_codigo ON public.message_templates(empresa, codigo);

-- Triggers de updated_at
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_contacts_updated_at
  BEFORE UPDATE ON public.lead_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can read message_templates"
  ON public.message_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage message_templates"
  ON public.message_templates FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view message_templates"
  ON public.message_templates FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

-- RLS para lead_contacts
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage lead_contacts"
  ON public.lead_contacts FOR ALL
  USING (true);

CREATE POLICY "Admins can view lead_contacts"
  ON public.lead_contacts FOR SELECT
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "SDR_IA can view lead_contacts"
  ON public.lead_contacts FOR SELECT
  USING (has_role(auth.uid(), 'SDR_IA'));

-- ========================================
-- SEED: Templates de mensagem iniciais
-- ========================================

-- TOKENIZA templates
INSERT INTO public.message_templates (empresa, canal, codigo, nome, descricao, conteudo) VALUES
('TOKENIZA', 'WHATSAPP', 'TOKENIZA_INBOUND_DIA0', 'Boas-vindas Tokeniza', 'Primeiro contato com lead inbound', 
'Olá {{primeiro_nome}}! 👋

Aqui é da equipe Tokeniza. Vi que você demonstrou interesse em investimentos tokenizados.

Posso te ajudar a entender melhor como funciona?'),

('TOKENIZA', 'WHATSAPP', 'TOKENIZA_INBOUND_DIA1', 'Follow-up D+1 Tokeniza', 'Segundo contato após 24h',
'Oi {{primeiro_nome}}, tudo bem?

Passando aqui pra saber se conseguiu dar uma olhada nos materiais sobre tokenização.

Quer que eu te explique algum ponto específico?'),

('TOKENIZA', 'WHATSAPP', 'TOKENIZA_INBOUND_DIA3', 'Follow-up D+3 Tokeniza', 'Terceiro contato após 72h',
'{{primeiro_nome}}, última mensagem por aqui! 

Se tiver interesse em saber mais sobre investimentos tokenizados, estou à disposição.

Abraço! 🚀'),

('TOKENIZA', 'WHATSAPP', 'TOKENIZA_MQL_QUENTE_IMEDIATO', 'MQL Quente - Contato Imediato', 'Lead quente precisa de atenção rápida',
'{{primeiro_nome}}, tudo bem?

Notei que você está bem interessado nos nossos projetos! 🔥

Que tal conversarmos agora? Posso te ligar?'),

('TOKENIZA', 'WHATSAPP', 'TOKENIZA_MQL_QUENTE_4H', 'MQL Quente - Follow-up 4h', 'Segundo contato MQL quente',
'Oi {{primeiro_nome}}!

Ainda consigo te ajudar hoje com as dúvidas sobre tokenização.

Me avisa quando puder conversar! 📱');

-- BLUE templates
INSERT INTO public.message_templates (empresa, canal, codigo, nome, descricao, conteudo) VALUES
('BLUE', 'WHATSAPP', 'BLUE_INBOUND_DIA0', 'Boas-vindas Blue', 'Primeiro contato lead Blue',
'Olá {{primeiro_nome}}! 

Aqui é da Blue Consult. Vi seu interesse em nossos serviços de IR.

Como posso te ajudar hoje?'),

('BLUE', 'WHATSAPP', 'BLUE_INBOUND_DIA1', 'Follow-up D+1 Blue', 'Segundo contato Blue',
'Oi {{primeiro_nome}}!

Passando pra saber se posso esclarecer alguma dúvida sobre declaração de IR.

Estou por aqui! 📊'),

('BLUE', 'WHATSAPP', 'BLUE_INBOUND_DIA3', 'Follow-up D+3 Blue', 'Terceiro contato Blue',
'{{primeiro_nome}}, última mensagem!

Se precisar de ajuda com IR ou contabilidade, pode contar comigo.

Abraço!'),

('BLUE', 'WHATSAPP', 'BLUE_IR_URGENTE_IMEDIATO', 'IR Urgente - Contato Imediato', 'Lead IR com urgência',
'{{primeiro_nome}}, tudo bem?

Vi que você precisa de ajuda com IR. O prazo está próximo! ⏰

Posso te ligar agora pra agilizar?'),

('BLUE', 'WHATSAPP', 'BLUE_IR_URGENTE_2H', 'IR Urgente - Follow-up 2h', 'Segundo contato IR urgente',
'Oi {{primeiro_nome}}!

Ainda dá tempo de resolver seu IR hoje.

Me avisa se quiser que eu ligue! 📞');