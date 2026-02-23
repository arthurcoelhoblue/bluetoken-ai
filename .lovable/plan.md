
Resumo do debug profundo (com dados reais da conversa do Arthur)
- O contexto do Arthur NÃO está perdido.
  - `lead_conversation_state` do lead `3c6f90e1-194f-4c69-b0d8-e5c3a7ddfaf8` está em `FECHAMENTO`.
  - `framework_data.spin` está preenchido (`s/p/i/n`) e atualizado.
- O loop acontece porque a classificação cai repetidamente em fallback determinístico (`OUTRO`, confiança `0.3`) em mensagens que são claras.
  - Exemplos reais das últimas mensagens:
    - “Usei 3” → `OUTRO 0.3`, `intent_summary = Classificação determinística`
    - “Usei 3 exchanges” → `OUTRO 0.3`, `Classificação determinística`
    - “Mas como vcs coletam os dados das exchanges?” → `OUTRO 0.3`, `Classificação determinística`
    - “Não, quero entender melhor. Vocês me dão suporte pra eu fazer o IR?” → `OUTRO 0.3`, `Classificação determinística`
- Em paralelo, há respostas boas intercaladas (`OUTRO 0.98`) — por isso parece que “vai e volta”.
  - Ex.: “Quero saber como vcs coletam...” teve resposta técnica ótima.
  - Logo em seguida volta para “Não entendi...”.

Resposta direta à sua pergunta sobre modelo
- Não é “só o modelo”, mas o modelo está contribuindo.
- Hoje o `sdr-intent-classifier` força `model: 'gemini-flash'` (resolve para `gemini-3-flash-preview`), e o pipeline depende de JSON estrito em texto livre.
- Evidência de fragilidade:
  - Últimas 24h (empresa BLUE): 35 classificações, 14 com `Classificação determinística` (40% de fallback).
- Conclusão:
  - O problema principal é contrato de saída frágil (JSON parse) + lógica de fallback/anti-limbo.
  - O modelo atual amplifica isso por variar mais formato de saída.

Onde está falhando exatamente (arquivos e pontos)
1) `supabase/functions/sdr-ia-interpret/intent-classifier.ts`
- Falha estrutural:
  - Quando não consegue parsear JSON, cai em:
    - `intent: 'OUTRO'`
    - `confidence: 0.3`
    - `summary: 'Classificação determinística'`
- Isso está disparando em mensagens normais do Arthur.
- Bug de lógica na detecção de resposta curta contextual:
  - O código faz `reverse().find(...)` para achar a “última outbound”.
  - Como o histórico já vem em ordem decrescente, esse `reverse()` faz pegar a outbound antiga (não a mais recente).
  - Resultado: override de “Usei 3” não ativa.

2) `supabase/functions/sdr-ia-interpret/index.ts`
- Anti-limbo trata `OUTRO 0.3` como falha e injeta clarificação (“Não entendi...”).
- Como isso acontece de forma intermitente, gera o padrão de looping percebido na conversa.

3) `supabase/functions/bluechat-inbound/index.ts`
- Existe dedupe por conteúdo em 30s (escopado por lead).
- Em cenários de repetição legítima (“Usei 3”, “como assim?”), pode silenciar nova tentativa válida e atrapalhar recuperação de contexto.

Plano de correção proposto (implementação)
Fase 1 — Corrigir a causa principal do “vai e volta” (classificação instável)
- Arquivo: `sdr-ia-interpret/intent-classifier.ts`
- Ações:
  1. Fortalecer parser de saída:
     - Extração robusta de JSON (não-gulosa/balanceada).
     - Se parse falhar, fazer “repair pass” controlado (segunda tentativa para retornar JSON válido) antes do fallback 0.3.
  2. Registrar motivo explícito do fallback (parse_fail, empty_content, schema_invalid) para observabilidade.
  3. Aplicar validação de schema em runtime antes de aceitar resultado.

Fase 2 — Corrigir bug da resposta curta contextual
- Arquivo: `sdr-ia-interpret/intent-classifier.ts`
- Ações:
  1. Remover a inversão incorreta na busca da última outbound.
  2. Garantir que “Usei 3”, “3 exchanges”, “duas”, etc. após pergunta objetiva da Amélia entrem como progresso.
  3. Marcar `_isContextualShortReply = true` de forma confiável.

Fase 3 — Blindar anti-limbo para não punir mensagens claras
- Arquivo: `sdr-ia-interpret/index.ts`
- Ações:
  1. Se houver sinais semânticos claros de dúvida de produto/preço/processo (“como”, “preço”, “suporte”, “exchange”, “IR”), não cair em “não entendi” mesmo se classificação vier fraca.
  2. Tratar fallback determinístico como “incerteza técnica de parser/modelo”, não como incompreensão do lead.
  3. Preservar escalonamento apenas para falhas reais consecutivas.

Fase 4 — Ajustar deduplicação para não suprimir retomada legítima
- Arquivo: `bluechat-inbound/index.ts`
- Ações:
  1. Priorizar idempotência por `whatsapp_message_id`.
  2. Reduzir impacto do dedupe por conteúdo (manter apenas como proteção secundária e mais restrita).

Fase 5 — Responder sua dúvida de modelo com teste A/B controlado
- Arquivo: `sdr-ia-interpret/intent-classifier.ts` + `_shared/ai-provider.ts`
- Ações:
  1. Rodar canário:
     - caminho A: atual (Gemini Flash)
     - caminho B: fallback de maior robustez de formato (ex.: Claude via cadeia já existente)
  2. Medir:
     - taxa de `Classificação determinística`
     - taxa de “Não entendi” indevido
     - continuidade sem loop por conversa
  3. Decidir modelo por evidência, não percepção.

Critérios de sucesso (aceite)
- Conversa do Arthur não volta para “Não entendi...” após “Usei 3” e após perguntas claras sobre processo.
- Queda da taxa de `Classificação determinística` para patamar baixo e estável.
- `ia_null_count` deixa de subir em respostas contextuais válidas.
- Continuidade de funil em `FECHAMENTO` com respostas técnicas consistentes.

Risco principal e mitigação
- Risco: trocar modelo sem corrigir parser/lógica e manter loop.
- Mitigação: atacar primeiro parser + detecção contextual + anti-limbo; depois avaliar modelo com A/B e métrica objetiva.
