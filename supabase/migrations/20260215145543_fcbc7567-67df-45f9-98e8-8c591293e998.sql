
UPDATE lead_conversation_state
SET framework_data = jsonb_set(
  COALESCE(framework_data::jsonb, '{}'::jsonb),
  '{spin}',
  '{"s": "Reunião prévia com Michel, quer orçamento para declaração de IR cripto, 1 ano de declaração", "p": "Precisa declarar impostos sobre operações cripto"}'::jsonb
),
updated_at = now()
WHERE lead_id = '202f5ba6-2ced-4dc0-b6de-693b00f4ee8a'
AND empresa = 'BLUE';
