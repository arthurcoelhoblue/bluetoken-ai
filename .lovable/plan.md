

## Plano: Melhorias Inteligentes na SDR Amélia

Baseado na análise da conversa do Arthur Coelho, há 4 problemas concretos a resolver.

---

### 1. Proibir re-oferta de produtos rejeitados/ignorados

**Problema**: Lead escolheu SAFE e a IA insistiu em re-oferecer outros produtos.

**Solução**: No `intent-classifier.ts`, adicionar ao prompt do usuário a lista de produtos já mencionados/escolhidos pelo lead (extraída do `framework_data`). Adicionar regra explícita no system prompt: "Se o lead já escolheu um produto específico, foque EXCLUSIVAMENTE nele. NUNCA re-ofereça alternativas que o lead já ignorou ou rejeitou."

No `action-executor.ts`, ao detectar menção a produto específico na resposta sugerida + intent INTERESSE_COMPRA, gravar `produto_escolhido` no `framework_data`.

**Arquivos**: `intent-classifier.ts`, `action-executor.ts`

---

### 2. Limitar perguntas de qualificação repetitivas

**Problema**: A IA fez perguntas de qualificação em loop sem avançar.

**Solução**: No `intent-classifier.ts`, contar quantas mensagens OUTBOUND consecutivas terminam com `?` no histórico recente. Se >= 3 perguntas de qualificação sem avanço de funil, injetar no prompt: "LIMITE ATINGIDO: Você já fez 3+ perguntas. Avance para um próximo passo concreto (enviar material, propor call, apresentar proposta)."

**Arquivos**: `intent-classifier.ts`

---

### 3. Auto-escalar após erros consecutivos de envio

**Problema**: Mensagens OUTBOUND ficaram com estado ERRO sem que ninguém fosse notificado.

**Solução**: No `action-executor.ts`, quando `sendAutoResponse` retorna `false`, consultar as últimas 3 mensagens OUTBOUND do lead. Se 2+ consecutivas estão com status ERRO, executar `ESCALAR_HUMANO` automaticamente e criar notificação para o owner do contato.

**Arquivos**: `action-executor.ts`

---

### 4. Escalar automaticamente quando lead pede profundidade técnica

**Problema**: Lead pediu track record, milestones SAFE — a IA não escalou.

**Solução**: No `intent-classifier.ts`, adicionar regra rule-based que detecta padrões de pedido técnico avançado (track record, rentabilidade passada, demonstração, cases, milestones) quando o funil já está em QUALIFICACAO ou superior. Nesses casos, classificar como `ESCALAR_HUMANO` com resposta: "Boa pergunta! Vou chamar alguém da equipe que pode te mostrar esses detalhes com mais profundidade."

**Arquivos**: `intent-classifier.ts`

---

### Resumo de impacto

| Melhoria | Arquivo principal | Complexidade |
|---|---|---|
| Bloquear re-oferta de produto | intent-classifier + action-executor | Média |
| Limitar perguntas repetitivas | intent-classifier | Baixa |
| Auto-escalar após erros OUTBOUND | action-executor | Baixa |
| Escalar pedido técnico avançado | intent-classifier | Baixa |

