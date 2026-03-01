

# Plano de Evolução da Qualidade de Respostas da Amélia

## Diagnóstico Confirmado

A auditoria está 100% correta. Confirmei no código:

1. **Inversão de responsabilidade**: O `intent-classifier.ts` (Claude Haiku) gera a `resposta_sugerida` dentro do JSON de classificação (linha 472 do prompt: `"resposta_sugerida":"..."`). O `index.ts` usa essa resposta diretamente (linha 181: `let respostaTexto = classifierResult.resposta_sugerida`).

2. **Response generator subutilizado**: O `index.ts` importa apenas `sanitizeResponse` (limpeza de padrões robóticos), nunca `generateResponse`. O Sonnet fica ocioso.

3. **Sobrecarga cognitiva do Haiku**: O prompt do classificador exige simultaneamente: classificar intent, estimar DISC, extrair frameworks SPIN/GPCT/BANT, extrair lead_facts, E gerar resposta conversacional — tudo num único JSON.

4. **RAG com threshold baixo**: O `knowledge-search` usa `threshold = 0.2` (linha 209), permitindo chunks irrelevantes.

5. **Sem instrução de grounding**: Nenhum dos prompts contém diretriz explícita de ancorar respostas exclusivamente no conhecimento recuperado.

---

## Plano de Implementação (6 passos, em ordem de prioridade)

### Passo 1 — Fortalecer Grounding no Response Generator (Crítico)
**Arquivo**: `supabase/functions/sdr-ia-interpret/response-generator.ts`

Adicionar ao `systemPrompt` padrão (e ao fallback) uma seção de ancoragem obrigatória:

```
## 🎯 DIRETRIZ DE ANCORAGEM (GROUNDING) — OBRIGATÓRIA
Sua resposta DEVE ser baseada EXCLUSIVAMENTE nas informações da seção PRODUTOS.
- Se a informação estiver nos PRODUTOS, responda diretamente com dados concretos.
- Se a informação NÃO estiver nos PRODUTOS, você está PROIBIDO de inventar. 
  Responda: "Preciso confirmar com a equipe para te dar a informação exata." 
  ou "Não tenho essa informação no momento, mas vou verificar para você."
- NUNCA use seu conhecimento geral para complementar. Use APENAS o contexto fornecido.
```

### Passo 2 — Aumentar Threshold do RAG (Crítico)
**Arquivo**: `supabase/functions/knowledge-search/index.ts`

- Linha 209: mudar `threshold = 0.2` para `threshold = 0.55` (default do request body)
- O `response-generator.ts` linha 211 envia `threshold: 0.3` — mudar para `0.55`
- O `intent-classifier.ts` também chama RAG com threshold baixo — alinhar para `0.55`

Valor 0.55 em vez de 0.7 (recomendado pela auditoria) porque o threshold do RRF já combina FTS + vetor, um corte muito agressivo pode eliminar chunks relevantes. Podemos calibrar progressivamente.

### Passo 3 — Separar Classificação da Geração (Alta prioridade)
**Arquivos**: `intent-classifier.ts`, `response-generator.ts`, `index.ts`

**intent-classifier.ts**:
- Remover `resposta_sugerida` do JSON de saída do prompt
- Remover instruções de DISC→RESPOSTA do system prompt (manter apenas DISC→detecção)
- Simplificar o JSON esperado: `{"intent","confidence","summary","acao","sentimento","deve_responder","novo_estado_funil","frameworks_atualizados","disc_estimado","departamento_destino","lead_facts_extraidos"}`
- Manter maxTokens mais baixo (800 em vez de 1500)

**index.ts** (orquestrador):
- Após classificação, SEMPRE chamar `generateResponse()` quando `deve_responder = true`
- Remover a lógica de usar `classifierResult.resposta_sugerida` diretamente
- Passar ao generator: intent, frameworks, DISC, lead_facts, histórico, conhecimento RAG

**response-generator.ts**:
- Já usa Sonnet — manter
- Adicionar grounding (Passo 1)
- Receber o `intent`, `disc_estimado`, `frameworks` do classificador para contextualizar a resposta
- Aplicar instruções DISC→TOM diretamente no prompt do gerador

### Passo 4 — Enriquecer Contexto do RAG com produto_nome (Média)
**Arquivo**: Processo de embedding (não no search)

Ao gerar embeddings de `knowledge_sections` e `knowledge_faq`, prefixar o texto com o `produto_nome` associado. Isso cria associação semântica explícita entre produto e conteúdo.

Nota: isso requer re-embeddar o conteúdo existente. Implementar como migration + script.

### Passo 5 — Melhorar Fallback do fetchProductKnowledge (Média)
**Arquivo**: `supabase/functions/sdr-ia-interpret/response-generator.ts`

Quando RAG não retorna chunks (linha 279), o fallback carrega apenas `produto_nome, descricao_curta, preco_texto, diferenciais`. Adicionar:
- Carregar `knowledge_sections` associadas (top 3 por produto)
- Carregar `knowledge_faq` associados (top 5 por produto)
- Montar contexto mais rico como fallback

### Passo 6 — Desativar A/B Testing durante reestruturação (Baixa)
**Arquivos**: `intent-classifier.ts` (linha 507), `response-generator.ts` (linha 293)

Desativar temporariamente o carregamento de `prompt_versions` para evitar que prompts A/B interfiram na nova arquitetura. Reativar após estabilização.

---

## Resumo Técnico das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `response-generator.ts` | + Grounding obrigatório no prompt, + receber DISC/intent do classificador, + fallback enriquecido |
| `knowledge-search/index.ts` | Threshold default 0.2 → 0.55 |
| `intent-classifier.ts` | - Remover `resposta_sugerida` do prompt, - remover instruções DISC→resposta, simplificar output JSON |
| `index.ts` | + Sempre chamar `generateResponse()` quando deve_responder=true, - remover uso direto de resposta_sugerida |

## Impacto Esperado

- Respostas geradas pelo Sonnet (modelo superior) em vez do Haiku
- Haiku focado exclusivamente em classificação (tarefa para a qual foi dimensionado)
- Menos alucinações: grounding explícito + RAG com menos ruído
- Respostas mais precisas: contexto de produto melhor associado

