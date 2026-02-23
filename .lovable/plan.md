

# Recuperar qualidade das conversas da Amelia — Corrigir perda de contexto e looping

## Problemas identificados

Analisando a conversa com Arthur e os logs, encontrei **3 problemas criticos** que se alimentam mutuamente, criando um ciclo de perda total de contexto:

### Problema 1: `upsert` sobrescreve estado da conversa

No `action-executor.ts` (linha 331), o `upsert` com `onConflict: 'lead_id,empresa'` **substitui a row inteira** em vez de fazer update parcial. Quando o upsert roda apenas com `framework_data` (por causa do `ia_null_count`), os outros campos (`estado_funil`, `framework_ativo`, `perfil_disc`, `modo`, etc.) sao resetados para `null` ou valores default.

Resultado: a cada mensagem, o conversation state perde o `estado_funil`, `framework_ativo`, `perfil_disc` e outros campos acumulados.

**Evidencia**: O SPIN do Arthur tem todos os campos `null` apesar dele ter respondido "declaro sozinho" (SPIN_S), "primeira vez" (mais SPIN_S), e "quero fazer com contador".

### Problema 2: `ia_null_count` nunca incrementa (resetado a cada mensagem)

O fluxo anti-limbo no `index.ts` tem uma falha logica:

1. Quando a IA retorna `confidence: 0.98` com `intent: "OUTRO"` e `acao: "CONTINUAR_QUALIFICACAO"`, o codigo na linha 167 verifica `isFailedIntent` como `true` (intent === 'OUTRO')
2. Mas na linha 198, o branch `!isFailedIntent` verifica usando o intent classificado — e como confidence e 0.98, o `ia_null_count` e resetado para 0
3. O anti-limbo SEMPRE mostra `iaNullCount: 1` nos logs, nunca incrementa

Resultado: O anti-limbo nunca escala para humano porque o contador reinicia. A Amelia fica presa enviando "Nao entendi bem. Pode me explicar melhor?" infinitamente.

### Problema 3: Frameworks SPIN nunca sao persistidos (valores null sobrescrevem dados reais)

Na funcao `normalize` do `action-executor.ts` (linha 301), quando a IA retorna `{"spin": {"s": null, "p": null}}`, o merge faz:
```
{ ...existing_spin, ...new_spin_with_nulls }
```
Os valores `null` do retorno da IA **sobrescrevem** os valores reais ja preenchidos. Alem disso, como o `upsert` reseta o estado (Problema 1), na proxima chamada o `existing` ja vem vazio.

Resultado: As respostas do Arthur nunca sao salvas nos frameworks. A Amelia continua perguntando SPIN_S repetidamente porque ve `spin.s = null`.

## Fluxo do looping (como os 3 problemas interagem)

```
Arthur: "Declaro sozinho"
  -> IA classifica: OUTRO (0.98), acao: CONTINUAR_QUALIFICACAO, spin.s preenchido
  -> action-executor: upsert SOBRESCREVE estado, spin.s salvo com null junto
  -> ia_null_count resetado para 0 (confidence 0.98 = "entendeu")
  -> Amelia responde com proxima pergunta (baseada no estado que acabou de ser destruido)

Arthur: "Primeira vez"  
  -> loadFullContext: le spin.s = null (foi sobrescrito)
  -> decidirProximaPergunta: SPIN_S de novo (porque spin.s = null)
  -> IA faz a MESMA pergunta de SPIN_S
  -> Looping
```

---

## Correcoes

### Correcao 1: Substituir `upsert` por `update` no action-executor

**Arquivo**: `supabase/functions/sdr-ia-interpret/action-executor.ts`

Trocar o `upsert` na linha 331 por um `update` que so altera os campos presentes em `stateUpdates`, sem sobrescrever os demais campos da row:

```typescript
// ANTES (sobrescreve tudo):
await supabase.from('lead_conversation_state').upsert({
  lead_id, empresa, canal: 'WHATSAPP', ...stateUpdates,
  ultimo_contato_em: new Date().toISOString(), updated_at: new Date().toISOString(),
}, { onConflict: 'lead_id,empresa' });

// DEPOIS (atualiza parcialmente):
await supabase.from('lead_conversation_state').update({
  ...stateUpdates,
  ultimo_contato_em: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}).eq('lead_id', lead_id).eq('empresa', empresa);
```

