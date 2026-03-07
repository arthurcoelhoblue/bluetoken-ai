# Plano: Re-conversão de Lead — Registrar nova conversão em deal existente

## Problema

Quando um lead já existente converte novamente na LP com IA, a função `lp-lead-ingest` encontra o contato e o deal aberto no mesmo pipeline, e simplesmente **pula** (status `skipped`, reason `deal_aberto_existente`). O vendedor nunca fica sabendo que o lead converteu de novo.

## Solução

Alterar `supabase/functions/lp-lead-ingest/index.ts` — quando o contato já existe **e** já tem deal aberto no pipeline:

1. **Registrar atividade no deal** — inserir em `deal_activities` uma nota com os dados da nova conversão (origem, UTMs, data)
2. **Atualizar tags do deal** — adicionar tags de parceiro (MPUPPE, AXIA) se ainda não existirem
3. **Criar notificação** para o owner do deal informando a re-conversão
4. **Retornar status `reconverted**` em vez de `skipped` — assim o sistema externo sabe que a conversão foi processada

### Trecho afetado (linhas 131-147)

Onde hoje faz:

```typescript
if (existingDeal) {
  results.push({ email, status: "skipped", reason: "deal_aberto_existente" });
  continue;
}
```

Passará a:

```typescript
if (existingDeal) {
  // 1. Registrar atividade de re-conversão
  await supabase.from("deal_activities").insert({
    deal_id: existingDeal.id,
    tipo: "NOTA",
    descricao: `🔄 Lead reconverteu via ${lead.canal_origem || "LP_COM_IA"}`,
    metadata: { utm_source, utm_campaign, canal_origem, reconversao_em: new Date().toISOString() }
  });

  // 2. Atualizar tags do deal (adicionar parceiro se novo)
  // Fetch deal tags, merge new partner tags, update

  // 3. Notificar owner
  // Insert notification: "Lead X converteu novamente em [origem]"

  // 4. Retornar status reconverted
  results.push({ email, status: "reconverted", deal_id: existingDeal.id, contact_id: contactId });
  continue;
}
```

Também ajustar o **summary** no final para contar `reconverted` separadamente.

### Nota sobre `mychel@blueconsult.com.br`

Remova o email [mychel@blueconsult.com.br](mailto:mychel@blueconsult.com.br) da lista `TEST_EMAILS` (linha 47).

---

## Escopo da alteração

- **1 arquivo**: `supabase/functions/lp-lead-ingest/index.ts`
- **Sem migration** — usa tabelas existentes (`deal_activities`, `notifications`, `deals`)