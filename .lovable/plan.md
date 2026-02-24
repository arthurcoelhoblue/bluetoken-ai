

## Controle de Contatos Duplicados

### Situacao Atual

O sistema ja possui deduplicacao robusta no **backend automatizado** (webhooks SGT, Blue Chat) via `_shared/contact-dedup.ts`, que busca por `legacy_lead_id`, `email+empresa` e `telefone+empresa` antes de criar um contato.

Porem, os **formularios manuais** (Novo Contato na pagina de Contatos, Criacao Rapida no Pipeline) inserem diretamente na tabela `contacts` sem nenhuma verificacao. Isso permite que um usuario crie um contato com email ou telefone ja existente.

### Solucao Proposta

Implementar verificacao de duplicatas em duas camadas:

**Camada 1 — Constraint no banco (seguranca)**
Criar um indice unico parcial `(email, empresa)` e `(telefone_e164, empresa)` para impedir duplicatas no nivel do banco. Isso funciona como rede de seguranca final.

**Camada 2 — Verificacao pre-submit no frontend (UX)**
Antes de inserir, buscar contatos existentes com mesmo email ou telefone na mesma empresa. Se encontrado, exibir um alerta ao usuario com opcoes:
- **Ver contato existente** — abre o contato ja cadastrado
- **Criar mesmo assim** — permite a criacao (para casos legitimos como homonimos)

### Detalhes Tecnicos

#### 1. Migration SQL

Criar indices unicos parciais (nao bloqueantes para valores NULL):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_empresa_unique
  ON contacts (lower(email), empresa)
  WHERE email IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_telefone_e164_empresa_unique
  ON contacts (telefone_e164, empresa)
  WHERE telefone_e164 IS NOT NULL AND is_active = true;
```

Esses indices permitem multiplos contatos sem email/telefone, mas impedem dois ativos com o mesmo email ou telefone E.164 na mesma empresa.

#### 2. Novo hook: `src/hooks/useContactDuplicateCheck.ts`

Funcao que recebe `{ email, telefone, empresa }` e retorna contatos possivelmente duplicados:

```text
useContactDuplicateCheck({ email, telefone, empresa })
  -> query contacts WHERE (email = X OR telefone = X) AND empresa = Y AND is_active = true
  -> retorna lista de matches com id, nome, email, telefone
```

#### 3. Componente: `src/components/contacts/DuplicateContactAlert.tsx`

Alerta inline exibido abaixo do formulario quando duplicatas sao detectadas. Mostra:
- Nome e dados do contato existente
- Botao "Ver contato" (navega para o contato)
- Botao "Criar mesmo assim" (prossegue com a criacao)

#### 4. Integracao nos formularios existentes

**`ContactCreateDialog.tsx`**: Adicionar verificacao no `handleCreate` antes do `mutateAsync`. Se houver match, exibir o `DuplicateContactAlert` em vez de criar.

**`QuickCreateContactDialog.tsx`**: Mesma logica — verificar antes de criar, exibir alerta se duplicata detectada.

**`useCreateContactPage` / `useCreateContact`**: Tratar erro de constraint unica (`duplicate key`) com mensagem amigavel ("Ja existe um contato com este email/telefone").

### Fluxo do Usuario

```text
1. Usuario preenche formulario de novo contato
2. Ao clicar "Criar":
   a. Sistema busca duplicatas por email/telefone + empresa
   b. Se encontrou:
      - Exibe alerta com dados do contato existente
      - Opcoes: "Ver contato" ou "Criar mesmo assim"
   c. Se nao encontrou:
      - Cria normalmente
3. Se o usuario forca a criacao e bate na constraint:
   - Toast de erro amigavel
```

### Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar indices unicos parciais |
| `src/hooks/useContactDuplicateCheck.ts` | Novo — hook de verificacao |
| `src/components/contacts/DuplicateContactAlert.tsx` | Novo — componente de alerta |
| `src/components/contacts/ContactCreateDialog.tsx` | Modificar — integrar verificacao |
| `src/components/pipeline/QuickCreateContactDialog.tsx` | Modificar — integrar verificacao |
| `src/hooks/useContactsPage.ts` | Modificar — tratar erro de constraint |
| `src/hooks/useContacts.ts` | Modificar — tratar erro de constraint |

