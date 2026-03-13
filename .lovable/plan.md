

## Integração Mautic em Configurações > Canais

### Objetivo
Criar uma seção dedicada ao Mautic na aba "Canais" de `/admin/settings`, permitindo configurar conexões Mautic por empresa com URL, credenciais, ID do segmento e campos personalizados.

### Banco de dados

Criar tabela `mautic_company_config`:

```sql
CREATE TABLE public.mautic_company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  mautic_url TEXT NOT NULL,
  mautic_username TEXT,
  mautic_password TEXT,
  segment_id TEXT,
  custom_fields JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_mautic_company_config_empresa ON public.mautic_company_config (empresa);
ALTER TABLE public.mautic_company_config ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can CRUD
CREATE POLICY "Authenticated users manage mautic config"
  ON public.mautic_company_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

`custom_fields` armazena o mapeamento como JSON, ex: `{"cpf": "custom_cpf", "cnpj": "custom_cnpj"}`.

### Componentes

| Arquivo | Ação |
|---|---|
| `src/components/settings/MauticConfigManager.tsx` | Novo componente com lista de configs por empresa, formulário inline para URL, username, password, segment_id e custom_fields |
| `src/components/settings/IntegrationsTab.tsx` | Importar e renderizar `<MauticConfigManager />` após `<ApiKeysManager />` |

### MauticConfigManager — Funcionalidade

- Lista todas as empresas ativas (query `empresas`)
- Para cada empresa, mostra card com:
  - Toggle enabled
  - URL do Mautic
  - Username / Password (mascarado)
  - ID do Segmento
  - Campos personalizados: lista editável de pares `campo_local → campo_mautic`
  - Botão salvar
- CRUD via `supabase.from('mautic_company_config')` com upsert por empresa
- Botão "Adicionar campo" para custom_fields

### Edge functions

Atualizar `lp-lead-ingest` para ler credenciais de `mautic_company_config` por empresa (fallback para env vars atuais), permitindo conexões diferentes por tenant.

