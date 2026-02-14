
-- 1. Adicionar coluna is_priority
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- 2. Marcar "Atacar agora!" da BLUE
UPDATE public.pipeline_stages SET is_priority = true WHERE id = 'e7cca7b0-941a-4522-9543-fc0d975b9dac';

-- 3. Reordenar stages TOKENIZA de trás pra frente (evita conflito unique)
UPDATE public.pipeline_stages SET posicao = 9 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 8;
UPDATE public.pipeline_stages SET posicao = 8 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 7 AND nome != 'Atacar agora!';
UPDATE public.pipeline_stages SET posicao = 7 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 6 AND nome != 'Atacar agora!';
UPDATE public.pipeline_stages SET posicao = 6 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 5 AND nome != 'Atacar agora!';
UPDATE public.pipeline_stages SET posicao = 5 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 4 AND nome != 'Atacar agora!';
UPDATE public.pipeline_stages SET posicao = 4 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 3 AND nome != 'Atacar agora!';
UPDATE public.pipeline_stages SET posicao = 3 WHERE pipeline_id = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c' AND posicao = 2 AND nome != 'Atacar agora!';

-- 4. Inserir "Atacar agora!" na posição 2
INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost, is_priority)
VALUES ('5bbac98b-5ae9-4b31-9b7f-896d7b732a2c', 'Atacar agora!', 2, '#f59e0b', false, false, true);

-- 5. Cadências de aquecimento
INSERT INTO public.cadences (codigo, nome, descricao, empresa, canal_principal, ativo)
VALUES (
  'WARMING_INBOUND_FRIO_BLUE',
  'Aquecimento Inbound Frio (Blue)',
  'Cadência automática para leads frios inbound: WhatsApp Amélia + Email + Follow-up',
  'BLUE', 'WHATSAPP', true
);

INSERT INTO public.cadences (codigo, nome, descricao, empresa, canal_principal, ativo)
VALUES (
  'WARMING_INBOUND_FRIO_TOKENIZA',
  'Aquecimento Inbound Frio (Tokeniza)',
  'Cadência automática para leads frios inbound: WhatsApp Amélia + Email + Follow-up',
  'TOKENIZA', 'WHATSAPP', true
);

-- Steps BLUE
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 1, 'WHATSAPP', 'SAUDACAO_INBOUND', 0, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_BLUE';
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 2, 'EMAIL', 'APRESENTACAO_BLUE', 360, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_BLUE';
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 3, 'WHATSAPP', 'FOLLOWUP_INBOUND', 2880, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_BLUE';

-- Steps TOKENIZA
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 1, 'WHATSAPP', 'SAUDACAO_INBOUND', 0, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_TOKENIZA';
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 2, 'EMAIL', 'APRESENTACAO_TOKENIZA', 360, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_TOKENIZA';
INSERT INTO public.cadence_steps (cadence_id, ordem, canal, template_codigo, offset_minutos, parar_se_responder)
SELECT id, 3, 'WHATSAPP', 'FOLLOWUP_INBOUND', 2880, true FROM public.cadences WHERE codigo = 'WARMING_INBOUND_FRIO_TOKENIZA';
