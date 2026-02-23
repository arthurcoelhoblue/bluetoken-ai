
## Permitir "Abordar via Amelia" para contatos sem legacy_lead_id

### Problema
O botao "Abordar via Amelia" e a edge function `sdr-proactive-outreach` dependem exclusivamente de `lead_id` (do sistema legado). Contatos criados diretamente no CRM nao possuem esse campo, entao o botao fica oculto ou retorna erro 400 ("Missing lead_id or empresa").

### Abordagem
Adicionar um caminho alternativo baseado em `contact_id` tanto no frontend quanto na edge function. Quando nao houver `legacy_lead_id`, o sistema usa o `contact_id` para buscar os dados do contato diretamente na tabela `contacts` e executa a abordagem normalmente.

### Mudancas

#### 1. Frontend — `src/components/deals/DealDetailHeader.tsx`
- Expandir a condicao de visibilidade do botao: mostrar quando `(legacyLeadId || contactId) && leadEmpresa && isBluechat`
- No `onClick`, enviar `contact_id` como alternativa quando `legacyLeadId` nao existir:
  ```
  body: {
    lead_id: legacyLeadId || undefined,
    contact_id: !legacyLeadId ? contactId : undefined,
    empresa: leadEmpresa,
    ...
  }
  ```

#### 2. Edge Function — `supabase/functions/sdr-proactive-outreach/index.ts`

**Entrada**: aceitar `contact_id` como alternativa a `lead_id`. Validacao muda de `!lead_id || !empresa` para `(!lead_id && !contact_id) || !empresa`.

**Resolucao do contato** (novo bloco apos validacao):
- Se `lead_id` fornecido: manter fluxo atual (buscar em `lead_contacts`)
- Se apenas `contact_id` fornecido:
  1. Buscar na tabela `contacts` por `id = contact_id`
  2. Extrair `nome`, `primeiro_nome`, `telefone`, `telefone_e164`, `email`, `empresa`, `legacy_lead_id`
  3. Se o contato tiver `legacy_lead_id`, redirecionar para o fluxo legado normalmente
  4. Se nao tiver, construir o objeto `lead` a partir dos dados do contato

**Contexto**: quando nao houver `legacy_lead_id`, a funcao `loadDeepContext` retornara dados vazios (sem mensagens, sem classificacao, etc.), o que e esperado — a Amelia gerara uma saudacao inicial sem historico.

**Gravacao**: ao salvar a mensagem em `lead_messages` e atualizar `lead_conversation_state`, usar o `contact_id` para localizar ou criar os registros necessarios. Como essas tabelas usam `lead_id`, sera necessario:
- Criar um `lead_contacts` sintetico a partir do contato CRM (para manter compatibilidade com o fluxo de mensagens)
- Usar esse novo `lead_id` gerado para registrar a mensagem e o estado da conversa

**Atualizacao do deal**: quando `contact_id` esta disponivel, buscar o deal diretamente por `contact_id` sem precisar resolver via `legacy_lead_id`.

#### 3. Fluxo simplificado para contatos sem historico

```text
Frontend                     Edge Function                Blue Chat
   |                              |                          |
   |-- POST {contact_id, empresa} |                          |
   |                              |-- busca contacts(id)     |
   |                              |-- cria lead_contacts     |
   |                              |-- loadDeepContext (vazio) |
   |                              |-- gera saudacao IA       |
   |                              |-- POST /messages {phone} |-->
   |                              |                          |<-- conv_id
   |                              |-- salva lead_messages    |
   |                              |-- upsert conv_state      |
   |                              |-- update deal etiqueta   |
   |<-- {success, conv_id}        |                          |
   |-- abre deeplink Blue Chat    |                          |
```

### Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/deals/DealDetailHeader.tsx` | Expandir visibilidade do botao e enviar `contact_id` como fallback |
| `supabase/functions/sdr-proactive-outreach/index.ts` | Aceitar `contact_id`, resolver contato CRM, criar `lead_contacts` sintetico, e adaptar gravacao |

### Riscos e mitigacoes
- **Criacao de lead_contacts sintetico**: pode gerar duplicatas se o contato for vinculado a um lead legado depois. Mitigacao: verificar sempre `legacy_lead_id` primeiro e usar o existente quando disponivel.
- **Contexto vazio**: a IA gera uma saudacao generica sem historico, o que e o comportamento esperado para um primeiro contato.
