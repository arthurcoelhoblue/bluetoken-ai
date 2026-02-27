

## Diagnóstico

O telefone `+5561998317422` está cadastrado em BLUE e TOKENIZA (contacts + lead_contacts), mas **não existe em BLUE_LABS**. A lógica atual do `whatsapp-inbound`:

1. Busca contato por telefone → encontra TOKENIZA (mais recente)
2. Verifica se mensageria está habilitada para TOKENIZA → **não está**
3. Retorna 403 `CHANNEL_DISABLED`

A função nunca considera BLUE_LABS porque não há contato com esse número lá.

## Duas opções de solução

### Opção A: Criar contato de teste em BLUE_LABS (rápido, para testar agora)
- Inserir um contato com telefone `+5561998317422` na empresa BLUE_LABS
- Ajustar a lógica de match para priorizar empresas com mensageria habilitada

### Opção B (recomendada): Alterar a lógica de matching para priorizar empresa com canal ativo
- Quando múltiplos contatos existem para o mesmo telefone, ou quando o contato encontrado pertence a uma empresa sem mensageria, a função deve buscar um contato alternativo em empresa com mensageria habilitada
- Isso resolve o problema de forma permanente para qualquer número compartilhado entre empresas

## Plano de implementação (Opção B)

### 1. Alterar `whatsapp-inbound/index.ts` — lógica de resolução de empresa

Na seção de matching (linhas ~570-668), após encontrar os contatos, em vez de pegar apenas o mais recente:

- Buscar **todos** os contatos que matcham o telefone (não apenas `limit(1)`)
- Para cada contato, verificar se a empresa dele tem mensageria habilitada
- Priorizar o contato cuja empresa tem `mensageria.enabled = true`
- Se nenhuma empresa tem mensageria habilitada, manter o comportamento atual (403)

Mudanças específicas:
- Remover `.limit(1).maybeSingle()` das queries de contato e usar `.limit(10)` para pegar múltiplos
- Após coletar candidatos, fazer um JOIN lógico com `integration_company_config` para filtrar empresa com canal ativo
- Selecionar o contato da empresa com mensageria habilitada (mais recente se houver múltiplos)

### 2. Redeployar a edge function

### 3. Testar com o payload real

