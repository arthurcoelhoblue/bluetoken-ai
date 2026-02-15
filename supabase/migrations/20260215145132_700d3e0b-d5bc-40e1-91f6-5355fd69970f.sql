UPDATE lead_classifications
SET justificativa = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        justificativa::jsonb,
        '{score_breakdown,base_temperatura}', '30'
      ),
      '{score_breakdown,bonus_icp}', '10'
    ),
    '{score_breakdown,total}', '65'
  ),
  '{icp_razao}', '"Promovido para BLUE_ALTO_TICKET_IR por intent INTERESSE_COMPRA com confiança 1.0 (upgrade comportamental)."'
)
WHERE lead_id = '202f5ba6-2ced-4dc0-b6de-693b00f4ee8a'
  AND empresa = 'BLUE';