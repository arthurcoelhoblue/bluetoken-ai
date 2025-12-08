# PATCH 4 - Motor de Cadências

## Metadados

| Campo | Valor |
|-------|-------|
| **Data** | 2024-12-08 |
| **Épico** | Motor de Cadências |
| **Status** | ✅ Implementado |
| **Dependências** | PATCH 2 (Webhook SGT), PATCH 3 (Classificação) |

## Objetivo

Implementar o motor de cadências que:
1. Decide qual cadência aplicar baseado na classificação + evento
2. Cria "runs" de cadência para leads
3. Agenda o primeiro passo da cadência
4. Registra logs de eventos de cadência

## Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/..._cadences.sql` | Migration | Tabelas cadences, cadence_steps, lead_cadence_runs, lead_cadence_events |
| `src/types/cadence.ts` | TS Types | Tipos TypeScript para cadências |
| `supabase/functions/sgt-webhook/index.ts` | Edge | Integração classificação → cadência |
| `docs/patches/PATCH-4_motor-cadencias.md` | Doc | Esta documentação |

## Modelo de Dados

### Tabela: `cadences`

Molde/template de uma cadência.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| empresa | empresa_tipo | TOKENIZA ou BLUE |
| codigo | text | Código único (ex: TOKENIZA_INBOUND_LEAD_NOVO) |
| nome | text | Nome legível |
| descricao | text | Descrição da cadência |
| ativo | boolean | Se está ativa |
| canal_principal | canal_tipo | WHATSAPP, EMAIL ou SMS |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |

### Tabela: `cadence_steps`

Passos de uma cadência.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| cadence_id | uuid | FK para cadences |
| ordem | int | 1, 2, 3... |
| offset_minutos | int | Tempo após início (0 = imediato, 1440 = 1 dia) |
| canal | canal_tipo | Canal do step |
| template_codigo | text | Código do template de mensagem |
| parar_se_responder | boolean | Parar cadência se lead responder |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |

### Tabela: `lead_cadence_runs`

Instância de cadência aplicada a um lead.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| lead_id | text | ID do lead |
| empresa | empresa_tipo | TOKENIZA ou BLUE |
| cadence_id | uuid | FK para cadences |
| status | cadence_run_status | ATIVA, CONCLUIDA, CANCELADA, PAUSADA |
| started_at | timestamp | Início da cadência |
| last_step_ordem | int | Último step executado |
| next_step_ordem | int | Próximo step |
| next_run_at | timestamp | Quando executar próximo step |
| classification_snapshot | jsonb | Snapshot da classificação |
| fonte_evento_id | uuid | FK para sgt_events |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |

### Tabela: `lead_cadence_events`

Log de eventos de cadência.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| lead_cadence_run_id | uuid | FK para lead_cadence_runs |
| step_ordem | int | Ordem do step |
| template_codigo | text | Template usado |
| tipo_evento | cadence_event_tipo | AGENDADO, DISPARADO, ERRO, RESPOSTA_DETECTADA |
| detalhes | jsonb | Detalhes do evento |
| created_at | timestamp | Data de criação |

## Cadências Seed

### TOKENIZA_INBOUND_LEAD_NOVO
- **Empresa**: TOKENIZA
- **Trigger**: evento = LEAD_NOVO
- **Steps**:
  1. Dia 0 (imediato) - TOKENIZA_INBOUND_DIA0
  2. Dia 1 (1440 min) - TOKENIZA_INBOUND_DIA1
  3. Dia 3 (4320 min) - TOKENIZA_INBOUND_DIA3

### TOKENIZA_MQL_QUENTE
- **Empresa**: TOKENIZA
- **Trigger**: evento = MQL ou CARRINHO_ABANDONADO + temperatura QUENTE
- **Steps**:
  1. Dia 0 (imediato) - TOKENIZA_MQL_URGENTE_DIA0
  2. +2h (120 min) - TOKENIZA_MQL_FOLLOWUP_2H
  3. Dia 1 (1440 min) - TOKENIZA_MQL_DIA1

