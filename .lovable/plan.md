
# Roteamento Inteligente de Leads + Deteccao de Duplicatas

## Resumo

Plano unificado que combina duas funcionalidades criticas:
1. **Roteamento inteligente**: leads do SGT e Blue Chat vao para o pipeline e estagio corretos, baseado em empresa + tipo de lead + temperatura
2. **Deteccao de duplicatas**: antes de criar qualquer deal, o sistema busca por contatos existentes com deals abertos usando multiplos criterios (CPF, telefone, email, variacoes de telefone)

---

## PARTE 1 — Regras de Roteamento por Empresa

### BLUE (Pipeline Comercial - id: 21e577cc)

Todos os leads Blue (PF e PJ) vao para o Pipeline Comercial. O estagio depende da temperatura:

| Temperatura | Estagio | ID do Stage |
|---|---|---|
| FRIO | MQL (posicao 1) | 7e6ee75a |
| MORNO | Levantada de mao (posicao 2) | bb39da09 |
| QUENTE | Atacar agora! (posicao 3, is_priority) | e7cca7b0 |

### TOKENIZA — Investidores (Pipeline Ofertas Publicas - id: 5bbac98b)

Leads marcados como `INVESTIDOR` (ou sem tipo definido, que e o default):

| Temperatura | Estagio | ID do Stage |
|---|---|---|
| FRIO | Lead (posicao 1) | da80e912 |
| MORNO | Contato Iniciado (posicao 3) | 90b33102 |
| QUENTE | Atacar agora! (posicao 2, is_priority) | c48dc6c2 |

### TOKENIZA — Captadores (Pipeline Novos Negocios - id: a74d511a)

Leads marcados como `CAPTADOR`:

| Temperatura | Estagio | ID do Stage |
|---|---|---|
| FRIO | Stand by (posicao 1) | f45b020e |
| MORNO | Leads Site (posicao 2) | ece6bc09 |
| QUENTE | Contatado (posicao 3) | 34aa1201 |

### Novo campo: `tipo_lead`

Novo campo opcional no payload do SGT (`dados_lead.tipo_lead`) e do Blue Chat (`context.tipo_lead`):
- Valores: `INVESTIDOR` | `CAPTADOR`
- Default para TOKENIZA: `INVESTIDOR`
- Para BLUE: campo ignorado (todos vao para Pipeline Comercial)

---

## PARTE 2 — Deteccao Inteligente de Duplicatas

### Problema

Hoje a verificacao de duplicata so checa `contact_id + pipeline_id + status = ABERTO`. Se a mesma pessoa entra por caminhos diferentes (SGT com lead_id diferente, Blue Chat, formulario), pode gerar deals duplicados.

### Solucao: Busca Multi-Criterio

Nova funcao `findExistingDealForPerson` executada ANTES de criar qualquer deal. Busca contacts com deal ABERTO na mesma empresa usando:

1. **CPF exato** -- match perfeito (quando disponivel)
2. **telefone_e164 exato** -- match perfeito
3. **Variacoes de telefone** (com/sem 9o digito, com/sem DDI) -- match forte
4. **Email exato** (excluindo placeholders como `nao@tem.com`) -- match forte

Se qualquer criterio encontrar um contact com deal aberto naquela empresa, o sistema NAO cria novo deal. Apenas loga a deteccao e, opcionalmente, enriquece o contact existente com dados novos.

### Fluxo Completo (SGT e Blue Chat)

```text
Lead chega (SGT ou Blue Chat)
      |
  Localizar/criar lead_contact
      |
  Localizar contact CRM (via legacy_lead_id ou trigger)
      |
  findExistingDealForPerson(empresa, telefone, email, cpf)
      |
  Match encontrado? ----SIM----> Log "duplicata detectada"
      |                           Enriquecer contact com dados novos
      |                           NAO criar deal
      |
      NAO
      |
  resolveTargetPipeline(empresa, tipoLead, temperatura)
      |
  Criar deal no pipeline + estagio correto
      |
  Notificacao se QUENTE
  Cadencia de aquecimento se FRIO
```

---

## PARTE 3 — Blue Chat Auto-Criacao de Deal

Hoje o `bluechat-inbound` NAO cria deals. Sera adicionado um bloco apos a localizacao/criacao do lead:

