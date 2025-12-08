# PATCH 5A – Infraestrutura de Mensagens

## Metadados
- **Data**: 2024-12-08
- **Épico**: Motor de Mensagens
- **Status**: ✅ Implementado
- **Dependências**: PATCH 4 (Motor de Cadências)

---

## 1. Objetivo

Criar a infraestrutura base para execução de cadências:
- Tabela `message_templates` para armazenar templates de mensagens
- Tabela `lead_contacts` para cache de contatos dos leads
- Edge Function `cadence-runner` para processar cadências vencidas
- Disparo mockado (preparado para integração real no PATCH 5B)

---

## 2. Arquivos Modificados/Criados

### 2.1 Migration
```
supabase/migrations/[timestamp]_patch5a_messaging.sql
```
- Cria tabela `message_templates`
- Cria tabela `lead_contacts`
- Configura índices e triggers
- Aplica RLS
- Seed de templates iniciais

### 2.2 Edge Function
```
supabase/functions/cadence-runner/index.ts
```
- Busca runs ativas com `next_run_at` vencido
- Implementa lock otimista para evitar duplicação
- Resolve templates com placeholders
- Dispara mensagem (mock)
- Avança step ou conclui cadência

### 2.3 Atualização sgt-webhook
```
supabase/functions/sgt-webhook/index.ts
```
- Upsert em `lead_contacts` ao receber evento SGT
- Garante que contatos estejam disponíveis para o runner

### 2.4 Tipos TypeScript
```
src/types/messaging.ts
```
- `MessageTemplate`
- `LeadContact`
- `TemplateContext`
- `ResolvedMessage`
- `CadenceProcessResult`
- `CadenceRunnerResult`

---

## 3. Modelo de Dados

### 3.1 message_templates
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| empresa | empresa_tipo | TOKENIZA ou BLUE |
| canal | canal_tipo | WHATSAPP / EMAIL |
| codigo | text | Código único (TOKENIZA_INBOUND_DIA0) |
| nome | text | Nome amigável |
| descricao | text | Descrição de uso |
| conteudo | text | Corpo com placeholders |
| ativo | boolean | Se está disponível |
| created_at | timestamp | - |
| updated_at | timestamp | - |

**Constraint**: UNIQUE(empresa, codigo)

### 3.2 lead_contacts
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| lead_id | text | ID externo do lead |
| empresa | empresa_tipo | TOKENIZA ou BLUE |
| nome | text | Nome completo |
| email | text | Email |
| telefone | text | Telefone (só números) |
| primeiro_nome | text | Primeiro nome extraído |
| created_at | timestamp | - |
| updated_at | timestamp | - |

**Constraint**: UNIQUE(lead_id, empresa)

---

## 4. Templates Seed

### TOKENIZA
| Código | Nome | Uso |
|--------|------|-----|
| TOKENIZA_INBOUND_DIA0 | Boas-vindas Tokeniza | D+0 |
| TOKENIZA_INBOUND_DIA1 | Follow-up D+1 | D+1 |
| TOKENIZA_INBOUND_DIA3 | Follow-up D+3 | D+3 |
| TOKENIZA_MQL_QUENTE_IMEDIATO | MQL Quente - Imediato | +0min |
| TOKENIZA_MQL_QUENTE_4H | MQL Quente - 4h | +4h |

### BLUE
| Código | Nome | Uso |
|--------|------|-----|
| BLUE_INBOUND_DIA0 | Boas-vindas Blue | D+0 |
| BLUE_INBOUND_DIA1 | Follow-up D+1 | D+1 |
| BLUE_INBOUND_DIA3 | Follow-up D+3 | D+3 |
| BLUE_IR_URGENTE_IMEDIATO | IR Urgente - Imediato | +0min |
| BLUE_IR_URGENTE_2H | IR Urgente - 2h | +2h |

---

## 5. Placeholders Suportados

| Placeholder | Descrição |
|-------------|-----------|
| `{{nome}}` | Nome completo do lead |
| `{{primeiro_nome}}` | Primeiro nome |
| `{{email}}` | Email do lead |
| `{{empresa}}` | "Tokeniza" ou "Blue Consult" |

---

## 6. Fluxo do Cadence Runner

```
1. Buscar runs com status=ATIVA e next_run_at <= now()
   ↓
2. Para cada run:
   a. Lock otimista (atualiza next_run_at temporariamente)
   ↓
   b. Buscar step atual (ordem = next_step_ordem)
   ↓
   c. Buscar contato em lead_contacts
   ↓
   d. Resolver template (substituir placeholders)
   ↓
   e. Disparar mensagem (MOCK por enquanto)
   ↓
   f. Registrar evento DISPARADO
   ↓
   g. Verificar próximo step:
      - Se existe: atualizar next_step_ordem e next_run_at
      - Se não: marcar status=CONCLUIDA
```

---

## 7. Lock Otimista

Para evitar que o mesmo step seja disparado duas vezes:

```sql
UPDATE lead_cadence_runs 
SET next_run_at = now() + interval '5 minutes'
WHERE id = $run_id 
  AND next_run_at = $original_next_run_at
RETURNING *;
```

Se retornar vazio, outra instância já está processando.

---

## 8. Tratamento de Erros

| Situação | Ação |
|----------|------|
| Contato não encontrado | Evento ERRO + retry em 30min |
| Template não encontrado | Evento ERRO + retry em 30min |
| Erro no disparo | Evento ERRO + retry em 15min |
| Step não encontrado | Marca como CONCLUIDA |

---

## 9. Q&A de Testes

### ✅ Execução de step imediato
```bash
# 1. Criar run com next_run_at no passado
# 2. Chamar cadence-runner
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/cadence-runner \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json"

# Esperado:
# - Mensagem disparada (mock)
# - Evento DISPARADO criado
# - next_step_ordem avançado
```

### ✅ Conclusão de cadência
```bash
# Run no último step → status = CONCLUIDA
```

### ✅ Nenhuma run vencida
```bash
# Resposta: { processed: [], total: 0 }
```

### ✅ Erro de contato não encontrado
```bash
# Lead sem registro em lead_contacts
# Esperado: Evento ERRO + retry em 30min
```

### ✅ Idempotência (lock otimista)
```bash
# Duas chamadas simultâneas
# Apenas uma deve processar, outra retorna erro de lock
```

---

## 10. Próximos Passos (PATCH 5B)

1. **Integração WhatsApp**: Conectar com API real de mensageria
2. **Política de Retry**: Implementar backoff exponencial
3. **Máximo de tentativas**: Marcar como ERRO_FINAL após N falhas
4. **Métricas**: Registrar tempo de disparo, taxa de sucesso

---

## 11. Como Testar

```bash
# 1. Enviar lead via SGT (cria contato + cadência)
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-runner-001",
    "evento": "LEAD_NOVO",
    "empresa": "TOKENIZA",
    "timestamp": "2024-12-08T10:00:00Z",
    "dados_lead": {
      "nome": "João Silva",
      "email": "joao@teste.com",
      "telefone": "11999998888"
    },
    "dados_tokeniza": {
      "valor_investido": 5000
    }
  }'

# 2. Ajustar next_run_at para agora (via SQL ou esperar offset)

# 3. Executar runner
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/cadence-runner \
  -H "Authorization: Bearer $ANON_KEY"

# 4. Verificar eventos em lead_cadence_events
```
