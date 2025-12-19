-- Cancelar cadências ativas de leads incontatáveis
-- (leads sem telefone válido E com email placeholder ou sem email)

UPDATE lead_cadence_runs 
SET 
  status = 'CANCELADA',
  updated_at = NOW()
WHERE status = 'ATIVA'
  AND lead_id IN (
    SELECT lc.lead_id 
    FROM lead_contacts lc
    WHERE lc.empresa = lead_cadence_runs.empresa
      AND (
        -- Sem telefone válido
        lc.telefone_valido = false OR lc.telefone_valido IS NULL OR lc.telefone_e164 IS NULL
      )
      AND (
        -- E sem email válido (placeholder ou ausente)
        lc.email_placeholder = true OR lc.email IS NULL OR lc.email = ''
      )
  );

-- Inserir issue para esses leads que foram cancelados
INSERT INTO lead_contact_issues (lead_id, empresa, issue_tipo, severidade, mensagem)
SELECT DISTINCT 
  lc.lead_id,
  lc.empresa,
  'SEM_CANAL_CONTATO'::lead_contact_issue_tipo,
  'ALTA',
  'Cadência cancelada automaticamente: lead sem canal de contato válido (telefone inválido/ausente e email placeholder).'
FROM lead_contacts lc
WHERE (lc.telefone_valido = false OR lc.telefone_valido IS NULL OR lc.telefone_e164 IS NULL)
  AND (lc.email_placeholder = true OR lc.email IS NULL OR lc.email = '')
  AND EXISTS (
    SELECT 1 FROM lead_cadence_runs lcr 
    WHERE lcr.lead_id = lc.lead_id 
      AND lcr.empresa = lc.empresa
      AND lcr.status = 'CANCELADA'
      AND lcr.updated_at > NOW() - INTERVAL '1 minute'
  )
  AND NOT EXISTS (
    SELECT 1 FROM lead_contact_issues lci
    WHERE lci.lead_id = lc.lead_id
      AND lci.empresa = lc.empresa
      AND lci.issue_tipo = 'SEM_CANAL_CONTATO'
      AND lci.resolvido = false
  );