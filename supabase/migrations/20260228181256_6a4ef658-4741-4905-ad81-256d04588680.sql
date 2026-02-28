
-- =============================================
-- TOKENIZA: Produtos (Product Knowledge)
-- =============================================
INSERT INTO public.product_knowledge (empresa, produto_id, produto_nome, descricao_curta, ativo) VALUES
('TOKENIZA', 'TOKENIZA_PLATFORM', 'Plataforma Tokeniza', 'Plataforma de tokenização de ativos reais (RWA). +7 mil investidores, R$30M TVL, taxa de 1.5%.', true),
('TOKENIZA', 'IMOVEL', 'Token Imobiliário', 'Tokens lastreados em imóveis com renda de aluguel. Entrada a partir de R$100.', true),
('TOKENIZA', 'AGRO', 'Token Agro', 'Tokens lastreados em operações do agronegócio com safra garantida.', true),
('TOKENIZA', 'FINANCE', 'Token Finance', 'Tokens de renda fixa tokenizada e crédito estruturado.', true),
('TOKENIZA', 'STARTUP', 'Token Startup', 'Equity tokens de startups em rodadas seed e Series A.', true),
('TOKENIZA', 'AUTO', 'Token Auto', 'Tokens lastreados em frotas e veículos com renda de locação.', true),
('TOKENIZA', 'ATLETA', 'Token Atleta', 'Fan tokens e tokens de performance de atletas profissionais.', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- TOKENIZA: Seções de Conhecimento
-- =============================================
INSERT INTO public.knowledge_sections (product_knowledge_id, tipo, titulo, conteudo, ordem)
SELECT pk.id, 'GERAL', 'Visão Geral da Tokeniza',
'A Tokeniza é uma plataforma de tokenização de ativos reais (RWA) regulada pela CVM. Conectamos emissores de tokens a mais de 7 mil investidores, com um TVL de R$30 milhões. Nossa taxa de intermediação é de 1.5% sobre o valor captado. Oferecemos um mercado de transações subsequentes para liquidez dos tokens.',
1
FROM product_knowledge pk WHERE pk.empresa = 'TOKENIZA' AND pk.produto_id = 'TOKENIZA_PLATFORM'
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_sections (product_knowledge_id, tipo, titulo, conteudo, ordem)
SELECT pk.id, 'PITCH', 'Pitch Comercial',
'A Tokeniza permite que empresas captem recursos de forma digital, rápida e regulada, tokenizando seus ativos reais. Com mais de 7 mil investidores cadastrados, R$30M em TVL e taxa de apenas 1.5%, somos a principal plataforma de RWA do Brasil. Nosso mercado de transações subsequentes garante liquidez para os investidores.',
1
FROM product_knowledge pk WHERE pk.empresa = 'TOKENIZA' AND pk.produto_id = 'TOKENIZA_PLATFORM'
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_sections (product_knowledge_id, tipo, titulo, conteudo, ordem)
SELECT pk.id, 'RISCOS', 'Riscos e Mitigações',
'Riscos principais: (1) Risco de crédito do emissor — mitigado por análise de crédito e garantias reais; (2) Risco de liquidez — mitigado pelo mercado de transações subsequentes; (3) Risco regulatório — mitigado por operação dentro do sandbox CVM e conformidade contínua; (4) Risco de mercado — inerente a qualquer investimento, diversificação recomendada.',
1
FROM product_knowledge pk WHERE pk.empresa = 'TOKENIZA' AND pk.produto_id = 'TOKENIZA_PLATFORM'
ON CONFLICT DO NOTHING;

INSERT INTO public.knowledge_sections (product_knowledge_id, tipo, titulo, conteudo, ordem)
SELECT pk.id, 'ESTRUTURA_JURIDICA', 'Estrutura Jurídica',
'Os tokens são emitidos como valores mobiliários sob regulação CVM (sandbox regulatório). Cada oferta possui SPE (Sociedade de Propósito Específico) dedicada, segregando os ativos do emissor. Os contratos são registrados em blockchain com validade jurídica. O mercado de transações subsequentes opera dentro do marco regulatório vigente.',
1
FROM product_knowledge pk WHERE pk.empresa = 'TOKENIZA' AND pk.produto_id = 'TOKENIZA_PLATFORM'
ON CONFLICT DO NOTHING;

-- =============================================
-- TOKENIZA: FAQs (8 perguntas)
-- =============================================
INSERT INTO public.knowledge_faq (empresa, pergunta, resposta, categoria, tags, fonte, status, visivel_amelia) VALUES
('TOKENIZA', 'O que é tokenização de ativos?', 'Tokenização é o processo de representar um ativo real (imóvel, recebível, equity) como um token digital em blockchain. Isso permite fracionamento, maior liquidez via mercado de transações subsequentes e acesso democrático a investimentos antes restritos.', 'Produto', ARRAY['tokenização','blockchain','RWA'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Qual o valor mínimo para investir?', 'O valor mínimo varia por oferta, mas temos tokens a partir de R$100. Isso permite que qualquer pessoa diversifique seus investimentos em ativos reais.', 'Comercial / Vendas', ARRAY['investimento','mínimo','entrada'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Como funciona o mercado de transações subsequentes?', 'O mercado de transações subsequentes permite que investidores negociem seus tokens com outros investidores antes do vencimento, proporcionando liquidez. Funciona dentro da plataforma Tokeniza, de forma regulada e transparente.', 'Produto', ARRAY['liquidez','mercado','transações subsequentes'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'A Tokeniza é regulada?', 'Sim. A Tokeniza opera dentro do sandbox regulatório da CVM (Comissão de Valores Mobiliários), seguindo todas as normas de emissão de valores mobiliários digitais.', 'Jurídico / Compliance', ARRAY['CVM','regulação','sandbox'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Quais os riscos de investir em tokens?', 'Como qualquer investimento, tokens possuem riscos: risco de crédito do emissor, risco de mercado e risco de liquidez. Mitigamos com análise de crédito rigorosa, garantias reais e nosso mercado de transações subsequentes.', 'Produto', ARRAY['riscos','investimento'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Qual a taxa cobrada pela Tokeniza?', 'A Tokeniza cobra uma taxa de 1.5% sobre o valor captado em cada oferta. Não há taxas ocultas para o investidor na compra primária.', 'Financeiro', ARRAY['taxa','custo','fee'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Quantos investidores a Tokeniza tem?', 'A Tokeniza conta com mais de 7 mil investidores cadastrados e um TVL (Total Value Locked) de R$30 milhões em ativos tokenizados.', 'Comercial / Vendas', ARRAY['investidores','TVL','base'], 'MANUAL', 'APROVADO', true),
('TOKENIZA', 'Como funciona o processo de emissão para empresas?', 'O processo envolve: (1) Análise de elegibilidade do ativo; (2) Estruturação jurídica com SPE dedicada; (3) Criação do token em blockchain; (4) Oferta na plataforma para +7 mil investidores; (5) Gestão pós-captação e mercado de transações subsequentes.', 'Processo Interno', ARRAY['emissão','processo','empresa'], 'MANUAL', 'APROVADO', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- TOKENIZA: Templates de Mensagem (14)
-- =============================================
-- WhatsApp Templates (7)
INSERT INTO public.message_templates (empresa, canal, codigo, nome, conteudo, ativo, meta_status, meta_language, descricao) VALUES
('TOKENIZA', 'WHATSAPP', 'tkn_saudacao_inbound', 'Saudação Inbound Tokeniza', 'Olá {{1}}! 👋 Sou da equipe Tokeniza. Vi que você demonstrou interesse em tokenização de ativos reais. Com mais de 7 mil investidores e R$30M em TVL, somos a principal plataforma de RWA do Brasil. Posso te ajudar a entender como funciona?', true, 'LOCAL', 'pt_BR', 'Primeiro contato com lead inbound'),
('TOKENIZA', 'WHATSAPP', 'tkn_followup_1', 'Follow-up 1 Tokeniza', 'Oi {{1}}, tudo bem? Queria retomar nossa conversa sobre a Tokeniza. Temos ofertas com entrada a partir de R$100 e um mercado de transações subsequentes para garantir liquidez. Qual tipo de ativo te interessa mais: imóveis, agro ou renda fixa?', true, 'LOCAL', 'pt_BR', 'Primeiro follow-up após contato inicial'),
('TOKENIZA', 'WHATSAPP', 'tkn_followup_2', 'Follow-up 2 Tokeniza', 'Olá {{1}}! Passando para compartilhar que nossa plataforma já captou mais de R$30M com taxa de apenas 1.5%. Muitos investidores começaram com valores pequenos e hoje diversificam em múltiplos tokens. Gostaria de conhecer as ofertas disponíveis?', true, 'LOCAL', 'pt_BR', 'Segundo follow-up com dados de autoridade'),
('TOKENIZA', 'WHATSAPP', 'tkn_mql_quente', 'MQL Quente Tokeniza', 'Oi {{1}}! Percebi que você tem navegado bastante na plataforma e demonstrado alto interesse. Temos uma oferta especial se encerando em breve. Posso te apresentar os detalhes e tirar qualquer dúvida?', true, 'LOCAL', 'pt_BR', 'Abordagem para MQL com score alto'),
('TOKENIZA', 'WHATSAPP', 'tkn_carrinho_abandonado', 'Carrinho Abandonado Tokeniza', 'Oi {{1}}! Vi que você iniciou o investimento em {{2}} mas não concluiu. O processo é 100% digital e leva menos de 5 minutos. Se tiver qualquer dúvida sobre o ativo ou o processo, estou aqui para ajudar!', true, 'LOCAL', 'pt_BR', 'Recuperação de carrinho abandonado'),
('TOKENIZA', 'WHATSAPP', 'tkn_upsell', 'Upsell Tokeniza', 'Olá {{1}}! Como investidor da Tokeniza, quero te apresentar uma nova oferta de {{2}} que complementa sua carteira. Com nosso mercado de transações subsequentes, você tem flexibilidade total. Quer saber mais?', true, 'LOCAL', 'pt_BR', 'Oferta de novo token para investidor existente'),
('TOKENIZA', 'WHATSAPP', 'tkn_ultimo_contato', 'Último Contato Tokeniza', 'Oi {{1}}, este é meu último contato por enquanto. Caso mude de ideia sobre investir em ativos tokenizados, a plataforma está sempre disponível em plataforma.tokeniza.com.br. Obrigado pelo interesse! 🙏', true, 'LOCAL', 'pt_BR', 'Mensagem de encerramento de cadência')
ON CONFLICT DO NOTHING;

-- Email Templates (7)
INSERT INTO public.message_templates (empresa, canal, codigo, nome, conteudo, ativo, meta_status, meta_language, assunto_template, descricao) VALUES
('TOKENIZA', 'EMAIL', 'tkn_email_boas_vindas', 'Email Boas-Vindas Tokeniza', 'Olá {{nome}},

Seja bem-vindo(a) à Tokeniza! Somos a principal plataforma de tokenização de ativos reais do Brasil, com mais de 7 mil investidores e R$30M em TVL.

O que oferecemos:
• Tokens de imóveis, agro, renda fixa e mais
• Entrada a partir de R$100
• Mercado de transações subsequentes para liquidez
• Taxa de apenas 1.5%
• Regulação CVM (sandbox regulatório)

Acesse plataforma.tokeniza.com.br para conhecer as ofertas disponíveis.

Atenciosamente,
Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Bem-vindo à Tokeniza - Invista em ativos reais tokenizados', 'Email de boas-vindas para novo lead'),
('TOKENIZA', 'EMAIL', 'tkn_email_followup', 'Email Follow-up Tokeniza', 'Olá {{nome}},

Gostaria de retomar nosso contato. A Tokeniza oferece uma forma inovadora e regulada de investir em ativos reais.

Nossos números:
• +7 mil investidores ativos
• R$30M em TVL
• Taxa de 1.5% — sem custos ocultos

Nosso mercado de transações subsequentes garante que você possa negociar seus tokens com outros investidores a qualquer momento.

Ficou com alguma dúvida? Responda este email ou acesse plataforma.tokeniza.com.br.

Abraços,
Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Tokeniza: Ativos reais ao seu alcance', 'Email de follow-up'),
('TOKENIZA', 'EMAIL', 'tkn_email_autoridade', 'Email Autoridade Tokeniza', 'Olá {{nome}},

Você sabia que a tokenização de ativos reais (RWA) é uma das tendências mais fortes do mercado financeiro global?

A Tokeniza está na vanguarda desse movimento no Brasil:
• Regulados pela CVM (sandbox regulatório)
• +7 mil investidores confiam na plataforma
• R$30M em ativos tokenizados
• Mercado de transações subsequentes para liquidez

Nosso modelo com taxa de 1.5% é transparente e competitivo.

Vamos conversar sobre como diversificar seus investimentos?

Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'O futuro dos investimentos já chegou — Tokeniza', 'Email de autoridade e educação'),
('TOKENIZA', 'EMAIL', 'tkn_email_carrinho', 'Email Carrinho Abandonado Tokeniza', 'Olá {{nome}},

Notamos que você iniciou o investimento em {{oferta}} mas não concluiu o processo.

Sabemos que investir é uma decisão importante. Por isso:
• O processo é 100% digital e seguro
• Operamos sob regulação da CVM
• Seu investimento fica registrado em blockchain
• Você pode negociar no mercado de transações subsequentes

Precisa de ajuda? Responda este email ou acesse plataforma.tokeniza.com.br.

Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Seu investimento na Tokeniza está esperando por você', 'Email de recuperação de carrinho'),
('TOKENIZA', 'EMAIL', 'tkn_email_upsell', 'Email Upsell Tokeniza', 'Olá {{nome}},

Como investidor da Tokeniza, temos uma novidade exclusiva para você: uma nova oferta de {{categoria}} acaba de ser lançada na plataforma.

Por que diversificar:
• Reduz risco da carteira
• Acesso a diferentes classes de ativos reais
• Liquidez via mercado de transações subsequentes
• Mesma taxa competitiva de 1.5%

Confira em plataforma.tokeniza.com.br.

Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Nova oferta exclusiva para investidores Tokeniza', 'Email de upsell para investidor existente'),
('TOKENIZA', 'EMAIL', 'tkn_email_newsletter', 'Email Newsletter Tokeniza', 'Olá {{nome}},

Confira as novidades da Tokeniza:

📊 Mercado: O mercado de RWA cresce globalmente. A Tokeniza já alcançou R$30M em TVL com +7 mil investidores.

🆕 Novas ofertas disponíveis na plataforma

💡 Dica: Diversifique sua carteira com tokens de diferentes categorias. Use nosso mercado de transações subsequentes para rebalancear quando necessário.

Acesse plataforma.tokeniza.com.br.

Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Tokeniza News: Novidades e oportunidades', 'Newsletter mensal'),
('TOKENIZA', 'EMAIL', 'tkn_email_encerramento', 'Email Encerramento Tokeniza', 'Olá {{nome}},

Este é nosso último contato por enquanto. Respeitamos seu tempo e suas decisões.

Caso decida explorar a tokenização de ativos reais no futuro, nossa plataforma estará sempre disponível em plataforma.tokeniza.com.br.

Dados que falam por si: +7 mil investidores, R$30M TVL, taxa de 1.5%.

Obrigado pelo interesse!

Equipe Tokeniza', true, 'LOCAL', 'pt_BR', 'Tokeniza: Estaremos aqui quando precisar', 'Email de encerramento de cadência')
ON CONFLICT DO NOTHING;

-- =============================================
-- TOKENIZA: Cadências (4)
-- =============================================
INSERT INTO public.cadences (empresa, codigo, nome, descricao, ativo, canal_principal) VALUES
('TOKENIZA', 'TOKENIZA_INBOUND_LEAD_NOVO', 'Inbound Lead Novo', 'Cadência para novos leads que demonstraram interesse na plataforma Tokeniza', true, 'WHATSAPP'),
('TOKENIZA', 'TOKENIZA_MQL_QUENTE', 'MQL Quente', 'Cadência para leads com alto score de engajamento', true, 'WHATSAPP'),
('TOKENIZA', 'TOKENIZA_CARRINHO_ABANDONADO', 'Carrinho Abandonado', 'Cadência para leads que iniciaram investimento mas não concluíram', true, 'WHATSAPP'),
('TOKENIZA', 'TOKENIZA_UPSELL', 'Upsell Investidor', 'Cadência para oferecer novas ofertas a investidores existentes', true, 'WHATSAPP')
ON CONFLICT DO NOTHING;

-- =============================================
-- TOKENIZA: Steps das Cadências
-- =============================================
-- Inbound Lead Novo (5 steps)
INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 1, 0, 'WHATSAPP', 'tkn_saudacao_inbound', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 2, 1440, 'EMAIL', 'tkn_email_boas_vindas', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 3, 4320, 'WHATSAPP', 'tkn_followup_1', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 4, 10080, 'EMAIL', 'tkn_email_autoridade', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 5, 20160, 'WHATSAPP', 'tkn_ultimo_contato', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'
ON CONFLICT DO NOTHING;

-- MQL Quente (3 steps)
INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 1, 0, 'WHATSAPP', 'tkn_mql_quente', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_MQL_QUENTE'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 2, 2880, 'WHATSAPP', 'tkn_followup_2', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_MQL_QUENTE'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 3, 7200, 'EMAIL', 'tkn_email_followup', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_MQL_QUENTE'
ON CONFLICT DO NOTHING;

-- Carrinho Abandonado (3 steps)
INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 1, 60, 'WHATSAPP', 'tkn_carrinho_abandonado', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_CARRINHO_ABANDONADO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 2, 1440, 'EMAIL', 'tkn_email_carrinho', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_CARRINHO_ABANDONADO'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 3, 4320, 'WHATSAPP', 'tkn_followup_2', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_CARRINHO_ABANDONADO'
ON CONFLICT DO NOTHING;

-- Upsell (3 steps)
INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 1, 0, 'WHATSAPP', 'tkn_upsell', true
FROM cadences c WHERE c.codigo = 'TOKENIZA_UPSELL'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 2, 2880, 'EMAIL', 'tkn_email_upsell', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_UPSELL'
ON CONFLICT DO NOTHING;

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder)
SELECT c.id, 3, 7200, 'EMAIL', 'tkn_email_newsletter', false
FROM cadences c WHERE c.codigo = 'TOKENIZA_UPSELL'
ON CONFLICT DO NOTHING;
