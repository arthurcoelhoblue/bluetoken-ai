-- Criar enum para origem da classificação
CREATE TYPE classificacao_origem AS ENUM ('AUTOMATICA', 'MANUAL');

-- Adicionar colunas para rastrear origem e override manual
ALTER TABLE lead_classifications 
ADD COLUMN origem classificacao_origem NOT NULL DEFAULT 'AUTOMATICA',
ADD COLUMN override_por_user_id uuid REFERENCES auth.users(id),
ADD COLUMN override_motivo text;

-- Criar índice para busca por origem
CREATE INDEX idx_lead_classifications_origem ON lead_classifications(origem);

-- Comentários para documentação
COMMENT ON COLUMN lead_classifications.origem IS 'AUTOMATICA = classificado pelo sistema, MANUAL = override por usuário';
COMMENT ON COLUMN lead_classifications.override_por_user_id IS 'ID do usuário que fez o override manual';
COMMENT ON COLUMN lead_classifications.override_motivo IS 'Justificativa do override manual';