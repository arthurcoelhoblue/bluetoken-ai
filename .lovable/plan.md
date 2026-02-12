
# Transferencia Inteligente com Departamentos no Blue Chat

## Problema Atual

A Amelia escala para humano de forma generica -- nao informa ao Blue Chat PARA QUAL SETOR transferir. O payload de transferencia envia apenas:

```json
{
  "reason": "Lead qualificado - escalar para closer",
  "source": "AMELIA_SDR"
}
```

Falta o campo `department` (ou equivalente) para o Blue Chat rotear o ticket corretamente.

## O que sera feito

1. A IA vai decidir o departamento correto com base no contexto da conversa
2. O departamento vai ser enviado no payload de transferencia ao Blue Chat
3. As regras de roteamento serao claras nos prompts

## Departamentos disponiveis

| Departamento | Quando usar |
|---|---|
| Comercial | Lead nao e cliente e quer comprar, conhecer planos ou fechar negocio |
| Sucesso do Cliente | Cliente ativo com duvida, suporte, uso do produto ou problema de atendimento |
| Operacao | Cliente que precisa enviar documento ou tratar servico com especialista |
| Financeiro | Cobranca ou problema de pagamento |

## Detalhes tecnicos

### 1. `sdr-ia-interpret/index.ts` -- Novo campo no JSON de resposta da IA

Adicionar `departamento_destino` ao formato de resposta JSON nos dois prompts (passivo e qualificador consultivo):

```text
## FORMATO DE RESPOSTA (JSON)
{
  "intent": "...",
  ...
  "departamento_destino": "Comercial" | "Sucesso do Cliente" | "Operação" | "Financeiro" | null
}
```

Adicionar instrucoes nos prompts explicando quando usar cada departamento:

```text
## DEPARTAMENTOS PARA TRANSFERENCIA
Quando a acao for ESCALAR_HUMANO, indique o departamento correto:
- "Comercial": pessoa que NAO e cliente e quer comprar/conhecer planos/fechar negocio
- "Sucesso do Cliente": cliente ativo com duvida, suporte, uso do produto
- "Operação": cliente que precisa enviar documento ou tratar servico com especialista
- "Financeiro": cobranca ou problema de pagamento

Se nao souber qual departamento, use "Comercial" como padrao.
```

### 2. `sdr-ia-interpret/index.ts` -- Propagar departamento no resultado

Atualizar a interface `InterpretResult` para incluir `departamento_destino: string | null` e propagar o valor vindo do JSON da IA.

### 3. `bluechat-inbound/index.ts` -- Enviar departamento na transferencia

Atualizar o payload de transferencia de ticket para incluir o departamento:

De:
```json
{
  "reason": "Lead qualificado - escalar para closer",
  "source": "AMELIA_SDR"
}
```

Para:
```json
{
  "reason": "Lead qualificado - escalar para closer",
  "source": "AMELIA_SDR",
  "department": "Comercial"
}
```

O `department` vem de `iaResult.departamento_destino` ou fallback para `"Comercial"`.

### 4. `bluechat-inbound/index.ts` -- Incluir departamento na resposta da API

Adicionar o departamento na resposta do webhook para que o Blue Chat saiba o destino:

```json
{
  "escalation": {
    "needed": true,
    "reason": "...",
    "priority": "HIGH",
    "department": "Comercial"
  }
}
```

### 5. Fallbacks anti-limbo com departamento

Nos cenarios de fallback (IA falhou, NAO_ENTENDI com contexto), usar `"Comercial"` como departamento padrao, ja que a Amelia e do comercial e a maioria dos escalamentos sao para esse setor.

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/sdr-ia-interpret/index.ts` | Adicionar departamentos nos prompts, novo campo no resultado, propagar valor |
| `supabase/functions/bluechat-inbound/index.ts` | Enviar department no transfer, incluir na resposta da API |

## Sequencia

1. Atualizar prompts da IA com instrucoes de departamento e campo no JSON
2. Atualizar interface e logica de resultado no sdr-ia-interpret
3. Atualizar payload de transferencia no bluechat-inbound
4. Atualizar resposta da API com department
5. Deploy das duas funcoes
6. Testar cenarios de escalacao verificando se o departamento correto chega ao Blue Chat
