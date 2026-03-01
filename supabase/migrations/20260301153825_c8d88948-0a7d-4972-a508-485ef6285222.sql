
-- ================================================
-- Fase 1: Tabelas de desacoplamento IA
-- ================================================

-- Enum para tipos de instrução
CREATE TYPE public.ai_instruction_tipo AS ENUM ('PERSONA', 'TOM', 'COMPLIANCE', 'CANAL', 'PROCESSO');

-- Tabela ai_instructions
CREATE TABLE public.ai_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  tipo ai_instruction_tipo NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela ai_routing_rules
CREATE TABLE public.ai_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  intent TEXT NOT NULL,
  condicao JSONB NOT NULL DEFAULT '{}',
  acao TEXT NOT NULL,
  resposta_padrao TEXT,
  prioridade INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela ai_business_descriptions
CREATE TABLE public.ai_business_descriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  regras_criticas TEXT,
  identidade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fase 2: Coluna de tracking baixa confiança
ALTER TABLE public.knowledge_search_feedback 
  ADD COLUMN IF NOT EXISTS escalou_por_baixa_confianca BOOLEAN DEFAULT false;

-- ================================================
-- RLS
-- ================================================
ALTER TABLE public.ai_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_business_descriptions ENABLE ROW LEVEL SECURITY;

-- Policies usando has_role()
CREATE POLICY "ai_instructions_select" ON public.ai_instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_instructions_all_service" ON public.ai_instructions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "ai_instructions_admin_insert" ON public.ai_instructions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_instructions_admin_update" ON public.ai_instructions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_instructions_admin_delete" ON public.ai_instructions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "ai_routing_rules_select" ON public.ai_routing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_routing_rules_all_service" ON public.ai_routing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "ai_routing_rules_admin_insert" ON public.ai_routing_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_routing_rules_admin_update" ON public.ai_routing_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_routing_rules_admin_delete" ON public.ai_routing_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "ai_business_desc_select" ON public.ai_business_descriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_business_desc_all_service" ON public.ai_business_descriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "ai_business_desc_admin_insert" ON public.ai_business_descriptions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_business_desc_admin_update" ON public.ai_business_descriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "ai_business_desc_admin_delete" ON public.ai_business_descriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

-- Trigger updated_at
CREATE TRIGGER update_ai_instructions_updated_at BEFORE UPDATE ON public.ai_instructions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_routing_rules_updated_at BEFORE UPDATE ON public.ai_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_business_desc_updated_at BEFORE UPDATE ON public.ai_business_descriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_ai_instructions_empresa ON public.ai_instructions(empresa, ativo);
CREATE INDEX idx_ai_routing_rules_empresa ON public.ai_routing_rules(empresa, ativo);

-- ================================================
-- SEED: Business Descriptions
-- ================================================
INSERT INTO public.ai_business_descriptions (empresa, descricao, regras_criticas, identidade) VALUES
('BLUE', 'Blue Cripto (IR/tributação de criptoativos)', 'Nenhuma regra crítica especial.', 'Você atua pela Blue Cripto, especialista em declaração de IR para criptoativos. Conhece GCAP, IN 1888, exchanges, DeFi e otimização fiscal.'),
('TOKENIZA', 'Tokeniza (investimentos em ativos reais tokenizados)', E'## 🚫 PROCESSO TOKENIZA — REGRA CRÍTICA\nInvestimentos são feitos EXCLUSIVAMENTE pela plataforma plataforma.tokeniza.com.br.\nPROIBIDO: gerar contratos, pedir CPF/documentos, prometer envio de dados bancários, simular processo de fechamento fora da plataforma.\nQuando o lead quiser investir: direcione-o para a plataforma com o link plataforma.tokeniza.com.br e ofereça ajuda para dúvidas sobre ofertas disponíveis.\nNUNCA peça dados pessoais (CPF, RG, email) para \"gerar contrato\" ou \"iniciar processo\". Todo o processo é feito pela plataforma.\nTERMINOLOGIA OBRIGATÓRIA: NUNCA use \"mercado secundário\". O termo correto é SEMPRE \"mercado de transações subsequentes\".', 'Você atua pela Tokeniza, plataforma de investimentos em ativos reais tokenizados (RWA) regulada pela CVM. Conhece CVM 88, mercado de transações subsequentes e diversificação de portfólio.'),
('MPUPPE', 'MPuppe (Direito Digital — regulação Bacen, CVM, LGPD, governança de IA)', E'## 🚫 PROCESSO MPUPPE — REGRA CRÍTICA\nA MPuppe trabalha com modelo de recorrência mensal customizado. NUNCA cite preços fixos.\nO objetivo é agendar uma reunião com o Dr. Rodrigo para entender a necessidade e montar uma proposta.\nPROIBIDO: prometer valores, prazos de entrega ou resultados jurídicos específicos.', 'Você atua pela MPuppe, boutique jurídica especializada em Direito Digital. Conhece regulação Bacen (IP), CVM 88, LGPD/GDPR, governança de IA (TAIO Officer) e operações de alta complexidade regulatória.'),
('AXIA', 'Axia Digital Solutions (infraestrutura fintech whitelabel)', E'## 🚫 PROCESSO AXIA — REGRA CRÍTICA\nA Axia fornece plataformas modulares. Primeiro módulo: R$ 14.900/mês, módulos adicionais: R$ 4.900/mês.\nO objetivo é entender o projeto do lead e agendar uma demo técnica.\nPROIBIDO: prometer customizações não listadas ou prazos de entrega sem consultar a equipe técnica.', 'Você atua pela Axia Digital Solutions, software house de infraestrutura fintech. Conhece plataformas whitelabel, digital banking, exchanges, wallets multichain, tokenização e payment gateways.');

