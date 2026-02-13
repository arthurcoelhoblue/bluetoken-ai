
-- Fase 1: Migration SQL para Patch 4

-- 1. Adicionar is_active em contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_organization_id ON public.deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_empresa ON public.contacts(empresa);
CREATE INDEX IF NOT EXISTS idx_organizations_empresa ON public.organizations(empresa);

-- 3. View contacts_with_stats
CREATE OR REPLACE VIEW public.contacts_with_stats AS
SELECT
  c.*,
  o.nome AS org_nome,
  o.nome_fantasia AS org_nome_fantasia,
  p.nome AS owner_nome,
  p.avatar_url AS owner_avatar,
  COALESCE(d.deals_count, 0) AS deals_count,
  COALESCE(d.deals_abertos, 0) AS deals_abertos,
  COALESCE(d.deals_valor_total, 0) AS deals_valor_total
FROM public.contacts c
LEFT JOIN public.organizations o ON c.organization_id = o.id
LEFT JOIN public.profiles p ON c.owner_id = p.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS deals_count,
    COUNT(*) FILTER (WHERE status = 'ABERTO') AS deals_abertos,
    COALESCE(SUM(valor) FILTER (WHERE status = 'ABERTO'), 0) AS deals_valor_total
  FROM public.deals
  WHERE deals.contact_id = c.id
) d ON true;

-- 4. View organizations_with_stats
CREATE OR REPLACE VIEW public.organizations_with_stats AS
SELECT
  org.*,
  p.nome AS owner_nome,
  p.avatar_url AS owner_avatar,
  COALESCE(ct.contacts_count, 0) AS contacts_count,
  COALESCE(dl.deals_count, 0) AS deals_count,
  COALESCE(dl.deals_abertos, 0) AS deals_abertos,
  COALESCE(dl.deals_valor_total, 0) AS deals_valor_total
FROM public.organizations org
LEFT JOIN public.profiles p ON org.owner_id = p.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS contacts_count
  FROM public.contacts
  WHERE contacts.organization_id = org.id AND contacts.is_active = true
) ct ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS deals_count,
    COUNT(*) FILTER (WHERE status = 'ABERTO') AS deals_abertos,
    COALESCE(SUM(valor) FILTER (WHERE status = 'ABERTO'), 0) AS deals_valor_total
  FROM public.deals
  WHERE deals.organization_id = org.id
) dl ON true;
