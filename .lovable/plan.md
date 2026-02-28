

# Horário Comercial Inteligente para a Amélia

## Problema
Atualmente a Amélia escala para humano a qualquer hora. Fora do expediente, ninguém atende e o lead fica abandonado.

## Solução
Dois modos de operação baseados no horário:
- **Horário comercial (Seg-Sex 08h-18h)**: comportamento atual — pode escalar para humano
- **Fora do horário**: Amélia NÃO escala, informa que não há atendimento humano e conduz a venda do início ao fim sozinha

## Alterações

### 1. `supabase/functions/_shared/business-hours.ts`
- Alterar horário de 09h para **08h** (início do expediente)

### 2. `supabase/functions/sdr-ia-interpret/intent-classifier.ts`
- Importar `isHorarioComercial` de `business-hours.ts`
- Receber flag `foraDoHorario` nos `ClassifyParams`
- Nos **rule-based shortcuts** (pedido de humano, profundidade técnica, etc.): se `foraDoHorario`, NÃO retornar `ESCALAR_HUMANO` — em vez disso, retornar `ENVIAR_RESPOSTA_AUTOMATICA` com resposta explicando que não há humanos disponíveis mas que ela pode resolver
- Injetar no **prompt da IA** (tanto `SYSTEM_PROMPT` quanto `PASSIVE_CHAT_PROMPT`): instrução condicional informando que está fora do horário, que NÃO deve escalar, e que deve conduzir a venda sozinha

### 3. `supabase/functions/sdr-ia-interpret/index.ts`
- Importar `isHorarioComercial` 
- Passar flag `foraDoHorario: !isHorarioComercial()` para o classifier
- **Guardrail final**: se `acao === 'ESCALAR_HUMANO'` e `!isHorarioComercial()`, converter para `ENVIAR_RESPOSTA_AUTOMATICA` e ajustar resposta para informar indisponibilidade humana

### Fluxo resultante

```text
Lead envia mensagem
    │
    ├── Horário comercial? ──► SIM ──► Comportamento normal (pode escalar)
    │
    └── NÃO ──► Prompt ajustado: "Fora do horário, conduza a venda"
                 Rule-based: bloqueia ESCALAR_HUMANO
                 Guardrail: converte escalações residuais
                 Resposta: "Nosso time não está disponível agora,
                           mas posso te ajudar com tudo!"
```

