

# Escalação Inteligente para Humano — Diagnóstico e Plano

## Diagnóstico: O que acontece HOJE

### `ESCALAR_HUMANO` (quando lead pede humano, dúvida técnica, anti-limbo)
1. Amélia envia mensagem de despedida ("Vou te conectar com alguém da equipe...")
2. Muda `modo` para `MANUAL` na `lead_conversation_state`
3. **Fim. Ninguém é alertado.** O lead fica no limbo esperando um humano que não sabe que precisa atuar.

### `CRIAR_TAREFA_CLOSER` (lead qualificado como SQL)
1. Chama `notify-closer` → cria registro em `closer_notifications` + envia email
2. Cria deal automaticamente no pipeline
3. Pausa cadência
4. Muda modo para MANUAL
5. **Funciona bem**, mas só dispara quando a IA classifica como lead qualificado

### Lacunas críticas
- **ESCALAR_HUMANO não notifica ninguém** — é a falha mais grave
- **Sem diferenciação de prioridade** — lead QUENTE com intenção de compra e lead FRIO pedindo humano recebem o mesmo tratamento (nenhum)
- **Sem progressão de funil automática** — a escalação não move o deal de estágio
- **Sem atribuição inteligente** — não direciona para o vendedor certo (owner do deal/contato)

---

## Plano de Implementação

### 1. Unificar escalação no `action-executor.ts`

Quando a ação for `ESCALAR_HUMANO`, aplicar a mesma lógica que `CRIAR_TAREFA_CLOSER` já tem, com adaptações:

- Chamar `notify-closer` passando contexto enriquecido (temperatura, intent, framework_data)
- Notificar via tabela `notifications` o **owner do contato/deal** (notificação in-app, não apenas email)
- Definir **prioridade** baseada em temperatura + intent:
  - `CRITICA`: QUENTE + INTERESSE_COMPRA/AGENDAMENTO_REUNIAO
  - `ALTA`: QUENTE ou INTERESSE_COMPRA isolado
  - `MEDIA`: MORNO ou pedido explícito de humano
  - `BAIXA`: FRIO ou anti-limbo

### 2. Notificação in-app diferenciada

Inserir na tabela `notifications` com campos distintos por prioridade:

| Prioridade | Título | Tipo |
|---|---|---|
| CRITICA | 🔴 Lead quente quer fechar: {nome} | ESCALA_URGENTE |
| ALTA | 🟠 Lead qualificado pede atendimento: {nome} | ESCALA_ALTA |
| MEDIA | 🟡 Lead pede contato humano: {nome} | ESCALA_MEDIA |
| BAIXA | ⚪ Conversa escalada: {nome} | ESCALA_BAIXA |

### 3. Progressão automática de estágio do deal

Quando `ESCALAR_HUMANO` ou `CRIAR_TAREFA_CLOSER` disparar e existir deal aberto:
- Se temperatura QUENTE + INTERESSE_COMPRA → mover deal para o estágio de negociação (configurável via `pipeline_auto_rules`)
- Se lead sem deal e temperatura QUENTE → criar deal automaticamente (reaproveitando `autoCreateDeal`)

### 4. Atribuição inteligente do destinatário

Lógica de quem recebe a notificação:
1. Se contato tem `owner_id` → notifica o owner
2. Se não tem owner → round-robin entre vendedores ativos da empresa
3. Se fora do horário comercial → agenda notificação para próximo horário comercial

### 5. Migration: adicionar campo `prioridade` à `closer_notifications`

```sql
ALTER TABLE closer_notifications 
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'MEDIA',
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS temperatura TEXT;
```

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/sdr-ia-interpret/action-executor.ts` | Enriquecer case `ESCALAR_HUMANO` com notificação + deal + atribuição |
| `supabase/functions/notify-closer/index.ts` | Aceitar campo `prioridade`, `intent`, `temperatura`; diferenciar assunto do email |
| `closer_notifications` (migration) | Adicionar colunas `prioridade`, `intent`, `temperatura` |
| `supabase/functions/sdr-ia-interpret/index.ts` | Passar temperatura e intent para `executeActions` no contexto de escalação |

