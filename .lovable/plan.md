

## Corrigir duplicacao de conversas na tela de Atendimentos

### Causa raiz

Quando um lead e encontrado em uma empresa diferente (ex: BLUE), o `bluechat-inbound` cria um registro "espelho" em `lead_contacts` para a outra empresa (TOKENIZA) com o **mesmo `lead_id`**. Porem, todas as mensagens ficam salvas com `empresa: BLUE`. 

O hook `useAtendimentos` busca contatos com `.in('lead_id', leadIds)` e retorna **ambas** as linhas (BLUE e TOKENIZA), gerando duas conversas identicas na lista -- com as mesmas mensagens, mesmo conteudo e mesmos contadores.

### Solucao

Deduplicar por `lead_id` no hook `useAtendimentos`, mantendo apenas um registro por lead. A logica sera:

1. Apos buscar os contacts, agrupar por `lead_id`
2. Para cada `lead_id` com multiplos registros, manter o que tem mensagens correspondentes (verificando a empresa das mensagens no `lead_messages`)
3. Se ambos tiverem mensagens, manter o mais recente

### Arquivo: `src/hooks/useAtendimentos.ts`

Apos a query de contacts (linha 73) e antes do merge (linha 133), adicionar logica de deduplicacao:

```typescript
// Deduplicar contacts por lead_id (evitar espelhos cross-empresa)
const contactsByLeadId = new Map<string, typeof contacts[0][]>();
for (const c of contacts) {
  const existing = contactsByLeadId.get(c.lead_id) || [];
  existing.push(c);
  contactsByLeadId.set(c.lead_id, existing);
}

const deduplicatedContacts = [];
for (const [leadId, dupes] of contactsByLeadId) {
  if (dupes.length === 1) {
    deduplicatedContacts.push(dupes[0]);
  } else {
    // Preferir o contact cuja empresa aparece nas mensagens passivas
    const withMessages = dupes.find(d => uniqueKeys.has(`${d.lead_id}_${d.empresa}`));
    deduplicatedContacts.push(withMessages || dupes[0]);
  }
}
```

Depois, usar `deduplicatedContacts` em vez de `contacts` no merge final (linha 133).

### Impacto

- Zero risco de regressao: leads com registros legitimamente separados (lead_ids diferentes) nao sao afetados
- Apenas leads com o mesmo lead_id em multiplas empresas serao deduplicados na listagem
- Nenhuma mudanca de banco ou migracao necessaria

