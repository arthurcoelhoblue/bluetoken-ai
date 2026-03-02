

## Diagnóstico

O toggle do Meta Cloud para BLUE **aparenta funcionar** (toast de sucesso aparece), mas na verdade **não faz nada**. O motivo:

- A tabela `integration_company_config` só tem uma linha para BLUE com `channel = 'mensageria'`
- Não existe linha para `channel = 'meta_cloud'`
- O `toggleConfig` usa `.update()`, que retorna 204 (sucesso) mesmo quando zero linhas são afetadas
- O toast de sucesso é exibido mesmo sem nenhuma alteração real no banco

A TOKENIZA funciona porque alguém inseriu manualmente as duas linhas (mensageria + meta_cloud).

## Solução

Trocar o `.update()` por `.upsert()` no `useIntegrationCompanyConfig.ts`. Assim, quando a linha não existir, ela é criada automaticamente.

### Alteração

**`src/hooks/useIntegrationCompanyConfig.ts`** — No `toggleConfig.mutationFn`, substituir:

```typescript
// DE:
.update({ enabled, updated_at: ... })
.eq("empresa", empresa)
.eq("channel", channel);

// PARA:
.upsert({
  empresa,
  channel,
  enabled,
  updated_at: new Date().toISOString(),
}, { onConflict: "empresa,channel" });
```

Isso garante que ao ativar qualquer canal para qualquer empresa, a linha é criada se não existir. A trigger `enforce_channel_exclusivity` já cuida de desativar o canal oposto.

Nenhuma migração de banco necessária — a tabela já tem constraint unique em `(empresa, channel)`.

