-- Revert false opt-out for BioJoias Brazil (Tokeniza) caused by DESQUALIFICAR_LEAD → MARCAR_OPT_OUT bug
UPDATE lead_contacts SET opt_out = false, opt_out_em = null, opt_out_motivo = null, updated_at = now()
WHERE lead_id = 'inbound_12240310_1772742261677' AND empresa = 'TOKENIZA';

UPDATE contacts SET opt_out = false, opt_out_em = null, opt_out_motivo = null, updated_at = now()
WHERE id = 'd232212a-ad6c-492a-8b47-7f4787b62f7d';