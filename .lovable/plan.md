

# Fix: Proibir Amélia de prometer enviar conteúdo "depois"

## Problema
A IA prometeu "Tá indo! Resumo saindo agora..." mas nunca enviou o resumo real, porque não há mecanismo de follow-up automático. O lead ficou sem resposta.

## Solução
Adicionar regra explícita nos 3 prompts da IA para NUNCA prometer envio futuro — todo conteúdo deve ser incluído na própria resposta.

### Alterações

**1. `intent-classifier.ts` — `SYSTEM_PROMPT` (linha ~361)**
Adicionar ao bloco de COMUNICAÇÃO:
```
NUNCA prometa enviar algo depois ("vou te mandar", "já envio", "segue o resumo"). 
Inclua TODO o conteúdo na PRÓPRIA resposta. Se não tiver a informação, diga que vai verificar com a equipe.
```

**2. `intent-classifier.ts` — `PASSIVE_CHAT_PROMPT` (linha ~347)**
Adicionar regra equivalente ao bloco de COMUNICAÇÃO.

**3. `response-generator.ts` — prompt default (linha ~218)**
Adicionar a mesma regra no `systemPrompt` padrão do gerador de respostas.

Estas são alterações em 2 arquivos dentro de `supabase/functions/sdr-ia-interpret/`, com redeploy automático.

