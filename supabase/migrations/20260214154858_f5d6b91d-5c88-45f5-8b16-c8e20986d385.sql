
-- ========================================
-- PATCH 8.1: Leads vs Contacts Unification
-- ========================================

-- 1. Add missing columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telefone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS ddi TEXT,
  ADD COLUMN IF NOT EXISTS numero_nacional TEXT,
  ADD COLUMN IF NOT EXISTS telefone_valido BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS opt_out BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_motivo TEXT,
  ADD COLUMN IF NOT EXISTS score_marketing INTEGER,
  ADD COLUMN IF NOT EXISTS prioridade_marketing TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_cargo TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_empresa TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_setor TEXT,
  ADD COLUMN IF NOT EXISTS origem_telefone TEXT DEFAULT 'MANUAL';

-- 2. Deduplicate legacy_lead_id in contacts
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY legacy_lead_id ORDER BY created_at ASC) as rn
  FROM public.contacts
  WHERE legacy_lead_id IS NOT NULL
)
UPDATE public.contacts
SET legacy_lead_id = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_legacy_lead_id_unique
  ON public.contacts (legacy_lead_id)
  WHERE legacy_lead_id IS NOT NULL;

-- 4. Migrate lead_contacts data
INSERT INTO public.contacts (
  legacy_lead_id, empresa, nome, primeiro_nome, email, telefone,
  telefone_e164, ddi, numero_nacional, telefone_valido,
  opt_out, opt_out_em, opt_out_motivo,
  score_marketing, prioridade_marketing,
  linkedin_url, linkedin_cargo, linkedin_empresa, linkedin_setor,
  origem_telefone, pessoa_id, owner_id,
  canal_origem, tipo
)
SELECT DISTINCT ON (lc.lead_id)
  lc.lead_id, lc.empresa,
  COALESCE(lc.nome, 'Lead ' || LEFT(lc.lead_id, 8)),
  lc.primeiro_nome, lc.email, lc.telefone,
  lc.telefone_e164, lc.ddi, lc.numero_nacional, lc.telefone_valido,
  lc.opt_out, lc.opt_out_em, lc.opt_out_motivo,
  lc.score_marketing, lc.prioridade_marketing,
  lc.linkedin_url, lc.linkedin_cargo, lc.linkedin_empresa, lc.linkedin_setor,
  lc.origem_telefone, lc.pessoa_id, lc.owner_id,
  'SGT', 'LEAD'
FROM public.lead_contacts lc
WHERE NOT EXISTS (
  SELECT 1 FROM public.contacts c WHERE c.legacy_lead_id = lc.lead_id
)
ORDER BY lc.lead_id, lc.updated_at DESC
ON CONFLICT (legacy_lead_id) WHERE legacy_lead_id IS NOT NULL DO NOTHING;

