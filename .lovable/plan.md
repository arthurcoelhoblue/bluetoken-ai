

# Correção: Dados SPIN Não Sendo Extraídos das Conversas

## Problema

O lead Marcos Bertoldi tem `framework_data: {spin: {}, bant: {}, gpct: {}}` completamente vazio, apesar de haver dados claros na conversa para preencher pelo menos S (Situation) do SPIN:

- **S (Situação)**: Reunião prévia com Michel, quer orçamento para declaração de IR cripto, 1 ano de declaração
- **P (Problema)**: Precisa declarar impostos sobre criptomoedas (implícito)

A IA processou os intents corretamente (INTERESSE_IR, INTERESSE_COMPRA) mas retornou `frameworks_atualizados: {}` vazio em todas as interpretações.

## Causa Raiz

Duas falhas contribuem:

1. **Prompt com exemplo vazio**: O formato JSON de resposta mostra `"frameworks_atualizados":{}` como placeholder, induzindo a IA a retornar vazio quando não há pergunta explícita de framework
2. **Sem extração retroativa**: Quando o lead responde com dados que mapeiam para campos do framework (ex: "1 ano" = timeline/situação), a IA não os extrai porque o prompt não instrui a fazer extração passiva de dados conversacionais

## Solução

### 1. Melhorar o prompt para exigir extração contínua de framework

No `sdr-ia-interpret/index.ts`, atualizar o system prompt para instruir explicitamente:
- SEMPRE extrair dados de framework de QUALQUER mensagem do lead, mesmo quando não é uma pergunta direta do framework
- Preencher campos com base em inferências conversacionais
- Incluir exemplo concreto no formato JSON mostrando preenchimento parcial

### 2. Correção pontual do Marcos Bertoldi

Atualizar `lead_conversation_state` com os dados SPIN que já existem na conversa:
- `s`: "Reunião prévia com Michel, quer orçamento para declaração de IR cripto, 1 ano de declaração"
- `p`: "Precisa declarar impostos sobre operações cripto"

### 3. Adicionar instrução de extração passiva no prompt

Adicionar ao bloco de regras do prompt (perto de onde lista o formato JSON):

```text
## REGRA CRÍTICA DE FRAMEWORK
EXTRAIA dados do framework de TODA mensagem do lead, mesmo que ele não esteja respondendo a uma pergunta de qualificação.
Exemplo: Se o lead diz "quero um orçamento para declaração", isso é SPIN_S (situação = precisa de declaração).
Se o lead diz "1 ano", isso complementa a situação.
NUNCA retorne frameworks_atualizados vazio se houver qualquer informação inferível na mensagem.
```

### 4. Corrigir o exemplo de formato JSON

Mudar de:
```json
"frameworks_atualizados":{}
```
Para:
```json
"frameworks_atualizados":{"spin":{"s":"dado extraído da mensagem se houver"}}
```

## Arquivos a Editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Atualizar system prompt com regra de extração passiva e exemplo de formato JSON preenchido |

## Migração de Dados

Uma migração SQL para corrigir o `framework_data` do lead Marcos Bertoldi com os dados SPIN já disponíveis na conversa.

## Impacto

- Todos os leads futuros terão dados de framework extraídos de forma contínua, não apenas quando respondem a perguntas diretas
- A UI do "Estado da Conversa" mostrará progresso real do SPIN/GPCT/BANT
- Zero risco de regressão pois a lógica de merge já existe (linhas 4121-4129)
