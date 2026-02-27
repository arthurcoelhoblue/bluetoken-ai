

# Corrigir Arquitetura do Inbound: Empresa-First (em vez de Lead-First)

## Problema Raiz

O codigo atual segue uma logica **Lead-First**: busca o lead pelo telefone em TODAS as empresas, depois tenta priorizar qual empresa. Isso falha porque:

- O telefone `+5561999999999` existe em BLUE e TOKENIZA
- A mensageria esta configurada para **BLUE_LABS**
- Nenhum lead pertence a BLUE_LABS, entao a priorizacao por mensageria nao encontra nada
- Cai no fallback "mais recente" = TOKENIZA

## Solucao: Logica Empresa-First

Inverter completamente a abordagem:

1. **Primeiro**: Determinar qual empresa e dona deste webhook (consultando `integration_company_config` onde `channel='mensageria'`, `enabled=true` e `api_key IS NOT NULL`)
2. **Depois**: Buscar o lead/contact **somente dentro dessa empresa**
3. **Se nao encontrar**: Salvar como UNMATCHED, mas sempre na empresa correta

### Passo 1: Criar funcao `resolveEmpresaFromWebhook`

Nova funcao que consulta `integration_company_config` para encontrar a empresa com mensageria totalmente configurada (enabled + api_key). Se houver apenas uma (caso atual: BLUE_LABS), essa e a empresa-alvo. Se houver multiplas, usa a que tem `connection_name` configurado como criterio adicional.

```text
resolveEmpresaFromWebhook():
  1. Query integration_company_config WHERE channel='mensageria' AND enabled=true AND api_key IS NOT NULL
  2. Se 1 resultado -> retorna essa empresa
  3. Se multiplos -> retorna todas (para busca em qualquer uma delas)
  4. Se nenhum -> fallback para comportamento atual (busca global)
```

### Passo 2: Refatorar `findLeadByPhone` para aceitar filtro de empresa

Adicionar parametro opcional `targetEmpresas: string[]` que, quando presente, filtra TODAS as queries para buscar leads apenas nessas empresas.

```text
findLeadByPhone(supabase, phone, targetEmpresas?):
  // E.164 match
  query lead_contacts WHERE telefone_e164 = phone
    AND empresa IN targetEmpresas   <-- FILTRO NOVO
  
  // Variacao match  
  query lead_contacts WHERE telefone = variant
    AND empresa IN targetEmpresas   <-- FILTRO NOVO
  
  // Parcial match
  query lead_contacts WHERE telefone LIKE %last8
    AND empresa IN targetEmpresas   <-- FILTRO NOVO
  
  // Outbound fallback
  query lead_messages WHERE empresa IN targetEmpresas  <-- FILTRO NOVO
```

### Passo 3: Refatorar fallback CRM (contacts) com mesmo filtro

O bloco que busca em `contacts` (linhas 651-717) tambem precisa filtrar por `targetEmpresas`:

```text
contacts WHERE telefone_e164 = e164
  AND empresa IN targetEmpresas   <-- FILTRO NOVO
```

### Passo 4: Garantir que mensagens UNMATCHED usem a empresa correta

Na linha 502, o fallback atual e:
```text
const empresa = leadContact?.empresa || crmEmpresa || 'TOKENIZA';
```

Deve mudar para:
```text
const empresa = leadContact?.empresa || crmEmpresa || targetEmpresa || 'BLUE_LABS';
```

Onde `targetEmpresa` vem da resolucao do passo 1.

### Passo 5: Remover logica de priorizacao por mensageria

As chamadas a `getEmpresasComMensageria` dentro de `findLeadByPhone` se tornam desnecessarias, pois o filtro de empresa ja e aplicado na raiz. O codigo fica mais simples e previsivel.

## Fluxo Final

```text
Mensagem chega no webhook
  |
  v
resolveEmpresaFromWebhook()
  -> BLUE_LABS (unica com mensageria configurada)
  |
  v
findLeadByPhone(phone, targetEmpresas=["BLUE_LABS"])
  -> Busca APENAS em BLUE_LABS
  -> Se encontrar lead -> MATCHED para BLUE_LABS
  -> Se nao encontrar -> UNMATCHED para BLUE_LABS
  |
  v
saveInboundMessage(empresa = BLUE_LABS)
```

## Alteracoes no Arquivo

Somente um arquivo sera modificado: `supabase/functions/whatsapp-inbound/index.ts`

1. Criar `resolveEmpresaFromWebhook()` (nova funcao, ~15 linhas)
2. Alterar `findLeadByPhone()` para aceitar e usar `targetEmpresas` em todas as queries
3. Alterar fallback CRM para filtrar por `targetEmpresas`
4. No handler principal, chamar `resolveEmpresaFromWebhook()` antes de `findLeadByPhone()`
5. Passar empresa resolvida para `saveInboundMessage` como fallback
6. Remover chamadas redundantes a `getEmpresasComMensageria` dentro de `findLeadByPhone`

## Resultado Esperado

- Mensagens da Mensageria SEMPRE caem na empresa com mensageria configurada (BLUE_LABS)
- Sem mistura entre empresas, mesmo que o telefone exista em outras
- Mensagens UNMATCHED tambem ficam na empresa correta
- Se no futuro outra empresa configurar mensageria, o sistema funciona para ambas (busca em todas as empresas com mensageria ativa)

