
# Correcao dos Insights do Copilot -- Nomes em vez de IDs

## Problema identificado

Os insights continuam mostrando UUIDs (ex: "Lead 63b6bce7") por dois motivos:

1. **Busca de nomes incorreta**: A funcao busca nomes de leads usando `contacts.id`, mas o `lead_messages.lead_id` corresponde a `contacts.legacy_lead_id`. Resultado: a query nao encontra nenhum nome e o contexto enviado a IA ja contem "Lead sem nome" ou os proprios IDs.

2. **Sem pos-processamento**: Mesmo com instrucoes no prompt, a IA ocasionalmente inclui UUIDs. Nao ha nenhuma etapa de sanitizacao antes de salvar os insights no banco.

## Solucao

### 1. Corrigir a busca de nomes na edge function (`copilot-proactive/index.ts`)

**Mensagens inbound (linha ~200):** Trocar a query de:
```
contacts.id IN (lead_ids)
```
Para:
```
contacts.legacy_lead_id IN (lead_ids)
```

E mapear `legacy_lead_id -> nome` em vez de `id -> nome`.

### 2. Adicionar pos-processamento de sanitizacao de UUIDs

Antes de inserir os insights no banco, aplicar uma funcao que:
- Detecta padroes de UUID (parcial ou completo) nos campos `titulo` e `descricao`
- Tenta substituir pelo nome do contato correspondente usando o `contactNameMap` ja construido
- Se nao encontrar o nome, substitui por "contato" generico (nunca deixa o UUID visivel)

Regex para detectar: `Lead\s+[0-9a-f]{8}` e UUIDs completos `[0-9a-f]{8}-[0-9a-f]{4}-...`

### 3. Enriquecer o mapa de nomes com os lead_ids das mensagens

Apos buscar nomes via `legacy_lead_id`, adicionar esses mapeamentos ao `contactNameMap` global, para que tanto o `contact_id` quanto o `legacy_lead_id` sejam resolvidos no pos-processamento.

## Secao tecnica

### Arquivo modificado: `supabase/functions/copilot-proactive/index.ts`

**Mudanca 1 -- Query de nomes (linhas 199-204):**
```typescript
// ANTES: busca por contacts.id (errado)
const { data: leadContacts } = await supabase.from('contacts')
  .select('id, nome').in('id', leadIds);

// DEPOIS: busca por contacts.legacy_lead_id (correto)
const { data: leadContacts } = await supabase.from('contacts')
  .select('id, nome, legacy_lead_id')
  .in('legacy_lead_id', leadIds);

// Mapear legacy_lead_id -> nome
leadNameMap = Object.fromEntries(
  leadContacts.map(c => [c.legacy_lead_id, c.nome])
);
// Tambem adicionar ao contactNameMap global
leadContacts.forEach(c => {
  if (c.legacy_lead_id) contactNameMap[c.legacy_lead_id] = c.nome;
  contactNameMap[c.id] = c.nome;
});
```

**Mudanca 2 -- Funcao de sanitizacao (nova, antes do insert):**
```typescript
function sanitizeUUIDs(text: string, nameMap: Record<string, string>): string {
  // Substituir "Lead XXXXXXXX" por nome ou "contato"
  let result = text.replace(/Lead\s+([0-9a-f]{8})[0-9a-f-]*/gi, (match, short) => {
    const found = Object.entries(nameMap).find(([k]) => k.startsWith(short));
    return found ? found[1] : 'contato';
  });
  // Substituir UUIDs completos soltos
  result = result.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (uuid) => {
    return nameMap[uuid] || 'contato';
  });
  // Substituir fragmentos de UUID (8+ hex chars seguidos)
  result = result.replace(/\b([0-9a-f]{8,})\b/gi, (match) => {
    const found = Object.entries(nameMap).find(([k]) => k.startsWith(match) || k.includes(match));
    return found ? found[1] : match.length >= 12 ? 'contato' : match;
  });
  return result;
}
```

**Mudanca 3 -- Aplicar sanitizacao nos insights (linhas 269-278):**
```typescript
const insightsToInsert = parsedInsights.slice(0, 5).map((ins) => ({
  ...
  titulo: sanitizeUUIDs(ins.titulo || 'Insight', contactNameMap),
  descricao: sanitizeUUIDs(ins.descricao || '', contactNameMap),
  ...
}));
```

### Deploy

Re-deploy da edge function `copilot-proactive` apos as mudancas.