### BLUE_INBOUND_LEAD_NOVO
- **Empresa**: BLUE
- **Trigger**: evento = LEAD_NOVO
- **Steps**:
  1. Dia 0 (imediato) - BLUE_INBOUND_DIA0
  2. Dia 1 (1440 min) - BLUE_INBOUND_DIA1
  3. Dia 2 (2880 min) - BLUE_INBOUND_DIA2

### BLUE_IR_URGENTE
- **Empresa**: BLUE
- **Trigger**: ICP = BLUE_ALTO_TICKET_IR ou (BLUE_RECURRENTE + MQL)
- **Steps**:
  1. Dia 0 (imediato) - BLUE_IR_URGENTE_DIA0
  2. +1h (60 min) - BLUE_IR_FOLLOWUP_1H
  3. Dia 1 (1440 min) - BLUE_IR_DIA1

## Regras de Decisão de Cadência

```typescript
function decidirCadenciaParaLead(classification, evento):
  
  if empresa === 'TOKENIZA':
    if (evento in ['MQL', 'CARRINHO_ABANDONADO'] && temperatura === 'QUENTE'):
      return 'TOKENIZA_MQL_QUENTE'
    if evento === 'LEAD_NOVO':
      return 'TOKENIZA_INBOUND_LEAD_NOVO'
  
  if empresa === 'BLUE':
    if (icp === 'BLUE_ALTO_TICKET_IR' || (icp === 'BLUE_RECURRENTE' && evento === 'MQL')):
      return 'BLUE_IR_URGENTE'
    if evento === 'LEAD_NOVO':
      return 'BLUE_INBOUND_LEAD_NOVO'
  
  return null  // Sem cadência
```

## Regras de Negócio

1. **No máximo 1 run ativa por lead+empresa**
   - Se já existir run ATIVA, não criar outra
   - Eventos subsequentes não iniciam nova cadência

2. **Cálculo de next_run_at**
   - `started_at + offset_minutos do primeiro step`

3. **Log de eventos**
   - Criar evento AGENDADO ao iniciar cadência
   - (PATCH 5 criará eventos DISPARADO)

## Q&A de Testes

| # | Cenário | Entrada | Resultado Esperado |
|---|---------|---------|-------------------|
| 1 | Lead novo Tokeniza | evento=LEAD_NOVO, empresa=TOKENIZA | Cadência TOKENIZA_INBOUND_LEAD_NOVO, run criado, step 1 agendado |
| 2 | MQL Tokeniza quente | evento=MQL, temperatura=QUENTE, empresa=TOKENIZA | Cadência TOKENIZA_MQL_QUENTE |
| 3 | Lead Blue novo | evento=LEAD_NOVO, empresa=BLUE | Cadência BLUE_INBOUND_LEAD_NOVO |
| 4 | Blue IR urgente | icp=BLUE_ALTO_TICKET_IR, evento=MQL | Cadência BLUE_IR_URGENTE |
| 5 | Lead já com cadência ativa | 2 eventos LEAD_NOVO seguidos | Apenas 1 run criada (segundo skipped) |
| 6 | Evento sem cadência | evento=SCORE_ATUALIZADO | Classificação atualizada, sem cadência |

## Exemplo de Teste

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "lead_patch4_test_001",
    "evento": "LEAD_NOVO",
    "empresa": "TOKENIZA",
    "timestamp": "2024-12-08T15:00:00Z",
    "dados_lead": {
      "nome": "João Teste Cadência",
      "email": "joao.cadencia@teste.com",
      "telefone": "11999998888"
    },
    "dados_tokeniza": {
      "valor_investido": 7000,
      "qtd_investimentos": 6
    }
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "event_id": "...",
  "classification": {
    "icp": "TOKENIZA_EMERGENTE",
    "persona": "INICIANTE_CAUTELOSO",
    "temperatura": "MORNO",
    "prioridade": 3
  },
  "cadence": {
    "codigo": "TOKENIZA_INBOUND_LEAD_NOVO",
    "run_id": "...",
    "skipped": false
  }
}
```

## Próximos Passos (PATCH 5)

- Motor de mensagens/IA
- Disparo real de mensagens via WhatsApp
- Progressão automática de steps
- Detecção de respostas
