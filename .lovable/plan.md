

## Plano: Sempre criar deal + pendência de duplicação para o gestor

### Problema atual
Quando um lead já existe (por email ou telefone) e já tem deal aberto no mesmo pipeline, o sistema faz "re-conversão" — apenas registra uma nota no deal existente. Isso pode causar perda de leads quando a dedup é incorreta (ex: telefone igual mas pessoa diferente).

### Mudança proposta

#### 1. Nova tabela: `duplicate_pendencies`
Armazena pendências de possível duplicação para revisão do gestor.

```sql
CREATE TABLE public.duplicate_pendencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  new_deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  existing_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  existing_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL, -- 'EMAIL', 'TELEFONE', 'EMAIL_E_TELEFONE'
  match_details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'MERGED', 'KEPT_SEPARATE', 'DISMISSED'
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.duplicate_pendencies ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated users can read/update based on empresa access
```

#### 2. Alterar `lp-lead-ingest` — Sempre criar novo contato + deal
- Remover toda a lógica de "reconversão" (o bloco `if (existingDeal)` que faz `continue`)
- Remover a lógica de reutilizar contato existente (`contactId = existingContact.id`)
- **Sempre** criar novo contato e novo deal
- **Se** detectou contato existente (por email ou telefone), inserir registro em `duplicate_pendencies` com:
  - `new_deal_id`: o deal recém-criado
  - `existing_contact_id`: o contato encontrado na dedup
  - `existing_deal_id`: o deal aberto existente (se houver)
  - `match_type`: EMAIL, TELEFONE ou ambos
- Manter a notificação ao owner quando há duplicata

#### 3. Frontend: Adicionar seção "Possíveis Duplicações" em `/pendencias`
- Novo hook `useDuplicatePendencies` que busca pendências com status PENDENTE
- Novo card `DuplicatePendencyCard` mostrando:
  - Nome/email do lead novo vs. contato existente
  - Tipo de match (email/telefone)
  - Ações: **Mesclar** (merge contacts + deals), **Manter Separados**, **Dispensar**
- Mutation `useResolveDuplicate` para atualizar o status
- Integrar contagem no Workbench

#### 4. Resumo do fluxo

```text
Lead chega → Verifica dedup (email/telefone)
  ├─ Não encontrou → Cria contato + deal (normal)
  └─ Encontrou match → Cria contato + deal MESMO ASSIM
                        + Insere duplicate_pendency
                        + Notifica gestor
```

### Arquivos impactados
- **Migração SQL**: nova tabela `duplicate_pendencies` + RLS
- `supabase/functions/lp-lead-ingest/index.ts`: simplificar fluxo, sempre criar, registrar pendência
- `src/hooks/useDuplicatePendencies.ts`: novo hook
- `src/pages/admin/PendenciasPerda.tsx`: nova seção de duplicações
- `src/pages/WorkbenchPage.tsx`: incluir contagem de duplicações

