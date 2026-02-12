
# Correcao do Bug de Coleta SPIN/GPCT/BANT

## Problema Identificado

A IA retorna os dados de framework com chaves MAIUSCULAS (`SPIN`, `GPCT`, `BANT`) no JSON de resposta, mas todo o codigo le e faz merge usando chaves minusculas (`spin`, `gpct`, `bant`). Resultado: os dois existem no banco ao mesmo tempo.

Exemplo real do lead Pedro (d642d7c1) no banco:
```text
SPIN: { S: "Nunca declarou cripto...", P: "Cálculo manual complexo...", I: "Precisa regularizar 3 anos...", N: "Condições especiais..." }
spin: {}   <-- VAZIO - é isso que o código lê
```

O SPIN foi preenchido pela IA com chaves maiusculas, mas:
- `decidirProximaPerguntaBLUE()` le `state.spin` (minusculo) → acha que esta vazio → pergunta de novo
- A listagem "DADOS JA COLETADOS" no prompt le `fd.spin` (minusculo) → nao mostra nada → IA nao sabe que ja coletou
- `getFrameworkCompleteness()` na UI le `data.spin` → mostra 0% preenchido

## Causa Raiz

No merge (linha ~4319-4327), o spread `...aiResponse.frameworks_atualizados` copia a chave `SPIN` (maiuscula) da IA para o banco. Depois, a linha `spin: { ...(existingData.spin || {}), ... }` cria uma chave `spin` (minuscula) SEPARADA, vazia (porque ambos os lados do spread sao vazios — dados reais estao em `SPIN` maiusculo).

## Correcao

**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

### 1. Normalizar chaves da resposta da IA (apos parse do JSON)

Criar funcao `normalizeFrameworkKeys()` que converte qualquer chave MAIUSCULA para minuscula:
```text
function normalizeFrameworkKeys(data: any): FrameworkData {
  return {
    spin: data?.spin || data?.SPIN || data?.Spin || {},
    gpct: data?.gpct || data?.GPCT || data?.Gpct || {},
    bant: data?.bant || data?.BANT || data?.Bant || {},
  };
}
```

Aplicar imediatamente apos parse da resposta da IA:
```text
if (aiResponse.frameworks_atualizados) {
  aiResponse.frameworks_atualizados = normalizeFrameworkKeys(aiResponse.frameworks_atualizados);
}
```

### 2. Normalizar chaves ao LER do banco (existingData)

Na secao de merge (linha ~4319), tambem normalizar o `existingData`:
```text
const existingData = normalizeFrameworkKeys(conversationState?.framework_data || {});
```

### 3. Normalizar ao construir qualiState (linha ~2847)

Garantir que `qualiState.spin`, `qualiState.gpct`, `qualiState.bant` leem os dados corretos:
```text
const normalizedFD = normalizeFrameworkKeys(conversationState?.framework_data);
spin: normalizedFD.spin,
gpct: normalizedFD.gpct,
bant: normalizedFD.bant,
```

### 4. Normalizar na listagem "DADOS JA COLETADOS" (linha ~2988)

```text
const fd = normalizeFrameworkKeys(conversationState.framework_data);
```

### 5. Corrigir dados existentes no banco

Apos deploy da funcao, executar SQL para migrar dados existentes que tem chaves maiusculas:
```text
UPDATE lead_conversation_state 
SET framework_data = jsonb_build_object(
  'spin', COALESCE(framework_data->'spin', '{}') || COALESCE(framework_data->'SPIN', '{}'),
  'gpct', COALESCE(framework_data->'gpct', '{}') || COALESCE(framework_data->'GPCT', '{}'),
  'bant', COALESCE(framework_data->'bant', '{}') || COALESCE(framework_data->'BANT', '{}')
)
WHERE framework_data ? 'SPIN' OR framework_data ? 'GPCT' OR framework_data ? 'BANT';
```

### 6. Normalizar tambem as sub-chaves (S/P/I/N vs s/p/i/n)

A IA pode retornar `{ SPIN: { S: "...", P: "..." } }` com sub-chaves maiusculas tambem. Expandir o normalizador:
```text
function normalizeSubKeys(obj: any): Record<string, string | null> {
  if (!obj) return {};
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.toLowerCase()] = value as string | null;
  }
  return result;
}

function normalizeFrameworkKeys(data: any): FrameworkData {
  return {
    spin: normalizeSubKeys(data?.spin || data?.SPIN || data?.Spin),
    gpct: normalizeSubKeys(data?.gpct || data?.GPCT || data?.Gpct),
    bant: normalizeSubKeys(data?.bant || data?.BANT || data?.Bant),
  };
}
```

## Resumo de Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Funcao `normalizeFrameworkKeys()` + aplicar em 4 pontos |
| Migration SQL | Corrigir dados existentes no banco |

## Impacto

- Todas as conversas futuras terao SPIN/GPCT/BANT coletados corretamente
- As conversas existentes com dados em chaves maiusculas serao migradas
- A decisao de proxima pergunta vai funcionar corretamente (nao repetir perguntas ja respondidas)
- A UI vai mostrar o percentual de completude correto
