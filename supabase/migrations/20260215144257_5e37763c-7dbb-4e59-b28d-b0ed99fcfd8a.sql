UPDATE lead_classifications
SET prioridade = 1,
    icp = 'BLUE_ALTO_TICKET_IR',
    score_interno = 65,
    updated_at = now()
WHERE lead_id = '202f5ba6-2ced-4dc0-b6de-693b00f4ee8a'
  AND empresa = 'BLUE';