1. Buscar contact CRM correspondente ao lead
2. Executar `findExistingDealForPerson` (verificacao de duplicata)
3. Se nao ha duplicata, chamar `resolveTargetPipeline` para determinar pipeline + stage
4. Criar deal com titulo "[Nome] - Blue Chat"
5. Se QUENTE, criar notificacao para vendedor

---

## Secao Tecnica

### Funcao `resolveTargetPipeline`

Substitui a logica atual que busca apenas o pipeline default + primeiro estagio:

```text
function resolveTargetPipeline(empresa, tipoLead, temperatura):
  
  if empresa === 'BLUE':
    pipelineId = '21e577cc-32eb-4f1c-895e-b11bfc056e99'
    stageId = mapa temperatura -> stage BLUE

  if empresa === 'TOKENIZA':
    if tipoLead === 'CAPTADOR':
      pipelineId = 'a74d511a-f8b4-4d14-9f5c-0c13da61cb15'
      stageId = mapa temperatura -> stage Novos Negocios
    else:
      pipelineId = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c'
      stageId = mapa temperatura -> stage Ofertas Publicas

  // Override para prioridade urgente (SGT com stage='Atacar agora!' ou prioridade='URGENTE')
  if isPriority:
    stageId = stage com is_priority=true no pipeline selecionado

  return { pipelineId, stageId }
```

### Funcao `findExistingDealForPerson`

```text
function findExistingDealForPerson(supabase, empresa, dados):
  // 1. Busca por CPF
  if dados.cpf:
    buscar contacts com cpf=dados.cpf + deal ABERTO na empresa
    se encontrar -> retornar { contactId, dealId }

  // 2. Busca por telefone_e164
  if dados.telefone_e164:
    buscar contacts com telefone_e164=dados.telefone_e164 + deal ABERTO
    se encontrar -> retornar

  // 3. Busca por variacoes de telefone
  if dados.telefone:
    gerar variacoes (com/sem 9o digito, com/sem DDI)
    buscar contacts com telefone_e164 IN variacoes + deal ABERTO
    se encontrar -> retornar

  // 4. Busca por email (excluir placeholders)
  if dados.email e nao eh placeholder:
    buscar contacts com email=dados.email + deal ABERTO
    se encontrar -> retornar

  return null  // nenhum duplicata encontrado
```

A busca usa o Supabase client (sem SQL raw):

```typescript
const { data } = await supabase
  .from('contacts')
  .select('id, deals!inner(id, pipeline_id)')
  .eq('empresa', empresa)
  .in('telefone_e164', phoneVariations)
  .eq('deals.status', 'ABERTO')
  .limit(1)
  .maybeSingle();
```

### Merge de dados

Quando duplicata detectada, dados novos enriquecem o contact existente:
- Email preenchido se estava vazio
- Telefone atualizado se o novo for mais completo
- Nome atualizado se estava vazio

### Alteracoes no SGT Webhook (`sgt-webhook/index.ts`)

1. Adicionar tipo `TipoLead = 'INVESTIDOR' | 'CAPTADOR'`
2. Adicionar funcao `resolveTargetPipeline` com mapas de stage por empresa/temperatura
3. Adicionar funcao `findExistingDealForPerson` com busca multi-criterio
4. Substituir bloco atual (linhas ~1947-2107) que busca pipeline default + primeiro stage pela nova logica de roteamento inteligente + deteccao de duplicata
5. Ler `tipo_lead` do payload: `payload.dados_lead?.tipo_lead || payload.tipo_lead`

### Alteracoes no Blue Chat Inbound (`bluechat-inbound/index.ts`)

1. Adicionar `tipo_lead` na interface `BlueChatPayload.context`
2. Adicionar funcao `resolveTargetPipeline` (mesma logica)
3. Adicionar funcao `findExistingDealForPerson` (mesma logica)
4. Adicionar funcao `generatePhoneVariationsForSearch` (ja existe `generatePhoneVariations`, reutilizar)
5. Novo bloco de auto-criacao de deal apos localizacao do lead:
   - Buscar contact CRM
   - Verificar duplicata
   - Criar deal se nao duplicata
   - Notificacao para leads quentes

### Sem migracoes SQL

Todos os pipelines, stages e colunas necessarias ja existem. A logica e 100% nas edge functions.

### Sem alteracoes de frontend

O roteamento e backend. O Kanban continua funcionando normalmente.

### Funcoes editadas

1. `supabase/functions/sgt-webhook/index.ts`
2. `supabase/functions/bluechat-inbound/index.ts`
