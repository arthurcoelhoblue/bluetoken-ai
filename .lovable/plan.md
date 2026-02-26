

## Revisão Completa — Pontas Soltas Pós-Remoção Blue Chat

Após a remoção, restam os seguintes problemas que precisam ser corrigidos:

---

### 1. `supabase/config.toml` — Entradas fantasma (NÃO EDITÁVEL)
O arquivo `config.toml` contém referências a `[functions.bluechat-inbound]` (linha 27) e `[functions.bluechat-proxy]` (linha 132), mas este arquivo é auto-gerenciado e **não pode ser editado manualmente**. Essas entradas serão ignoradas pelo runtime pois as funções já foram deletadas — sem impacto funcional.

### 2. `integration-health-check/index.ts` — Duplicate `default` case (BUG)
Linhas 120-121 têm dois `default:` no switch, o que é um bug de sintaxe. Remover a linha duplicada.

### 3. DB Constraint — `integration_company_config` ainda permite `'bluechat'`
A migration `20260226182306` criou um CHECK constraint que inclui `'bluechat'` como valor válido:
```sql
CHECK (channel = ANY (ARRAY['bluechat', 'mensageria', 'meta_cloud']))
```
Criar nova migration para:
- **DROP** o constraint antigo
- **ADD** novo constraint permitindo apenas `'mensageria'` e `'meta_cloud'`
- **DELETE** quaisquer registros restantes com `channel = 'bluechat'`

### 4. DB Function — Comentário legado em `update_conversation_with_intent`
A função `update_conversation_with_intent` tem um comentário `-- MERGE: preserve existing keys (like bluechat_conversation_id)`. Criar migration para atualizar o comentário removendo a referência ao Blue Chat.

### 5. `sdr-proactive-outreach/index.ts` — Payload incorreto para whatsapp-send
Na função `sendViaActiveChannel` (linha 283), o payload enviado para `whatsapp-send` usa campos `phone` e `message`, mas o handler espera `telefone` e `mensagem` (+ `leadId`). Sem `leadId`, a validação do `whatsapp-send` falha com 400. Corrigir para enviar os campos corretos, ou fazer o proactive outreach chamar diretamente a API Mensageria em vez de passar pelo whatsapp-send.

### 6. Migrations históricas — Sem ação
As migrations antigas (`20260108...`, `20260209...`, etc.) contêm referências ao Blue Chat, mas são histórico imutável do banco. Não devem ser alteradas.

---

### Resumo de Ações

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `integration-health-check/index.ts` | Remover `default` duplicado (linha 121) |
| 2 | Nova migration SQL | Drop/recreate constraint sem `bluechat`, delete rows `bluechat` |
| 3 | Nova migration SQL | Atualizar comentário na function `update_conversation_with_intent` |
| 4 | `sdr-proactive-outreach/index.ts` | Corrigir payload do `sendViaActiveChannel` para `whatsapp-send` |

