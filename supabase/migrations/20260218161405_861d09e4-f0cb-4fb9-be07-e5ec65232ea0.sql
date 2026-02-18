
-- Migração 2: Dados para novas empresas (enum values já commitados)

-- integration_company_config
INSERT INTO integration_company_config (empresa, channel, enabled)
VALUES
  ('MPUPPE', 'bluechat', true),
  ('MPUPPE', 'mensageria', false),
  ('AXIA', 'bluechat', true),
  ('AXIA', 'mensageria', false)
ON CONFLICT DO NOTHING;

-- Pipeline MPuppe
INSERT INTO pipelines (id, empresa, nome, descricao, ativo)
VALUES ('f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'MPUPPE', 'Pipeline MPuppe', 'Pipeline principal da MPuppe', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pipeline_stages (id, pipeline_id, nome, posicao, cor, is_won, is_lost)
VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'Frio', 1, '#94a3b8', false, false),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'Morno', 2, '#f59e0b', false, false),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'Quente', 3, '#ef4444', false, false),
  ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'Ganho', 4, '#22c55e', true, false),
  ('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', 'Perdido', 5, '#6b7280', false, true)
ON CONFLICT (id) DO NOTHING;

-- Pipeline Axia
INSERT INTO pipelines (id, empresa, nome, descricao, ativo)
VALUES ('a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'AXIA', 'Pipeline Axia', 'Pipeline principal da Axia', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pipeline_stages (id, pipeline_id, nome, posicao, cor, is_won, is_lost)
VALUES
  ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'Frio', 1, '#94a3b8', false, false),
  ('07b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'Morno', 2, '#f59e0b', false, false),
  ('18c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'Quente', 3, '#ef4444', false, false),
  ('29d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'Ganho', 4, '#22c55e', true, false),
  ('3ae1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d', 'Perdido', 5, '#6b7280', false, true)
ON CONFLICT (id) DO NOTHING;
