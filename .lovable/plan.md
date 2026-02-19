

# Auto-criacao de Incidencias CS a partir de conversas Blue Chat

## Objetivo

Sempre que uma conversa no Blue Chat envolver um cliente CS (Tokeniza ou Blue), registrar automaticamente uma incidencia no modulo CS contendo o resumo da conversa gerado pela IA. Isso alimenta o historico do cliente, contribui para o calculo do CSAT e impacta o health score.

## Como funciona hoje

1. O `bluechat-inbound` recebe mensagens do Blue Chat
2. A Amelia (SDR IA) interpreta e responde
3. Quando a conversa encerra (acao RESOLVE), gera um `resolution.summary` e `resolution.reason`
4. O ticket e resolvido no Blue Chat
5. **Nenhum registro e feito no CS** - essa informacao se perde

## Solucao

### Etapa 1: Detectar cliente CS no `bluechat-inbound`

Apos resolver o lead/contact, verificar se existe um `cs_customer` vinculado a esse contato. A logica:

```text
1. Buscar contact CRM via legacy_lead_id (ja existe no fluxo atual)
2. Se contact encontrado, buscar cs_customer por contact_id + empresa
3. Se cs_customer existe -> marcar como cliente CS
```

### Etapa 2: Criar incidencia automatica ao encerrar conversa

Quando a acao for RESOLVE e o lead for um cliente CS:

```text
1. Coletar todas as mensagens da conversa (INBOUND + OUTBOUND) do lead
2. Gerar resumo via IA (callAI) com contexto de CS
3. Inserir em cs_incidents com:
   - customer_id: id do cs_customer
   - empresa: empresa do contexto
   - tipo: 'SOLICITACAO' (ou determinar via IA: RECLAMACAO, INSATISFACAO, etc)
   - gravidade: determinada pela IA com base no sentimento
   - titulo: resumo curto gerado pela IA
   - descricao: resumo completo da conversa
   - origem: 'BLUECHAT'
   - status: 'RESOLVIDA' (ja que o ticket foi encerrado)
   - resolved_at: timestamp atual
   - detectado_por_ia: true
```

### Etapa 3: Trigger CSAT automatico

O sistema ja possui o trigger `fn_cs_auto_csat_on_resolve` que dispara automaticamente uma pesquisa CSAT quando uma incidencia muda para status RESOLVIDA. Ao criar a incidencia com status RESOLVIDA, o CSAT sera enviado automaticamente.

### Etapa 4: Impacto no Health Score

As incidencias ja alimentam o health score via:
- `cs-health-calculator`: conta incidencias abertas na dimensao de engajamento
- `cs-ai-actions`: analisa sentimento das incidencias para detectar risco
- O CSAT coletado atualiza a dimensao CSAT do health score

Nao e necessario alterar o calculador de health - ele ja consome incidencias.

## Detalhes tecnicos

### Alteracao principal: `supabase/functions/bluechat-inbound/index.ts`

Adicionar um novo modulo `cs-incident-bridge.ts` no diretorio `bluechat-inbound/`:

```text
Funcao: maybeCreateCSIncident(supabase, leadContact, empresa, messages, resolution)
  1. Buscar contact CRM: contacts WHERE legacy_lead_id = lead_id AND empresa
  2. Buscar cs_customer: cs_customers WHERE contact_id AND empresa
  3. Se nao encontrar cs_customer -> retornar (nao e cliente CS)
  4. Buscar ultimas mensagens da conversa (limit 50)
  5. Chamar callAI para:
     - Classificar tipo (RECLAMACAO, SOLICITACAO, INSATISFACAO, OUTRO)
     - Determinar gravidade (BAIXA, MEDIA, ALTA, CRITICA)
     - Gerar titulo curto (max 80 chars)
     - Gerar descricao com resumo completo
  6. Inserir cs_incidents
  7. Logar sucesso
```

### Prompt da IA para classificacao

```text
Voce e uma analista de Customer Success. Analise a conversa abaixo entre um cliente 
e a equipe comercial. Classifique:
1. tipo: RECLAMACAO | SOLICITACAO | INSATISFACAO | OUTRO
2. gravidade: BAIXA | MEDIA | ALTA | CRITICA
3. titulo: resumo em 1 frase (max 80 chars)
4. descricao: resumo completo do que foi tratado, decisoes tomadas e proximo passos

Responda em JSON: { tipo, gravidade, titulo, descricao }
```

### Integracao no fluxo principal

No `index.ts`, apos a acao RESOLVE (linha ~706), chamar:

```text
if (response.action === 'RESOLVE') {
  // ... codigo existente de ticket_resolved ...
  
  // CS: criar incidencia se for cliente CS
  await maybeCreateCSIncident(supabase, leadContact, empresa, resolution);
}
```

### Tambem para conversas nao-RESOLVE

Alem do RESOLVE, criar incidencia tambem quando:
- Acao e ESCALATE (transferencia para humano = potencial problema)
- Nesse caso, status sera 'ABERTA' (nao resolvida)

### Arquivo novo: `supabase/functions/bluechat-inbound/cs-incident-bridge.ts`

Contera:
- `maybeCreateCSIncident()`: funcao principal
- Logica de busca de cs_customer
- Chamada a IA para classificacao
- Insercao em cs_incidents

### Alteracao: `supabase/functions/bluechat-inbound/index.ts`

- Importar `maybeCreateCSIncident` do novo modulo
- Chamar apos RESOLVE (criar incidencia resolvida)
- Chamar apos ESCALATE (criar incidencia aberta)

## Fluxo completo

```text
Blue Chat -> bluechat-inbound
  -> Identifica lead
  -> Busca contact CRM
  -> Verifica se e cs_customer
  -> SDR IA processa mensagem
  -> Se RESOLVE ou ESCALATE:
     -> Coleta mensagens da conversa
     -> IA classifica (tipo, gravidade, titulo, descricao)
     -> Insere cs_incidents
     -> Se RESOLVIDA: trigger CSAT automatico
     -> Health score recalculado no proximo ciclo
```

## Ordem de execucao

1. Criar `supabase/functions/bluechat-inbound/cs-incident-bridge.ts`
2. Alterar `supabase/functions/bluechat-inbound/index.ts` para integrar
3. Deploy da edge function
4. Testar com uma conversa real no Blue Chat

