

# Corrigir escalacao prematura da Amelia para humano

## Diagnostico

Analisando os dados dos ultimos 13 dias (desde 10/fev), a Amelia escalou para humano **49 vezes**. Dessas:

| Intent | Escalacoes | Problema |
|--------|-----------|----------|
| NAO_ENTENDI | 20 | **IA nao conseguiu classificar a mensagem e escalou na primeira falha** |
| OUTRO | 9 | **IA classificou como generico e escalou sem tentar qualificar** |
| SOLICITACAO_CONTATO | 17 | Correto na maioria dos casos |
| AGENDAMENTO_REUNIAO | 3 | Correto |

**29 das 49 escalacoes (59%) sao prematuras** — a Amelia desiste rapido demais quando nao entende a mensagem.

## Causa raiz

No arquivo `supabase/functions/sdr-ia-interpret/index.ts`, linhas 164-175:

```text
if (source === 'BLUECHAT' && classifierResult.intent === 'NAO_ENTENDI') {
  const hasContext = (parsedContext.historico || []).length >= 2;
  if (!hasContext) {
    // Primeira mensagem: tenta saudacao (OK)
  } else {
    // 2+ mensagens: ESCALA IMEDIATAMENTE (PROBLEMA)
    classifierResult.acao = 'ESCALAR_HUMANO';
  }
}
```

O problema: **basta ter 2 mensagens no historico para a Amelia escalar na primeira falha de compreensao**. Nao ha contador de tentativas — qualquer `NAO_ENTENDI` com contexto vira escalacao imediata.

Alem disso, a IA as vezes classifica mensagens normais como `OUTRO` com confidence 1.0 e a logica nao tenta reclassificar.

## Correcao proposta

### 1. Implementar contador de falhas consecutivas (`ia_null_count`)

Usar o campo `ia_null_count` que ja existe no `framework_data` para contar falhas consecutivas. So escalar apos **3 falhas seguidas** (politica anti-limbo documentada).

### 2. Alterar logica anti-limbo no index.ts

```text
Antes:  NAO_ENTENDI + 2 msgs historico -> ESCALAR_HUMANO
Depois: NAO_ENTENDI -> incrementar ia_null_count
         ia_null_count < 3 -> pedir esclarecimento (ENVIAR_RESPOSTA_AUTOMATICA)
         ia_null_count >= 3 -> ESCALAR_HUMANO
```

### 3. Resetar contador quando a IA entende

Quando o intent NAO e `NAO_ENTENDI` nem `OUTRO`, resetar `ia_null_count` para 0 no `framework_data`.

### 4. Tratar intent `OUTRO` como segunda chance

Quando a IA retorna `OUTRO` com acao `ESCALAR_HUMANO`, converter para `ENVIAR_RESPOSTA_AUTOMATICA` se `ia_null_count < 3`, gerando uma pergunta de esclarecimento em vez de transferir.

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Reescrever logica anti-limbo (linhas 164-175) para usar ia_null_count com threshold de 3 |
| `supabase/functions/sdr-ia-interpret/action-executor.ts` | Adicionar logica para incrementar/resetar ia_null_count no framework_data |

## Resultado esperado

- A Amelia vai tentar esclarecer ate 2 vezes antes de escalar ("Nao entendi bem, pode reformular?" / "Ainda nao consegui entender, vou pedir ajuda")
- Reducao estimada de ~60% nas escalacoes prematuras (de 29 para ~10)
- Leads como Arthur vao continuar sendo qualificados em vez de serem transferidos na primeira duvida

