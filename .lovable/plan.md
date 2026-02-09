
# Controle de Integrações por Empresa (Blue Chat vs Mensageria)

## Problema Atual
As integrações são configuradas globalmente -- um único registro `enabled: true/false` para cada integração. Isso impede controlar qual empresa usa Blue Chat e qual usa Mensageria. Alem disso, nao existe regra de exclusividade entre Blue Chat e Mensageria.

## Solucao

### 1. Banco de Dados - Nova estrutura por empresa

Criar uma nova tabela `integration_company_config` que armazena a configuracao de integracao por empresa:

```text
integration_company_config
+-----------+---------------+---------+-----------+
| id (uuid) | empresa       | channel | enabled   |
|           | (empresa_tipo)| (text)  | (boolean) |
+-----------+---------------+---------+-----------+
```

- `empresa`: TOKENIZA ou BLUE
- `channel`: 'bluechat' ou 'mensageria' (as integracoes que sao mutuamente exclusivas)
- `enabled`: se esta ativa para aquela empresa
- Constraint UNIQUE em (empresa, channel)

Tambem adicionar uma constraint de trigger que garanta que para cada empresa, apenas uma das duas (bluechat ou mensageria) pode estar `enabled = true` ao mesmo tempo.

### 2. Tipos TypeScript

Atualizar `src/types/settings.ts`:
- Adicionar interface `IntegrationCompanyConfig` com campos empresa/channel/enabled
- Adicionar propriedade `mutuallyExclusive` na `IntegrationInfo` para marcar bluechat e mensageria como grupo exclusivo
- Adicionar propriedade `perCompany: boolean` para identificar integrações que precisam de controle por empresa

### 3. Hook `useIntegrationCompanyConfig`

Novo hook para gerenciar configs por empresa:
- Query em `integration_company_config` 
- Mutation de toggle que, ao ativar bluechat para empresa X, automaticamente desativa mensageria para empresa X (e vice-versa)
- Feedback visual via toast informando que a outra integracao foi desativada

### 4. UI - Tab de Integracoes

Atualizar `IntegrationsTab.tsx`:
- Para Blue Chat e Mensageria, ao inves de um unico Switch, mostrar **dois switches** (um por empresa: TOKENIZA e BLUE)
- Incluir alerta visual explicando a regra de exclusividade: "Blue Chat e Mensageria sao mutuamente exclusivos por empresa"
- Ao ativar um, o outro e desativado automaticamente com toast de confirmacao

### 5. Backend - Edge Functions

Atualizar `whatsapp-inbound`, `bluechat-inbound` e `whatsapp-send` para consultar `integration_company_config` e verificar se a integracao esta habilitada para a empresa do lead antes de processar a mensagem.

---

## Detalhes Tecnicos

### Migracao SQL

```sql
CREATE TABLE public.integration_company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa empresa_tipo NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('bluechat', 'mensageria')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (empresa, channel)
);

ALTER TABLE public.integration_company_config ENABLE ROW LEVEL SECURITY;

-- Somente admins podem ler/modificar
CREATE POLICY "Admins can manage integration_company_config"
  ON public.integration_company_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Seed inicial
INSERT INTO integration_company_config (empresa, channel, enabled) VALUES
  ('BLUE', 'bluechat', true),
  ('BLUE', 'mensageria', false),
  ('TOKENIZA', 'bluechat', false),
  ('TOKENIZA', 'mensageria', true);

-- Trigger de exclusividade
CREATE OR REPLACE FUNCTION enforce_channel_exclusivity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.enabled = true THEN
    UPDATE integration_company_config
    SET enabled = false, updated_at = now()
    WHERE empresa = NEW.empresa
      AND channel != NEW.channel
      AND enabled = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_channel_exclusivity
  AFTER INSERT OR UPDATE ON integration_company_config
  FOR EACH ROW EXECUTE FUNCTION enforce_channel_exclusivity();
```

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela + trigger + seed |
| `src/types/settings.ts` | Adicionar `IntegrationCompanyConfig`, marcar exclusividade |
| `src/hooks/useIntegrationCompanyConfig.ts` | Novo hook CRUD por empresa |
| `src/components/settings/IntegrationsTab.tsx` | UI com switches por empresa para bluechat/mensageria |
| `src/components/settings/IntegrationCard.tsx` | Suportar modo "por empresa" |
| `supabase/functions/bluechat-inbound/index.ts` | Checar se habilitado para empresa do lead |
| `supabase/functions/whatsapp-inbound/index.ts` | Checar canal ativo para empresa |
| `supabase/functions/whatsapp-send/index.ts` | Checar canal ativo antes de enviar |
