

## Problema: Campos "De" e "Para" vazios na tabela de Chamadas Detalhadas

### Causa raiz

A API Zadarma retorna os campos `clid` (quem ligou) e `destination` (destino), mas o frontend espera `from` e `to`. Como esses campos não existem na resposta, a tabela mostra "—" em todas as linhas.

Resposta real da API:
```text
{ sip: "105", clid: "Extension 105", destination: 11917584223, seconds: 0, disposition: "no answer" }
```

O código em `parsedStats` faz cast direto sem mapear os campos, e a tabela renderiza `s.from` e `s.to` que são `undefined`.

### Sobre as chamadas registradas

As 15 chamadas de hoje são reais — foram feitas pelos ramais 103 e 105 do PBX Zadarma. Não foram feitas por você, mas por outros usuários vinculados a esses ramais.

### Correção

No arquivo `src/pages/ZadarmaConfigPage.tsx`, no `parsedStats` (linhas 585-602):

1. Mapear `clid` → `from` e `destination` → `to`
2. Mapear `seconds` → `billseconds` (o campo retornado é `seconds`, não `billseconds`)
3. Mapear `call_id` → `id`
4. Converter `is_recorded` de string `"true"/"false"` para boolean

### Arquivo alterado

1. `src/pages/ZadarmaConfigPage.tsx` — corrigir mapeamento dos campos no `parsedStats`