-- ================================================
-- SEED: Instructions
-- ================================================
INSERT INTO public.ai_instructions (empresa, tipo, titulo, conteudo, ordem) VALUES
('ALL', 'PERSONA', 'Identidade Amélia', 'Amélia, 32 anos, economista, Grupo Blue Labs (3 anos). Atua em 4 verticais: Blue Cripto (IR), Tokeniza (RWA), MPuppe (Direito Digital) e Axia (Infraestrutura Fintech).', 1),
('ALL', 'TOM', 'Tom Padrão', 'Tom: profissional, acolhedor, direto. Nunca robótica.', 1),
('ALL', 'TOM', 'DISC D', 'Seja DIRETO e objetivo. Foque em RESULTADOS e números. Mensagens CURTAS. Evite rodeios.', 2),
('ALL', 'TOM', 'DISC I', 'Seja AMIGÁVEL e entusiasmado. Use HISTÓRIAS e exemplos de sucesso. Conecte emocionalmente.', 3),
('ALL', 'TOM', 'DISC S', 'Seja CALMO e acolhedor. Enfatize SEGURANÇA e estabilidade. Não apresse decisão.', 4),
('ALL', 'TOM', 'DISC C', 'Seja PRECISO e técnico. Forneça NÚMEROS, dados, prazos, comparativos.', 5),
('ALL', 'COMPLIANCE', 'Proibições Gerais', E'PROIBIDO: começar com nome do lead, elogiar perguntas, \"Perfeito!\", \"Entendi!\".\nPROIBIDO INVENTAR: Nunca cite planos, preços, valores ou produtos que NÃO estejam na seção PRODUTOS.\nPROIBIDO PROMETER ENVIO FUTURO: NUNCA diga \"vou te mandar\", \"já envio\".\nCOMPLIANCE: PROIBIDO prometer retorno, recomendar ativo, negociar preço, pressionar.', 1),
('ALL', 'COMPLIANCE', 'Regra de Ouro - Valores', E'Cite valores EXATAMENTE como aparecem na seção PRODUTOS. Não arredonde, não crie faixas.\nSe não encontrar o valor exato, diga: \"Vou confirmar o valor exato com a equipe.\"\nNUNCA diga \"geralmente\", \"em média\" para valores.', 2),
('ALL', 'COMPLIANCE', 'Ancoragem (Grounding)', E'Resposta DEVE ser baseada EXCLUSIVAMENTE nas informações da seção PRODUTOS.\nSe a informação NÃO estiver nos PRODUTOS, PROIBIDO inventar.\nNUNCA use conhecimento geral para complementar.', 3),
('ALL', 'CANAL', 'WhatsApp', 'Mensagens CURTAS (2-4 linhas). Tom conversacional. UMA pergunta por mensagem.', 1),
('ALL', 'CANAL', 'Email', 'Mensagens ESTRUTURADAS. Tom consultivo. Máx 3-4 parágrafos.', 2),
('ALL', 'PROCESSO', 'Escalação Rápida', 'Objetivo: entender contexto → identificar se lead pronto → ESCALAR. NÃO FAÇA OVERQUALIFICATION.', 1),
('ALL', 'PROCESSO', 'Fora do Horário', E'Time humano NÃO disponível (seg a sex, 8h-18h).\nNUNCA use ESCALAR_HUMANO fora do horário.\nConduza a venda sozinha. Use ENVIAR_RESPOSTA_AUTOMATICA.', 2),
('ALL', 'PROCESSO', 'Baixa Confiança RAG', 'Se não houver contexto relevante da Base de Conhecimento, responda: "Preciso confirmar com a equipe para te dar a informação exata."', 3);

-- ================================================
-- SEED: Routing Rules
-- ================================================
INSERT INTO public.ai_routing_rules (empresa, intent, condicao, acao, resposta_padrao, prioridade) VALUES
('TOKENIZA', 'INTERESSE_COMPRA', '{"patterns": ["quero investir", "quero aportar", "como faço para investir", "manda o contrato", "manda o pix", "onde pago", "quero fechar", "aceito", "to dentro", "bora", "quero comprar"]}', 'ENVIAR_RESPOSTA_AUTOMATICA', 'Que bom que quer investir! 🎉 O processo é todo feito pela nossa plataforma — é rápido e seguro. Acesse plataforma.tokeniza.com.br, crie sua conta e escolha a oferta que mais combina com você. Se tiver qualquer dúvida sobre as ofertas, estou aqui pra te ajudar! 😊', 10),
('ALL', 'DUVIDA_TECNICA', '{"estados_funil": ["QUALIFICACAO", "OBJECOES", "FECHAMENTO", "POS_VENDA"], "patterns": ["track record", "rentabilidade passada", "demonstração técnica", "cases de sucesso", "due diligence", "auditoria", "dados históricos", "contrato modelo", "cotação personalizada"]}', 'ESCALAR_HUMANO', 'Boa pergunta! Vou chamar alguém da equipe que pode te mostrar esses detalhes com mais profundidade. Um momento! 🙂', 5),
('ALL', 'OPT_OUT', '{}', 'MARCAR_OPT_OUT', NULL, 1),
('ALL', 'RECLAMACAO', '{}', 'ESCALAR_HUMANO', NULL, 2),
('ALL', 'AGENDAMENTO_REUNIAO', '{}', 'CRIAR_TAREFA_CLOSER', NULL, 3),
('ALL', 'SOLICITACAO_CONTATO', '{}', 'CRIAR_TAREFA_CLOSER', NULL, 4);
