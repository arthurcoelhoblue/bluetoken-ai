
Objetivo
- Resolver o looping na conversa do Arthur (+351910506655), onde a Amélia “avança” e em seguida volta para mensagens de “não entendi”, mesmo com contexto já construído.

Diagnóstico consolidado (baseado no que está no banco e logs)
1) O contexto do Arthur existe e está preenchido
- `lead_conversation_state` do lead está em `estado_funil = FECHAMENTO`.
- `framework_data.spin` está preenchido (`s/p/i/n`) e `ia_null_count = 2`.
- Portanto, não é “falta de contexto salvo”; é falha de uso do contexto na decisão da próxima resposta.

2) O looping recente acontece exatamente após resposta curta contextual
- Sequência observada:
  - Amélia pergunta preço/plano e “quantas exchanges você usou”.
  - Arthur responde “Usei 3” / “Usei 3 exchanges”.
  - Classificador retorna `intent=OUTRO`, `confidence=0.3`, com resposta de clarificação.
- Isso dispara anti-limbo de clarificação novamente, mesmo sendo resposta válida de continuidade.

3) Problema estrutural adicional que agrava inconsistência
- Em `bluechat-inbound/index.ts`, há `upsert` em `lead_conversation_state` com `onConflict: 'lead_id,empresa'`.
- A tabela possui UNIQUE em `(lead_id, empresa, canal)`, então esse `onConflict` é inválido.
- Isso gera erro SQL recorrente (“no unique or exclusion constraint matching ON CONFLICT”), deixando dados auxiliares (como `bluechat_conversation_id`) desatualizados.

4) Risco de perda de mensagens por deduplicação excessiva
- Há dedupe por conteúdo nos últimos 30s sem escopo por lead/conversa (`eq('conteudo', payload.message.text)` global).
- Isso pode suprimir mensagens legítimas de leads diferentes com texto igual (“sim”, “ok”, “usei 3”), causando sensação de “sem contexto”.

Plano de correção (implementação)
Fase 1 — Corrigir persistência de estado (alta prioridade)
- Arquivo: `supabase/functions/bluechat-inbound/index.ts`
- Ajustes:
  - Remover `upsert(... onConflict: 'lead_id,empresa')` para `lead_conversation_state`.
  - Trocar por estratégia segura:
    - `update` por `(lead_id, empresa)` quando existir estado.
    - fallback `insert` com `canal: 'WHATSAPP'` quando não existir.
  - Resultado esperado: parar erros SQL de ON CONFLICT e manter `framework_data`/conversation metadata consistentes.

Fase 2 — Tornar o classificador robusto para “respostas curtas de continuidade”
- Arquivo: `supabase/functions/sdr-ia-interpret/intent-classifier.ts`
- Ajustes:
  - Incluir regra determinística antes/depois da IA para detectar resposta curta contextual:
    - quando a última OUTBOUND da Amélia foi pergunta objetiva (ex.: “quantas exchanges”, “quantas operações”, “volume”),
    - e a INBOUND atual traz número/quantificador curto (“usei 3”, “3 exchanges”, “duas”, “poucas”).
  - Nesses casos:
    - não classificar como falha (`OUTRO 0.3`);
    - forçar intenção útil (ex.: `DUVIDA_PRECO`/`INTERESSE_IR` conforme contexto), `deve_responder=true`;
    - gerar `resposta_sugerida` de continuidade (sem pedir “pode reformular?”).
  - Manter compatível com SPIN/BANT/GPCT já normalizados.

Fase 3 — Blindagem do anti-limbo para não punir resposta contextual válida
- Arquivo: `supabase/functions/sdr-ia-interpret/index.ts`
- Ajustes:
  - Antes de aplicar fallback de clarificação, calcular `isContextualShortReply` usando:
    - mensagem atual curta + presença de numeral/quantificador,
    - última pergunta outbound recente da Amélia.
  - Se `isContextualShortReply=true`, tratar como progresso:
    - não incrementar `ia_null_count`;
    - preferir resposta de continuidade (mesmo com confiança menor).
  - Manter escalonamento de 3 falhas reais para casos realmente sem compreensão.

Fase 4 — Corrigir deduplicação para evitar supressão indevida
- Arquivo: `supabase/functions/bluechat-inbound/index.ts`
- Ajustes:
  - Remover ou escopar dedupe por conteúdo:
    - incluir `lead_id` e `empresa` (ou `conversation_id`) no filtro;
    - preferir dedupe por `whatsapp_message_id` (já existe no `saveInboundMessage`).
  - Evitar dedupe global cross-lead por texto idêntico.

Fase 5 — Observabilidade para fechar o ciclo de debug
- Arquivos:
  - `supabase/functions/sdr-ia-interpret/index.ts`
  - `supabase/functions/sdr-ia-interpret/intent-classifier.ts`
  - `supabase/functions/bluechat-inbound/index.ts`
- Logs adicionais:
  - `messageId`, `lead_id`, `estado_funil`, `ia_null_count`, `isContextualShortReply`,
  - motivo da decisão (clarificação vs continuidade vs escalação),
  - identificação da “última pergunta outbound” usada como contexto.

Validação (focada no Arthur)
1) Reproduzir com sequência real:
- “Antes preciso saber dos preços...”
- “Usei 3”
- “Usei 3 exchanges”

2) Resultado esperado:
- sem mensagens “Não entendi...” nesses dois últimos passos;
- resposta de continuidade contextual;
- `ia_null_count` não sobe indevidamente.

3) Verificações de dados:
- novos registros em `lead_message_intents` com confiança/intent coerentes;
- `lead_conversation_state.framework_data` atualizado sem erros de upsert;
- ausência de novos erros SQL de ON CONFLICT nos logs.

Riscos e mitigação
- Risco: regras contextuais ficarem específicas demais.
  - Mitigação: implementar heurística genérica baseada em “última pergunta outbound + resposta curta com numeral”, não hardcode por frase única.
- Risco: reduzir dedupe e aceitar duplicata real.
  - Mitigação: manter dedupe por `whatsapp_message_id` como controle primário (idempotência).

Resultado esperado final
- A Amélia para de “perder a linha” após respostas curtas válidas.
- Conversa com Arthur continua de forma consultiva sem regressão para loop de clarificação.
- Estado conversacional passa a ser persistido de forma consistente, sem erro estrutural de conflito.
