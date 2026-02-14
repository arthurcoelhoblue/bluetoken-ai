
# Distribuicao Automatica de Leads com Criacao de Deals

## Resumo

Implementar a criacao automatica de deals para TODOS os leads que chegam via SGT webhook, com roteamento inteligente baseado na temperatura e em comandos explicitos das paginas de vendas.

---

## Fluxo de Distribuicao

```text
Lead chega via SGT Webhook
        |
        v
  Contato criado/atualizado (ja existe)
        |
        v
  Classificacao (ICP, temperatura, score)
        |
        v
  +-----------+------------+-----------------+
  |           |            |                 |
  v           v            v                 v
COMANDO     QUENTE       MORNO            FRIO
"atacar"
  |           |            |                 |
  v           v            v                 v
Atacar      MQL/Lead     MQL/Lead        MQL/Lead
agora!     + Notifica   + Notifica      + Cadencia
           vendedor     vendedor        aquecimento
                                        (Amelia + Email)
```

---

## Parte 1: Migracao SQL

### 1A. Novo estagio "Atacar agora!" no pipeline Ofertas Publicas (TOKENIZA)

Inserir um novo stage na posicao 2 (empurrando os demais para frente) no pipeline `Ofertas Publicas` da Tokeniza, espelhando o que ja existe no Pipeline Comercial da Blue.

### 1B. Tabela de configuracao de roteamento (opcional mas recomendada)

Adicionar uma coluna `is_priority` (boolean, default false) na tabela `pipeline_stages` para marcar estagios de alta prioridade como "Atacar agora!". Isso permite que o webhook identifique dinamicamente qual estagio usar sem hardcoding de IDs.

---

## Parte 2: Logica de Criacao de Deal no SGT Webhook

### Onde: `supabase/functions/sgt-webhook/index.ts`

Apos o bloco de criacao/merge de contato CRM (linha ~1803), adicionar uma nova secao `AUTO-CRIACAO DE DEAL`:

### Logica de roteamento:

1. **Detectar comando "atacar agora"**: verificar se o payload contem `dados_lead.stage === 'Atacar agora!'` OU `dados_lead.data_levantou_mao` preenchido OU `event_metadata.pagina_visitada` com indicacao de urgencia
2. **Determinar pipeline**: usar o pipeline comercial default de cada empresa
   - BLUE: `Pipeline Comercial` (id: `21e577cc-...`)
   - TOKENIZA: `Ofertas Publicas` (id: `5bbac98b-...`)
3. **Determinar estagio**:
   - Comando de prioridade detectado → stage com `is_priority = true` ("Atacar agora!")
   - QUENTE ou MORNO → primeiro estagio do pipeline (MQL / Lead)
   - FRIO → primeiro estagio do pipeline + iniciar cadencia de aquecimento
4. **Evitar duplicatas**: verificar se ja existe deal ABERTO para o mesmo `contact_id` no mesmo pipeline antes de criar

### Dados do deal criado:

- `titulo`: "{nome do lead} -- Inbound SGT"
- `contact_id`: ID do contato CRM recem-criado
- `pipeline_id`: pipeline comercial da empresa
- `stage_id`: conforme roteamento acima
- `temperatura`: conforme classificacao
- `canal_origem`: "SGT"
- `status`: "ABERTO"
- UTMs copiados do lead (`utm_source`, `utm_medium`, `utm_campaign`, etc.)

### Atividade automatica:

Apos criar o deal, inserir uma `deal_activity` do tipo `CRIACAO` com descricao indicando a origem automatica e a temperatura.

---

## Parte 3: Cadencia de Aquecimento para Leads FRIOS

### Nova cadencia: `WARMING_INBOUND_FRIO`

Sera necessario criar registros nas tabelas `cadences` e `cadence_steps` para uma cadencia generica de aquecimento que combine:

- Mensagem Amelia (WhatsApp) de saudacao
- Email de apresentacao (apos X horas)
- Follow-up WhatsApp (apos X dias)
- Reclassificacao automatica: se o lead responder e for reclassificado como MORNO/QUENTE, a cadencia e concluida e o deal avanca

Essa cadencia sera criada via migracao SQL com steps pre-configurados. A logica de execucao ja existe no `cadence-runner`.

---

## Parte 4: Notificacao ao Vendedor

Para leads QUENTE e "Atacar agora!", alem de criar o deal, dispara-se uma notificacao interna (tabela `notifications`) para o owner do pipeline ou vendedor designado, alertando sobre o novo deal prioritario.

---

## Secao Tecnica

### Migracao SQL

| Acao | Descricao |
|------|-----------|
| INSERT stage | "Atacar agora!" no pipeline Ofertas Publicas (TOKENIZA), posicao 2 |
| UPDATE stages | Reposicionar stages existentes (posicao >= 2) para abrir espaco |
| ALTER TABLE | Adicionar coluna `is_priority` em `pipeline_stages` (boolean, default false) |
| UPDATE stages | Marcar "Atacar agora!" como `is_priority = true` em ambos os pipelines |
| INSERT cadence | Cadencia "Aquecimento Inbound Frio" para cada empresa |
| INSERT steps | 3-4 steps de aquecimento (WhatsApp + Email) |

### Arquivos editados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sgt-webhook/index.ts` | Nova secao de auto-criacao de deal apos contato CRM (~100 linhas) |

### Arquivos nao alterados

- Nenhum componente frontend precisa mudar -- os deals criados ja aparecem automaticamente no Kanban existente
- O `capture-form-submit` ja cria deals para forms de captura (fluxo independente)

### Riscos e mitigacoes

- **Duplicatas**: check de deal ABERTO existente para mesmo contact_id + pipeline_id antes de inserir
- **Lead descartado**: a criacao de deal so ocorre APOS a sanitizacao passar (lead nao descartado)
- **Modo MANUAL**: se o lead ja esta em modo MANUAL, o deal e criado mas sem cadencia automatica
