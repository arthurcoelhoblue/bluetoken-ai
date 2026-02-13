

## Plano: Integração SGT Completa com Score Duplo e Auto-Criação de Contato CRM

Cinco entregas alinhadas com os pontos aprovados.

---

### 1. Score Duplo: Marketing (SGT) + Comercial (CRM)

O SGT envia `score_temperatura` (0-200) e `prioridade` (URGENTE/QUENTE/MORNO/FRIO) como scores de marketing. O CRM já calcula `score_interno` (0-100) na tabela `lead_classifications` baseado em ICP, temperatura, engajamento Mautic/Chatwoot, etc.

**O que fazer:**
- Adicionar colunas `score_marketing` (int) e `prioridade_marketing` (text) na tabela `lead_contacts` para armazenar os valores vindos do SGT
- Criar coluna `score_composto` (int) em `lead_classifications` calculado como media ponderada: `(score_interno * 0.6) + (min(score_marketing, 100) * 0.4)`
- Atualizar o `sgt-webhook` para extrair `score_temperatura` e `prioridade` do payload e salvar em `lead_contacts`
- Atualizar `classificarLead()` para consultar o `score_marketing` do `lead_contacts` e incluí-lo no cálculo do `score_composto`

---

### 2. Colunas LinkedIn em `lead_contacts`

O payload do SGT agora envia `dados_linkedin` com URL, cargo, empresa, setor, senioridade e conexões. Atualmente não há onde armazenar esses dados.

**O que fazer:**
- Adicionar colunas: `linkedin_url` (text), `linkedin_cargo` (text), `linkedin_empresa` (text), `linkedin_setor` (text), `linkedin_senioridade` (text), `linkedin_conexoes` (int)
- Atualizar o `sgt-webhook` para extrair `dados_linkedin` e salvar no upsert de `lead_contacts`

---

### 3. Colunas extras Mautic e Chatwoot em `lead_contacts`

O payload envia campos adicionais que o CRM não armazena ainda: Mautic (`first_visit`, `cidade`, `estado`) e Chatwoot (`conversas_total`, `tempo_resposta_medio`, `agente_atual`, `inbox`, `status_atendimento`).

**O que fazer:**
- Adicionar colunas Mautic: `mautic_first_visit` (timestamptz), `mautic_cidade` (text), `mautic_estado` (text)
- Adicionar colunas Chatwoot: `chatwoot_conversas_total` (int), `chatwoot_tempo_resposta_medio` (int), `chatwoot_agente_atual` (text), `chatwoot_inbox` (text), `chatwoot_status_atendimento` (text)
- Atualizar o `sgt-webhook` para persistir esses campos no update de `lead_contacts`

---

### 4. Auto-criação de Contato CRM (tabela `contacts`)

Atualmente o fluxo para em `lead_contacts` + `pessoas`. Para que o time comercial veja o lead nas telas de Contatos e Pipeline, é preciso criar um registro na tabela `contacts`.

**O que fazer:**
- No `sgt-webhook`, após o upsert de `lead_contacts` e `pessoas`, verificar se já existe um `contact` vinculado a essa `pessoa_id` + `empresa`
- Se não existir, criar automaticamente com:
  - `pessoa_id` do match/criação anterior
  - `empresa` do payload
  - `nome`, `email`, `telefone` do lead
  - `canal_origem = 'SGT'`
  - `tipo = 'LEAD'`
  - `tags = ['sgt-inbound']`
  - `legacy_lead_id = lead_id` (para rastreio)
- Se já existir, fazer merge: atualizar campos que estejam nulos (telefone, email) sem sobrescrever dados preenchidos manualmente pelo closer

---

### 5. Atualização do `sgt-webhook` (Edge Function)

Consolidar todas as mudanças acima na edge function:

**Mudanças no payload/interfaces:**
- Adicionar `score_temperatura` e `prioridade` na interface `SGTPayload`
- Adicionar interface `DadosLinkedin`
- Expandir `DadosMautic` com `first_visit`, `cidade`, `estado`
- Expandir `DadosChatwoot` com `conversas_total`, `tempo_resposta_medio`, `agente_atual`, `inbox`, `status_atendimento`

**Mudanças no handler principal (fluxo):**
1. Upsert `lead_contacts` (já existe) — adicionar novos campos
2. Sanitização (já existe) — sem mudança
3. Upsert `pessoas` (já existe) — sem mudança
4. **Novo**: Upsert `contacts` (criar/merge contato CRM)
5. Classificação (já existe) — adicionar `score_composto`
6. Cadência (já existe) — sem mudança

---

### Secao Tecnica — Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| **Migration SQL** | Adicionar colunas LinkedIn, Mautic extras, Chatwoot extras, `score_marketing`, `prioridade_marketing` em `lead_contacts`; adicionar `score_composto` em `lead_classifications` |
| `supabase/functions/sgt-webhook/index.ts` | Editar — aceitar novos campos, auto-criar `contacts`, calcular score composto |
| `src/types/sgt.ts` | Editar — adicionar `DadosLinkedin`, `score_temperatura`, `prioridade` no tipo do payload |

### Diagrama do Fluxo Atualizado

```text
SGT Payload
    |
    v
sgt-webhook (validacao + idempotencia)
    |
    v
lead_contacts (upsert com LinkedIn, Mautic, Chatwoot, score_marketing)
    |
    v
sanitizacao (telefone E.164, email placeholder)
    |
    v
pessoas (match por telefone_base/email, criar se novo)
    |
    v
contacts (NOVO: auto-criar ou merge contato CRM)
    |
    v
lead_classifications (classificacao + score_composto)
    |
    v
lead_cadence_runs (iniciar cadencia se aplicavel)
```

