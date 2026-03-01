

# Análise de Performance: Amélia levando ~1 minuto para responder

## Diagnóstico baseado em dados reais (últimas 6h)

O pipeline total tem 3 etapas sequenciais com chamadas AI + múltiplos HTTP fetches:

| Etapa | Latência média | Modelo | Observação |
|---|---|---|---|
| `sdr-intent-classifier` | **8.025ms (~8s)** | Claude Haiku 4.5 | Bottleneck principal |
| `sdr-response-generator` | **3.970ms (~4s)** | Claude Sonnet 4.6 | Segundo gargalo |
| `sdr-message-parser-summary` | **5.037ms (~5s)** | Claude Sonnet 4.6 | Só dispara em conversas longas |

Somando: **~12-17s apenas nas chamadas de IA**. Mas o total é ~1 min. O restante vem de:

### Gargalos adicionais identificados no código

1. **RAG duplicado**: `knowledge-search` é chamado via HTTP **duas vezes** — uma no `intent-classifier` (linha 768) e outra no `response-generator` (linha 205). Cada chamada é um HTTP fetch para outra Edge Function que faz embedding + busca vetorial.

2. **HTTP fetch para `tokeniza-offers`**: O classifier chama `fetchActiveTokenizaOffers()` via HTTP (linha 762) para cada mensagem da Tokeniza.

3. **Fetch de `product_knowledge` + `knowledge_sections` + `knowledge_faq`**: Quando RAG não retorna resultados, o response-generator carrega tudo via queries sequenciais (linhas 292-333).

4. **`amelia_learnings` fetch**: Query adicional no classifier (linha 777).

5. **Operações pós-resposta sequenciais**: `executeActions` → `saveInterpretation` → `autoClassifyPreviousFeedback` → log de uso — todas sequenciais.

6. **Cold start**: Edge Functions com boot de ~30-47ms, mas se a função está fria, pode adicionar mais.

## Plano de otimização (3 partes)

### Parte 1: Eliminar RAG duplicado (maior impacto, ~5-8s)

O `intent-classifier` e o `response-generator` fazem a **mesma busca RAG** para a mesma mensagem. Solução:
- Fazer o RAG **uma vez** no `index.ts` (orquestrador), antes de chamar o classifier
- Passar o resultado (`ragContext`) como parâmetro tanto para `classifyIntent` quanto para `generateResponse`
- Eliminar os `fetchRelevantKnowledgeRAG()` internos de ambos os módulos

**Arquivos**: `sdr-ia-interpret/index.ts`, `intent-classifier.ts`, `response-generator.ts`

### Parte 2: Paralelizar carregamentos de contexto (~3-5s)

Atualmente, no classifier, estas operações são **sequenciais**:
- `fetchActiveTokenizaOffers()` 
- RAG ou `fetchProductKnowledge()`
- `amelia_learnings` query

Solução: usar `Promise.all()` para executar em paralelo:
```
const [offers, ragResult, learnings] = await Promise.all([
  empresa === 'TOKENIZA' ? fetchActiveTokenizaOffers() : null,
  fetchRelevantKnowledgeRAG(msg, empresa),
  supabase.from('amelia_learnings')...
]);
```

**Arquivo**: `sdr-ia-interpret/index.ts` (orquestrador centralizado)

### Parte 3: Paralelizar operações pós-resposta (~2-3s)

As operações após gerar a resposta (save, feedback, log) podem rodar em paralelo com `Promise.allSettled()`:
```
await Promise.allSettled([
  saveInterpretation(...),
  autoClassifyPreviousFeedback(...),
  supabase.from('ai_usage_log').insert(...)
]);
```

**Arquivo**: `sdr-ia-interpret/index.ts`

## Impacto estimado

| Antes | Depois | Ganho |
|---|---|---|
| ~45-60s total | ~15-25s | **50-60% mais rápido** |

A latência da IA em si (Haiku ~8s + Sonnet ~4s = 12s) é irreducível sem trocar modelo, mas eliminando duplicação e paralelizando I/O, o overhead cai drasticamente.

