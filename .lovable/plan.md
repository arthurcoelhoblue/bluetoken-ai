
Resumo do que está acontecendo agora (análise profunda, baseada em dados reais)
- O problema principal neste momento não é “falta de contexto da IA”. O motor de interpretação está quebrando na inicialização (erro de sintaxe), então a Amélia entra no fallback genérico do inbound.
- Evidência objetiva:
  1) `bluechat-inbound` está recebendo 503 em todas as tentativas para `sdr-ia-interpret`:
     - “SDR IA erro (tentativa 1/2/3)” com `status: 503` em sequência.
  2) Logs de `sdr-ia-interpret` mostram crash de boot:
     - `Uncaught SyntaxError: Identifier 'convState' has already been declared`
     - arquivo: `supabase/functions/sdr-ia-interpret/index.ts` (linha do runtime: 210).
  3) Nas últimas mensagens do Arthur, a partir de ~21:00, quase não há novas interpretações úteis em `lead_message_intents`; o que aparece no chat é fallback (“Desculpa, pode repetir…”), típico de indisponibilidade do interpretador.
  4) O estado conversacional no banco NÃO está vazio:
     - `estado_funil: FECHAMENTO`
     - `spin.s/p/i/n` preenchidos
     - `ia_null_count: 2`
    Isso confirma: o contexto existe, mas o processo que deveria usá-lo está indisponível.

Diagnóstico técnico raiz (root cause)
1) Quebra de deploy por variável duplicada no mesmo escopo
- Em `sdr-ia-interpret/index.ts`, existe:
  - `const convState = ...` (primeiro uso)
  - depois outro `const convState = ...` (segundo uso no mesmo bloco)
- Isso gera erro de parse em Deno e impede a função de subir.
- Resultado direto: toda chamada do inbound para interpretar volta 503.

2) Fallback do inbound transforma indisponibilidade técnica em “loop de qualificação”
- Quando `callSdrIaInterpret` retorna `null`, o `bluechat-inbound` responde com mensagem genérica e continua o fluxo.
- Em queda prolongada do interpretador, isso cria repetição (“desculpa, repete…”) sem progressão semântica, parecendo perda de contexto.

3) Escalação humana com erro de transferência
- Também há erro no callback de transferência:
  - `POST /tickets/transfer` 400: “Must specify toDepartmentId or toUserId”.
- Mesmo quando tenta escalar, a transferência no Blue Chat pode não concluir corretamente.

Plano de correção (implementação)
Fase 1 — Hotfix de disponibilidade (prioridade máxima)
- Arquivo: `supabase/functions/sdr-ia-interpret/index.ts`
  - Remover colisão de variável (`convState`), renomeando o segundo para algo como `convStateAntiLimbo` (ou equivalente) no bloco anti-limbo.
  - Objetivo: função voltar a bootar imediatamente e parar os 503.

Fase 2 — Blindagem do fluxo quando o interpretador estiver indisponível
- Arquivos: 
  - `supabase/functions/bluechat-inbound/sdr-bridge.ts`
  - `supabase/functions/bluechat-inbound/index.ts`
- Ajustes:
  - Em vez de retornar apenas `null`, retornar erro estruturado (ex.: `status`, `kind: 'infra_unavailable' | 'timeout' | 'client_error'`).
  - No inbound, separar:
    - Falha de IA/modelo (conteúdo ruim)
    - Falha de infraestrutura (503/boot error)
  - Para falha de infraestrutura:
    - Não tratar como “não entendi”.
    - Não fazer loop de perguntas de clarificação.
    - Responder mensagem de indisponibilidade temporária e escalar uma única vez por janela de tempo/conversa.
    - Persistir flag curta no `framework_data` (ex.: `sdr_unavailable_until`) para evitar spam repetido.

Fase 3 — Corrigir transferência de ticket na escalação
- Arquivo: `supabase/functions/bluechat-inbound/callback.ts`
- Ajustes:
  - Trocar payload de transferência para enviar `toDepartmentId` (ou `toUserId`) conforme exigência da API.
  - Implementar mapeamento `department -> departmentId` via configuração (por empresa), evitando 400.

Fase 4 — Observabilidade para não regressão
- Arquivos:
  - `sdr-ia-interpret/index.ts`
  - `bluechat-inbound/sdr-bridge.ts`
- Ajustes:
  - Logar `messageId`, `lead_id`, `conversation_id`, tipo de falha e decisão tomada (responder/escalar/silenciar).
  - Facilitar diagnóstico sem depender de leitura manual extensa de histórico.

Validação após correção (checklist objetivo)
1) Saúde da função
- Confirmar ausência de `worker boot error` em `sdr-ia-interpret`.
- Confirmar que `bluechat-inbound` para de registrar `SDR IA erro ... status: 503`.

2) Comportamento conversacional com Arthur (+351910506655)
- Enviar 3 mensagens reais (ex.: “quero contratar”, “quero saber preço”, “faço trade”).
- Esperado:
  - geração contextual (não fallback genérico repetido),
  - continuidade do funil com base em SPIN já salvo.

3) Persistência de interpretação
- Verificar novos registros em `lead_message_intents` para as novas mensagens.
- Verificar atualização coerente de `lead_conversation_state.framework_data` sem regressão.

4) Escalação operacional
- Forçar cenário de escalação e validar transferência sem 400 no endpoint `/tickets/transfer`.

Riscos e mitigação
- Risco: corrigir apenas o parse error e manter loop em futuras indisponibilidades.
  - Mitigação: Fase 2 (tratamento específico de indisponibilidade).
- Risco: continuar falhando na transferência humana.
  - Mitigação: Fase 3 com `toDepartmentId` configurado por empresa.

Resultado esperado após as correções
- A Amélia volta a usar o contexto que já existe.
- Sai o comportamento “sem memória” causado por fallback técnico.
- Em caso de nova indisponibilidade, o sistema não entra em looping de “não entendi”.
- Escalação para humano passa a funcionar de forma consistente.
