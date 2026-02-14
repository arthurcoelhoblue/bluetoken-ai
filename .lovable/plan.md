
# Leads vs Contacts -- Unificacao (8.1)

## Situacao Atual

O sistema possui **duas entidades paralelas** para representar pessoas:

| Aspecto | `lead_contacts` (Legacy) | `contacts` (CRM) |
|---|---|---|
| Registros | 1.799 | 124 |
| ID primario | `lead_id` (TEXT, sem FK) | `id` (UUID, com FKs) |
| Usado por | Mensagens, Cadencias, Classificacoes, Conversas, SGT, Intents | Deals, Pipeline, Organizacoes, Custom Fields |
| Dados unicos | telefone_e164, opt_out, LinkedIn, Mautic, Chatwoot, score_marketing | CPF, RG, Telegram, endereco, foto_url, is_cliente, tags, tipo |
| Ponte | -- | `legacy_lead_id` (apenas 123 preenchidos de 1.799) |

### Problemas

1. Ao criar um deal no Pipeline, o usuario escolhe de `contacts` (124). Os 1.799 leads do SGT/Cadencias ficam invisiveis para o CRM.
2. A tela de Leads (`/leads`) lê de `lead_contacts` + `lead_classifications`. A tela de Contatos (`/contatos`) lê de `contacts`. Sao mundos separados.
3. Conversas e mensagens usam `lead_id` (TEXT). Deals usam `contact_id` (UUID FK). Nao ha como navegar de um deal para suas mensagens diretamente.
4. Dados enriquecidos (LinkedIn, Mautic, scores) ficam presos em `lead_contacts` e nao aparecem no CRM.

## Estrategia: `contacts` como Entidade Unica

A tabela `contacts` sera a **unica fonte de verdade** para pessoas. O `lead_contacts` sera mantido temporariamente como cache de automacao, mas toda a navegacao e UI convergira para `contacts`.

### Principios

- **Sem breaking change nos webhooks/edge functions** -- o SGT e WhatsApp continuam gravando em `lead_contacts` como antes
- **Migracao de dados** via SQL para sincronizar os 1.799 leads existentes para `contacts`
- **Bridge column** `legacy_lead_id` na tabela `contacts` garante a ponte para as tabelas `lead_*`
- **Progressivo** -- a UI converge primeiro, e futuramente as tabelas `lead_*` podem ser migradas para usar `contact_id` UUID

## Plano de Implementacao

### Fase 1: Enriquecer `contacts` e Sincronizar Dados (DB)

**1.1 - Adicionar colunas faltantes em `contacts`**

Colunas de `lead_contacts` que nao existem em `contacts`:

```
telefone_e164        TEXT
ddi                  TEXT
numero_nacional      TEXT
telefone_valido      BOOLEAN DEFAULT true
opt_out              BOOLEAN DEFAULT false
opt_out_em           TIMESTAMPTZ
opt_out_motivo       TEXT
score_marketing      INTEGER
prioridade_marketing TEXT
linkedin_url         TEXT
linkedin_cargo       TEXT
linkedin_empresa     TEXT
linkedin_setor       TEXT
origem_telefone      TEXT DEFAULT 'MANUAL'
```

**1.2 - Migrar dados de `lead_contacts` para `contacts`**

Query de sincronizacao:

```sql
INSERT INTO contacts (
  legacy_lead_id, empresa, nome, primeiro_nome, email, telefone,
  telefone_e164, ddi, numero_nacional, telefone_valido,
  opt_out, opt_out_em, opt_out_motivo,
  score_marketing, prioridade_marketing,
  linkedin_url, linkedin_cargo, linkedin_empresa, linkedin_setor,
  origem_telefone, pessoa_id, owner_id,
  canal_origem, tipo
)
SELECT
  lc.lead_id,
  lc.empresa,
  COALESCE(lc.nome, 'Lead ' || LEFT(lc.lead_id, 8)),
  lc.primeiro_nome,
  lc.email,
  lc.telefone,
  lc.telefone_e164, lc.ddi, lc.numero_nacional, lc.telefone_valido,
  lc.opt_out, lc.opt_out_em, lc.opt_out_motivo,
  lc.score_marketing, lc.prioridade_marketing,
  lc.linkedin_url, lc.linkedin_cargo, lc.linkedin_empresa, lc.linkedin_setor,
  lc.origem_telefone, lc.pessoa_id, lc.owner_id,
  'SGT', 'LEAD'
FROM lead_contacts lc
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c WHERE c.legacy_lead_id = lc.lead_id
);
```

**1.3 - Criar trigger de sincronizacao automatica**

Trigger `AFTER INSERT OR UPDATE ON lead_contacts` que faz upsert automatico em `contacts` com base no `lead_id`, garantindo que novos leads do SGT aparecem automaticamente no CRM.

**1.4 - Atualizar view `contacts_with_stats`**

Recriar a view para incluir as novas colunas (telefone_e164, score_marketing, linkedin_*, etc).

### Fase 2: Unificar a UI (Frontend)

**2.1 - Eliminar pagina `/leads` separada**

A tela de Leads sera absorvida pela tela de Contatos. O que muda:

