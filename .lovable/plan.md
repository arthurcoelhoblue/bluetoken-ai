
# Substituir "Responder no Blue Chat" por "Abordar via Amelia" com Contexto Inteligente

## Resumo

Transformar o botao "Responder no Blue Chat" (no `ManualMessageInput`) em um botao de abordagem proativa pela Amelia, com contexto rico. O botao existente do `DealDetailHeader` (icone Bot) ja faz uma abordagem proativa, mas com um prompt generico e raso. A mudanca principal e evoluir o `sdr-proactive-outreach` para carregar contexto profundo (historico de conversas, deals, classificacao, SGT, frameworks SPIN/GPCT/BANT) e gerar uma abordagem inteligente e contextualizada.

## O que muda

### 1. Frontend — `ManualMessageInput.tsx`

Substituir o bloco "Responder no Blue Chat" (linhas 146-161) por um botao "Abordar via Amelia" que:
- Chama `sdr-proactive-outreach` passando o `motivo` contextualizado (ex: "follow-up", "qualificacao")
- Mostra loading state com spinner
- Exibe toast de sucesso/erro
- Mantém o deeplink do Blue Chat como link secundario (texto menor, "Ver no Blue Chat")

O textarea e botao de envio manual continuam existindo abaixo, sem mudanca.

### 2. Backend — `sdr-proactive-outreach/index.ts`

Evolucao significativa para carregar contexto completo antes de gerar a mensagem:

**Novos dados carregados (em paralelo):**
- Historico de mensagens (ultimas 20 via `lead_messages`)
- Estado da conversa (`lead_conversation_state` com framework_data SPIN/GPCT/BANT)
- Classificacao do lead (`lead_classifications` — temperatura, ICP, perfil)
- Deal ativo (titulo, valor, estagio, SLA)
- Eventos SGT recentes (`sgt_events` — ultimos 5)
- Pessoa/relacionamentos cross-company (via `pessoa_id`)
- Aprendizados validados da Amelia (`amelia_learnings`)

**Prompt evoluido:**
Em vez do prompt fixo de "primeiro contato", a IA recebe todo o contexto e decide autonomamente:
- Se e primeiro contato ou retomada
- Se o objetivo e follow-up, qualificacao, agendamento ou fechamento
- Qual framework aplicar (SPIN/GPCT/BANT) baseado no estado atual
- Tom adequado ao perfil DISC do lead
- Referencia a interacoes anteriores para demonstrar continuidade

**Regra de negocio ajustada:**
- Remover o rate-limit de 24h para outbound (ou tornar configuravel via parametro `bypass_rate_limit`), ja que a abordagem agora e manual e intencional pelo vendedor
- Aceitar um parametro opcional `objetivo` no body (ex: "follow_up", "agendar_reuniao", "reengajar") para guiar a IA

### 3. Detalhes Tecnicos

**`ManualMessageInput.tsx` — Bloco Blue Chat:**
```
[Botao] Abordar via Amelia (icone Bot + loading)
[Link pequeno] Ver no Blue Chat (icone ExternalLink)
[Textarea + Send] Enviar via Blue Chat... (sem mudanca)
```

**`sdr-proactive-outreach/index.ts` — Novo fluxo:**
```
1. Auth + validacao
2. Fetch lead data
3. [NOVO] Carregar contexto completo em paralelo:
   - lead_messages (20 ultimas)
   - lead_conversation_state (frameworks)
   - lead_classifications
   - deals (aberto, via contact)
   - sgt_events (5 ultimos)
   - amelia_learnings (5 validados)
   - pessoa + relacionamentos
4. [EVOLUIDO] Gerar mensagem com prompt contextualizado
5. Resolver Blue Chat config
6. Abrir conversa + enviar
7. Registrar mensagem + atualizar estado
```

**System prompt evoluido (resumo):**
```
Voce e a Amelia, SDR da {empresa}.
Analise TODO o contexto fornecido e gere UMA mensagem de abordagem.
- Se ja houve conversa anterior, retome naturalmente
- Se tem framework incompleto, avance na qualificacao
- Adapte tom ao perfil DISC
- Maximo 250 caracteres
- Objetivo: {objetivo || "qualificar e avancar conversa"}
```

**User prompt contextualizado:**
```
LEAD: {nome}
TEMPERATURA: {temp}
ESTADO_FUNIL: {estado}
FRAMEWORK: SPIN(S:{s}, P:{p}...) | GPCT(G:{g}...)
DEAL: {titulo} - {estagio} - R${valor}
HISTORICO (ultimas 5):
[OUTBOUND] Oi Joao, tudo bem?
[INBOUND] Oi, quero saber mais
...
SGT: {eventos recentes}
OBJETIVO: {motivo}
```

### 4. Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/conversas/ManualMessageInput.tsx` | Substituir "Responder no Blue Chat" por botao Amelia + link secundario |
| `supabase/functions/sdr-proactive-outreach/index.ts` | Carregar contexto completo, prompt evoluido, rate-limit flexivel |
