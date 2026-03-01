
CREATE OR REPLACE FUNCTION public.fn_sync_lead_to_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_contact_id UUID;
BEGIN
  -- Check if a contact already exists with the same telefone_e164 + empresa (to avoid unique violation)
  IF NEW.telefone_e164 IS NOT NULL THEN
    SELECT id INTO v_existing_contact_id
    FROM public.contacts
    WHERE telefone_e164 = NEW.telefone_e164
      AND empresa = NEW.empresa
      AND is_active = true
    LIMIT 1;

    IF v_existing_contact_id IS NOT NULL THEN
      -- Contact already exists with this phone, just update legacy_lead_id if missing
      UPDATE public.contacts SET
        legacy_lead_id = COALESCE(contacts.legacy_lead_id, NEW.lead_id),
        nome = COALESCE(NULLIF(NEW.nome, ''), contacts.nome),
        primeiro_nome = COALESCE(NEW.primeiro_nome, contacts.primeiro_nome),
        email = COALESCE(NEW.email, contacts.email),
        telefone = COALESCE(NEW.telefone, contacts.telefone),
        ddi = COALESCE(NEW.ddi, contacts.ddi),
        numero_nacional = COALESCE(NEW.numero_nacional, contacts.numero_nacional),
        telefone_valido = COALESCE(NEW.telefone_valido, contacts.telefone_valido),
        opt_out = COALESCE(NEW.opt_out, contacts.opt_out),
        opt_out_em = COALESCE(NEW.opt_out_em, contacts.opt_out_em),
        opt_out_motivo = COALESCE(NEW.opt_out_motivo, contacts.opt_out_motivo),
        score_marketing = COALESCE(NEW.score_marketing, contacts.score_marketing),
        prioridade_marketing = COALESCE(NEW.prioridade_marketing, contacts.prioridade_marketing),
        linkedin_url = COALESCE(NEW.linkedin_url, contacts.linkedin_url),
        linkedin_cargo = COALESCE(NEW.linkedin_cargo, contacts.linkedin_cargo),
        linkedin_empresa = COALESCE(NEW.linkedin_empresa, contacts.linkedin_empresa),
        linkedin_setor = COALESCE(NEW.linkedin_setor, contacts.linkedin_setor),
        origem_telefone = COALESCE(NEW.origem_telefone, contacts.origem_telefone),
        pessoa_id = COALESCE(NEW.pessoa_id, contacts.pessoa_id),
        owner_id = COALESCE(NEW.owner_id, contacts.owner_id),
        updated_at = now()
      WHERE id = v_existing_contact_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Normal path: insert or update by legacy_lead_id
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