O `insert` inicial ja e feito no `message-parser.ts` (linha 233), entao o `update` e suficiente aqui.

### Correcao 2: Filtrar valores `null` no merge de frameworks

**Arquivo**: `supabase/functions/sdr-ia-interpret/action-executor.ts`

Criar funcao que filtra `null` antes do merge, para que valores nulos da IA nao sobrescrevam dados reais:

```typescript
// Funcao auxiliar: remove chaves com valor null
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) result[k] = v;
  }
  return result;
}

// No merge de frameworks (linhas 309-314):
stateUpdates.framework_data = {
  ...existing,
  gpct: { ...(normalize(existing.gpct || existing.GPCT)), ...stripNulls(normalize(fu.gpct || fu.GPCT)) },
  bant: { ...(normalize(existing.bant || existing.BANT)), ...stripNulls(normalize(fu.bant || fu.BANT)) },
  spin: { ...(normalize(existing.spin || existing.SPIN)), ...stripNulls(normalize(fu.spin || fu.SPIN)) },
};
```

### Correcao 3: Corrigir logica de reset do `ia_null_count`

**Arquivo**: `supabase/functions/sdr-ia-interpret/index.ts`

O problema esta no bloco da linha 198. A condicao `!isFailedIntent` usa o intent bruto, mas `isFailedIntent` so verifica `NAO_ENTENDI` e `OUTRO`. Quando a IA retorna `OUTRO` com alta confianca (0.98), o codigo entra no branch de "falha" (linhas 170-204) E depois no branch de "sucesso" (linhas 198-204) — os dois executam.

Na verdade, o branch de "sucesso" (linha 198) so deveria resetar o contador quando o intent NAO e `OUTRO` nem `NAO_ENTENDI`. Mas como usa `else if`, isso ja deveria estar correto... O problema real e que acoes invalidas como `CONTINUAR_QUALIFICACAO` e `RESPONDER` nao sao reconhecidas pelo `VALID_ACOES`, entao sao normalizadas para `NENHUMA`, mas o `classifierResult.acao` original ainda tem o valor invalido.

A correcao e garantir que o `ia_null_count` realmente incremente quando `isFailedIntent` e `true`, e so resete quando a IA retorna um intent valido e util (nao OUTRO):

```typescript
// Linha 167 — melhorar a deteccao de falha:
const isFailedIntent = classifierResult.intent === 'NAO_ENTENDI' 
  || (classifierResult.intent === 'OUTRO' && classifierResult.confidence < 0.8);

// Quando OUTRO com alta confianca mas acao invalida, tambem tratar como progresso:
const isValidProgress = classifierResult.intent === 'OUTRO' 
  && classifierResult.confidence >= 0.8 
  && classifierResult.resposta_sugerida 
  && classifierResult.resposta_sugerida.length > 20;
```

E no bloco da linha 198:
```typescript
} else if (source === 'BLUECHAT' && !isFailedIntent) {
  // IA entendeu com intent claro OU respondeu com contexto valido
  if (iaNullCount > 0) {
    classifierResult._ia_null_count_update = 0;
  }
}
```

### Correcao 4: Normalizar acao ANTES da logica anti-limbo

**Arquivo**: `supabase/functions/sdr-ia-interpret/index.ts`

Mover a normalizacao da acao para antes do bloco anti-limbo, para que acoes invalidas como `CONTINUAR_QUALIFICACAO` ou `RESPONDER` sejam tratadas corretamente:

```typescript
// ANTES da linha 162, normalizar:
if (classifierResult.acao) {
  classifierResult.acao = normalizarAcao(classifierResult.acao);
}
if (classifierResult.acao_recomendada) {
  classifierResult.acao_recomendada = normalizarAcao(classifierResult.acao_recomendada);
}
```

---

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sdr-ia-interpret/action-executor.ts` | Trocar `upsert` por `update`; filtrar nulls no merge de frameworks |
| `supabase/functions/sdr-ia-interpret/index.ts` | Normalizar acao antes do anti-limbo; melhorar deteccao de falha vs progresso |

## Resultado esperado

1. O estado da conversa (SPIN, DISC, estado_funil) vai ser preservado entre mensagens
2. As respostas do lead vao acumular nos frameworks, evitando perguntas repetidas
3. O `ia_null_count` vai incrementar corretamente, escalando para humano apos 3 falhas reais
4. A Amelia vai parar de fazer looping perguntando a mesma coisa

