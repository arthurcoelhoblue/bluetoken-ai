
-- Patch 11: Importação Pipedrive
-- Tabelas import_jobs, import_mapping + View

-- Tabela import_jobs
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'PIPEDRIVE_FULL',
  empresa public.empresa_tipo NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','PARTIAL')),
  total_records INT NOT NULL DEFAULT 0,
  imported INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  started_by UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on import_jobs"
  ON public.import_jobs FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Tabela import_mapping
CREATE TABLE public.import_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('DEAL','CONTACT','ORGANIZATION','PERSON')),
  source_id TEXT NOT NULL,
  target_id UUID NOT NULL,
  empresa public.empresa_tipo NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, source_id, empresa)
);

CREATE INDEX idx_import_mapping_source ON public.import_mapping(entity_type, source_id, empresa);
CREATE INDEX idx_import_mapping_target ON public.import_mapping(target_id);

ALTER TABLE public.import_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on import_mapping"
  ON public.import_mapping FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- View import_jobs_summary
CREATE OR REPLACE VIEW public.import_jobs_summary
WITH (security_invoker = true) AS
SELECT
  j.*,
  p.nome AS started_by_nome,
  (SELECT count(*) FROM public.import_mapping m WHERE m.import_job_id = j.id AND m.entity_type = 'ORGANIZATION') AS orgs_mapped,
  (SELECT count(*) FROM public.import_mapping m WHERE m.import_job_id = j.id AND m.entity_type = 'CONTACT') AS contacts_mapped,
  (SELECT count(*) FROM public.import_mapping m WHERE m.import_job_id = j.id AND m.entity_type = 'DEAL') AS deals_mapped
FROM public.import_jobs j
LEFT JOIN public.profiles p ON j.started_by = p.id
ORDER BY j.created_at DESC;
