

# Diagnóstico e Correção: Botão "Aprender" sem efeito visível

## Problema
A função executa com sucesso mas não produz mudanças porque:
- Os 13 feedbacks estão todos como `PENDENTE` — nunca foram classificados como UTIL/NAO_UTIL
- Os 11 knowledge_gaps têm `frequency = 1` — o threshold para sugestão automática é `>= 5`

## Causa raiz
O fluxo de classificação de feedback não está funcionando. Preciso verificar onde o `outcome` deveria ser atualizado de PENDENTE para UTIL/NAO_UTIL. Provavelmente está faltando lógica no `response-generator.ts` ou no fluxo de conversa da Amélia.

## Plano (2 partes)

### 1. Adicionar classificação automática de feedback
No `response-generator.ts`, após a Amélia gerar uma resposta usando RAG, o sistema já registra o feedback como PENDENTE. Precisa haver uma lógica que infira o outcome baseado na reação do lead:
- Se o lead faz uma pergunta de follow-up sobre o mesmo tema → `UTIL`
- Se o lead repete a mesma pergunta ou diz "não entendi" → `NAO_UTIL`
- Se o lead muda de assunto ou avança no funil → `UTIL`

Isso deve ser feito no `sdr-ia-interpret` quando processa a próxima mensagem do lead.

### 2. Feedback visual no botão "Aprender"
Atualmente o toast mostra "0 chunks otimizados, 0 FAQs sugeridas" — o que parece um erro para o usuário. Melhorar o feedback:
- Se não há dados para processar, mostrar mensagem explicativa: "Sem feedbacks classificados ainda. O sistema aprende à medida que leads interagem com a Amélia."
- Mostrar o breakdown dos dados encontrados (13 pendentes, 0 úteis, etc.)

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Adicionar lógica de inferência de feedback (UTIL/NAO_UTIL) baseada no comportamento do lead |
| `src/components/knowledge/KnowledgeRAGStatus.tsx` | Melhorar feedback visual do botão Aprender com mensagens contextuais |