| Antes | Depois |
|---|---|
| `/contatos` mostra 124 registros de `contacts` | `/contatos` mostra TODOS (incluindo os 1.799 migrados) |
| `/leads` mostra `lead_contacts` + `lead_classifications` | `/leads` redireciona para `/contatos` |
| LeadDetail lê de `lead_contacts` | LeadDetail continua existindo como rota legacy mas pode ser acessado via ContactDetail |

**2.2 - Enriquecer `ContactDetailSheet`**

Adicionar abas/secoes que hoje so existem na LeadDetail:
- Classificacao IA (via `legacy_lead_id` -> `lead_classifications`)
- Mensagens/Conversas (via `legacy_lead_id` -> `lead_messages`)
- Cadencia ativa (via `legacy_lead_id` -> `lead_cadence_runs`)
- Estado da conversa (via `legacy_lead_id` -> `lead_conversation_state`)
- Eventos SGT (via `legacy_lead_id` -> `sgt_events`)
- Intents IA (via `legacy_lead_id` -> `lead_message_intents`)

**2.3 - Adicionar filtros de classificacao na tela de Contatos**

Trazer os filtros de ICP, Temperatura e Prioridade da LeadsList para a ContatosPage, fazendo JOIN com `lead_classifications` via `legacy_lead_id`.

**2.4 - Redirect de `/leads` para `/contatos`**

Manter a rota `/leads/:leadId/:empresa` funcionando (redirect para o contato equivalente) para nao quebrar links externos, bookmarks e notificacoes.

### Fase 3: Adaptar Hooks de Ponte (Frontend)

**3.1 - Criar hook `useContactLeadBridge`**

Hook que, dado um `contact.id`, retorna o `legacy_lead_id` e permite buscar dados das tabelas `lead_*`:

```typescript
function useContactLeadBridge(contactId: string) {
  // 1. Busca legacy_lead_id do contact
  // 2. Retorna dados de lead_classifications, lead_messages, etc.
}
```

**3.2 - Adaptar ConversationPanel para aceitar contactId**

Hoje a ConversationPanel recebe `leadId`. Adicionar suporte para receber `contactId` e resolver internamente o `legacy_lead_id`.

**3.3 - Atualizar Conversas (`/conversas`)**

A tela de Conversas hoje navega para `/leads/:leadId/:empresa`. Mudar para navegar para `/contatos?open=CONTACT_ID` ou para uma nova rota unificada.

---

## Detalhes Tecnicos

### Migracao SQL (1 migracao, 4 operacoes)

| Operacao | Descricao |
|---|---|
| `ALTER TABLE contacts ADD COLUMN ...` | 14 colunas novas de lead_contacts |
| `INSERT INTO contacts SELECT FROM lead_contacts` | Migrar ~1.676 leads nao vinculados |
| `CREATE FUNCTION fn_sync_lead_to_contact()` | Trigger de sincronizacao automatica |
| `CREATE TRIGGER trg_sync_lead_contact` | Liga funcao ao lead_contacts |
| `CREATE OR REPLACE VIEW contacts_with_stats` | View atualizada com campos novos |

### Arquivos Frontend

| Arquivo | Acao | Descricao |
|---|---|---|
| `src/hooks/useContactLeadBridge.ts` | **Novo** | Hook ponte contact -> lead_* |
| `src/components/contacts/ContactDetailSheet.tsx` | **Editar** | Adicionar abas de Classificacao, Mensagens, Cadencia, Intents |
| `src/pages/ContatosPage.tsx` | **Editar** | Adicionar filtros de ICP/Temperatura/Prioridade |
| `src/hooks/useContactsPage.ts` | **Editar** | Suportar filtros de classificacao via join |
| `src/types/contactsPage.ts` | **Editar** | Adicionar campos novos ao tipo |
| `src/App.tsx` | **Editar** | Redirect `/leads` -> `/contatos` |
| `src/components/layout/AppSidebar.tsx` | **Editar** | Remover item "Leads" do menu (absorvido por Contatos) |
| `src/config/screenRegistry.ts` | **Editar** | Atualizar registro de telas |

### O que NAO muda nesta fase

- **Edge functions** (sgt-webhook, whatsapp-inbound, cadence-runner, sdr-ia-interpret, bluechat-inbound) continuam gravando em `lead_contacts` e `lead_messages` usando `lead_id` TEXT. O trigger automatico sincroniza para `contacts`.
- **Tabelas `lead_*`** continuam existindo. A migracao completa para `contact_id` UUID seria uma Fase 2 futura.
- **Rota `/leads/:leadId/:empresa`** continua funcionando como fallback, redirecionando para o contato equivalente.

### Fluxo de dados apos unificacao

```text
SGT Webhook / WhatsApp Inbound
    |
    v
lead_contacts (INSERT/UPDATE)
    |
    v
trg_sync_lead_contact (trigger)
    |
    +-- UPSERT contacts (legacy_lead_id = lead_id)
    |
    v
contacts_with_stats (view)
    |
    v
ContatosPage (UI unificada)
    |
    +-- ContactDetailSheet
         |
         +-- Dados basicos (contacts)
         +-- Classificacao IA (lead_classifications via legacy_lead_id)
         +-- Mensagens (lead_messages via legacy_lead_id)
         +-- Cadencia (lead_cadence_runs via legacy_lead_id)
         +-- Intents IA (lead_message_intents via legacy_lead_id)
         +-- Deals (deals via contact_id)
         +-- Campos Custom (custom_field_values via contact_id)
```