-- 5. Sync trigger function
CREATE OR REPLACE FUNCTION public.fn_sync_lead_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.contacts (
    legacy_lead_id, empresa, nome, primeiro_nome, email, telefone,
    telefone_e164, ddi, numero_nacional, telefone_valido,
    opt_out, opt_out_em, opt_out_motivo,
    score_marketing, prioridade_marketing,
    linkedin_url, linkedin_cargo, linkedin_empresa, linkedin_setor,
    origem_telefone, pessoa_id, owner_id,
    canal_origem, tipo
  ) VALUES (
    NEW.lead_id, NEW.empresa,
    COALESCE(NEW.nome, 'Lead ' || LEFT(NEW.lead_id, 8)),
    NEW.primeiro_nome, NEW.email, NEW.telefone,
    NEW.telefone_e164, NEW.ddi, NEW.numero_nacional, NEW.telefone_valido,
    NEW.opt_out, NEW.opt_out_em, NEW.opt_out_motivo,
    NEW.score_marketing, NEW.prioridade_marketing,
    NEW.linkedin_url, NEW.linkedin_cargo, NEW.linkedin_empresa, NEW.linkedin_setor,
    NEW.origem_telefone, NEW.pessoa_id, NEW.owner_id,
    'SGT', 'LEAD'
  )
  ON CONFLICT (legacy_lead_id) WHERE legacy_lead_id IS NOT NULL
  DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, contacts.nome),
    primeiro_nome = COALESCE(EXCLUDED.primeiro_nome, contacts.primeiro_nome),
    email = COALESCE(EXCLUDED.email, contacts.email),
    telefone = COALESCE(EXCLUDED.telefone, contacts.telefone),
    telefone_e164 = COALESCE(EXCLUDED.telefone_e164, contacts.telefone_e164),
    ddi = COALESCE(EXCLUDED.ddi, contacts.ddi),
    numero_nacional = COALESCE(EXCLUDED.numero_nacional, contacts.numero_nacional),
    telefone_valido = COALESCE(EXCLUDED.telefone_valido, contacts.telefone_valido),
    opt_out = COALESCE(EXCLUDED.opt_out, contacts.opt_out),
    opt_out_em = COALESCE(EXCLUDED.opt_out_em, contacts.opt_out_em),
    opt_out_motivo = COALESCE(EXCLUDED.opt_out_motivo, contacts.opt_out_motivo),
    score_marketing = COALESCE(EXCLUDED.score_marketing, contacts.score_marketing),
    prioridade_marketing = COALESCE(EXCLUDED.prioridade_marketing, contacts.prioridade_marketing),
    linkedin_url = COALESCE(EXCLUDED.linkedin_url, contacts.linkedin_url),
    linkedin_cargo = COALESCE(EXCLUDED.linkedin_cargo, contacts.linkedin_cargo),
    linkedin_empresa = COALESCE(EXCLUDED.linkedin_empresa, contacts.linkedin_empresa),
    linkedin_setor = COALESCE(EXCLUDED.linkedin_setor, contacts.linkedin_setor),
    origem_telefone = COALESCE(EXCLUDED.origem_telefone, contacts.origem_telefone),
    pessoa_id = COALESCE(EXCLUDED.pessoa_id, contacts.pessoa_id),
    owner_id = COALESCE(EXCLUDED.owner_id, contacts.owner_id),
    updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_lead_contact ON public.lead_contacts;
CREATE TRIGGER trg_sync_lead_contact
  AFTER INSERT OR UPDATE ON public.lead_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_lead_to_contact();

-- 6. DROP and recreate view (cannot add columns with CREATE OR REPLACE)
DROP VIEW IF EXISTS public.contacts_with_stats;
CREATE VIEW public.contacts_with_stats
WITH (security_invoker = true)
AS
SELECT
  c.id, c.pessoa_id, c.empresa, c.nome, c.email, c.telefone,
  c.owner_id, c.tags, c.tipo, c.canal_origem, c.legacy_lead_id,
  c.notas, c.created_at, c.updated_at, c.organization_id,
  c.primeiro_nome, c.sobrenome, c.cpf, c.rg, c.telegram,
  c.endereco, c.foto_url, c.is_cliente, c.is_active,
  c.telefone_e164, c.telefone_valido, c.opt_out,
  c.score_marketing, c.prioridade_marketing,
  c.linkedin_url, c.linkedin_cargo, c.linkedin_empresa, c.linkedin_setor,
  c.origem_telefone,
  o.nome AS org_nome, o.nome_fantasia AS org_nome_fantasia,
  p.nome AS owner_nome, p.avatar_url AS owner_avatar,
  COALESCE(d.deals_count, 0::bigint) AS deals_count,
  COALESCE(d.deals_abertos, 0::bigint) AS deals_abertos,
  COALESCE(d.deals_valor_total, 0::numeric) AS deals_valor_total
FROM contacts c
  LEFT JOIN organizations o ON c.organization_id = o.id
  LEFT JOIN profiles p ON c.owner_id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS deals_count,
      count(*) FILTER (WHERE deals.status = 'ABERTO') AS deals_abertos,
      COALESCE(sum(deals.valor) FILTER (WHERE deals.status = 'ABERTO'), 0) AS deals_valor_total
    FROM deals WHERE deals.contact_id = c.id
  ) d ON true;
