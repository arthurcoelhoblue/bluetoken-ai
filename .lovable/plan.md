

## Correção: Coluna `erro_envio` não existe

O `meta-webhook` tenta gravar `erro_envio` na tabela `lead_messages`, mas a coluna real se chama `erro_detalhe`.

### Alteração

**`supabase/functions/meta-webhook/index.ts`** (linha 730) — Trocar `erro_envio` por `erro_detalhe`:

```typescript
// DE:
updateData.erro_envio = JSON.stringify(status.errors);

// PARA:
updateData.erro_detalhe = JSON.stringify(status.errors);
```

Uma linha. Sem migração de banco necessária.

