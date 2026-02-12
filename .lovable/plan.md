

# Patch 2: Contatos, Organizacoes, Campos Customizaveis, Pipelines Reais

## Resumo

Evoluir o modelo de dados do CRM com organizacoes (pessoa juridica), novos campos em contacts e deals, sistema EAV de campos customizaveis, 5 pipelines reais (substituindo os genericos do Patch 1), ~55 campos custom seedados, e 2 telas de configuracao admin.

---

## Parte 1: Migration SQL (uma unica migration)

### 1.1 Nova tabela: organizations
- Pessoa juridica com CNPJ, setor, porte, endereco, owner_id, tags
- Index trigram para busca por nome (extensao pg_trgm)
- Index unico em (cnpj, empresa)
- RLS: SELECT para autenticados, ALL para ADMIN/CLOSER

### 1.2 Evolucao: contacts (novos campos via ALTER TABLE)
- organization_id (FK para organizations)
- primeiro_nome, sobrenome, cpf, rg, telegram, endereco, foto_url
- is_cliente (BOOLEAN DEFAULT false)
- Indexes: organization_id, is_cliente, nome trigram

### 1.3 Evolucao: deals (novos campos via ALTER TABLE)
- organization_id (FK para organizations)
- etiqueta, data_ganho, data_perda
- UTM tracking: utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid
- Scores IA: score_engajamento, score_intencao, score_valor, score_urgencia (0-100)
- Nota: os scores usarao validation triggers em vez de CHECK constraints para evitar problemas de imutabilidade

### 1.4 Nova tabela: custom_field_definitions (EAV)
- Tipos de entidade: CONTACT, ORGANIZATION, DEAL (novo ENUM)
- Tipos de valor: TEXT, TEXTAREA, NUMBER, CURRENCY, DATE, DATETIME, BOOLEAN, SELECT, MULTISELECT, EMAIL, PHONE, URL, PERCENT, TAG (novo ENUM)
- Campos: slug, label, value_type, options_json, is_required, is_visible, is_system, grupo, posicao
- Indexes unicos em slug+entity_type+empresa
- RLS: SELECT para autenticados, ALL para ADMIN

### 1.5 Nova tabela: custom_field_values
- Valores EAV: field_id, entity_type, entity_id
- Colunas tipadas: value_text, value_number, value_boolean, value_date, value_json
- UNIQUE(field_id, entity_id)
- RLS: SELECT para autenticados, ALL para ADMIN/CLOSER

### 1.6 Seed: 5 Pipelines Reais (substituem os genericos do Patch 1)
Limpar pipelines sem deals vinculados, depois inserir:

| Pipeline | Empresa | Stages | Default? |
|----------|---------|--------|----------|
| Pipeline Comercial | BLUE | MQL, Levantada de mao, Atacar agora!, Contato Iniciado, Negociacao, Aguardando pagamento, Vendido (won), Perdido (lost) | Sim |
| Implantacao | BLUE | Aberto (comercial), Implantacao Iniciada, Atendimento Agendado, Aguard. Retorno do cliente, Docs recebidos Parcial, Docs recebidos Total, Implantacao Finalizada (won), Cancelado (lost) | Nao |
| Novos Negocios | TOKENIZA | Stand by, Leads Site, Contatado, Fase negociacao, Fase contratual, Oferta em estruturacao, Lancada (won), Perdido (lost) | Sim |
| Ofertas Publicas | TOKENIZA | Lead, Contato Iniciado, Contato estabelecido, Apresentacao, Cadastrado na Plataforma, Forecasting, Carteira (won), Perdido (lost) | Nao |
| Carteira Private | TOKENIZA | Base de clientes, Priorizados, Atendimento iniciado, Analise de Perfil, Definir estrategia, Relacionamento recorrente (won), Perdido (lost) | Nao |

### 1.7 Seed: ~55 Custom Fields
Campos categorizados por grupo: Comercial, Perfil, Cripto, Tokeniza, Blue CS, Marketing, Scores, Integracoes, Atividade, Dados PJ.

---

## Parte 2: Tipos TypeScript

### Novo arquivo: `src/types/customFields.ts`
- CustomFieldEntityType, CustomFieldValueType
- SelectOption, CustomFieldDefinition, CustomFieldValue, ResolvedCustomField
- Organization (completa com todos os campos)
- PipelineFormData, StageFormData, PipelineConfigData, DuplicatePipelineData

### Atualizar: `src/types/deal.ts`
- Adicionar campos novos ao Contact: organization_id, primeiro_nome, sobrenome, cpf, rg, telegram, endereco, foto_url, is_cliente
- Adicionar campos novos ao Deal: organization_id, etiqueta, data_ganho, data_perda, UTMs, scores

---

## Parte 3: Hooks

### Novo: `src/hooks/useCustomFields.ts`
- useCustomFieldDefinitions(entityType) -- filtrado por empresa ativa
- useAllFieldDefinitions() -- todas, para tela admin
- useCreateFieldDefinition(), useUpdateFieldDefinition(), useDeleteFieldDefinition()
- useCustomFieldValues(entityType, entityId)
- useUpsertFieldValue()
- useResolvedFields(entityType, entityId) -- definitions + values combinados com formatacao

### Novo: `src/hooks/useOrganizations.ts`
- useOrganizations(options) -- busca por nome/cnpj/nome_fantasia, filtro empresa
- useCreateOrganization(), useUpdateOrganization()

### Novo: `src/hooks/usePipelineConfig.ts`
- useCreatePipeline(), useUpdatePipeline(), useDeletePipeline()
- useCreateStage(), useUpdateStage(), useDeleteStage(), useReorderStages()
- useDuplicatePipeline()

---

## Parte 4: Paginas Admin

### Nova pagina: `src/pages/PipelineConfigPage.tsx`
- Lista todos os pipelines (todas empresas) como cards expansiveis
- Cada card mostra stages ordenados com drag para reordenar
- Inline editing de nome/cor/SLA de cada stage
- Badges para is_won/is_lost
- Botoes: novo funil, duplicar, excluir (com protecao se tem deals)
- Dialog para criar novo funil e duplicar existente

### Nova pagina: `src/pages/CustomFieldsConfigPage.tsx`
- Tabela com todos os campos custom definidos
- Filtros por entidade (CONTACT/ORGANIZATION/DEAL) e por grupo
- CRUD via dialog: label, slug (auto-gerado), tipo, grupo, empresa, obrigatorio, visivel
- Campos is_system nao podem ser excluidos (icone de cadeado)
- Contagem no rodape

---

## Parte 5: Rotas e Navegacao

### Atualizar: `src/App.tsx`
- Adicionar imports de PipelineConfigPage e CustomFieldsConfigPage
- Rotas protegidas (ADMIN): `/settings/pipelines` e `/settings/custom-fields`

### Atualizar: `src/components/layout/AppSidebar.tsx`
- No grupo Configuracao, adicionar:
  - "Funis" -> /settings/pipelines (icone Kanban)
  - "Campos" -> /settings/custom-fields (icone SlidersHorizontal)

---

## Sequencia de Implementacao

| # | Acao | Descricao |
|---|------|-----------|
| 1 | Migration SQL | organizations + ALTER contacts + ALTER deals + EAV tables + seed pipelines + seed campos |
| 2 | Criar src/types/customFields.ts | Tipos do EAV, Organization, PipelineConfig |
| 3 | Atualizar src/types/deal.ts | Novos campos em Contact e Deal |
| 4 | Criar src/hooks/useCustomFields.ts | CRUD definitions + values + resolved |
| 5 | Criar src/hooks/useOrganizations.ts | CRUD organizations |
| 6 | Criar src/hooks/usePipelineConfig.ts | CRUD pipelines + stages + duplicate |
| 7 | Criar src/pages/PipelineConfigPage.tsx | Editor de funis |
| 8 | Criar src/pages/CustomFieldsConfigPage.tsx | Editor de campos |
| 9 | Atualizar App.tsx | Novas rotas |
| 10 | Atualizar AppSidebar.tsx | Links Funis e Campos |

---

## Impacto e Notas

- Tabelas existentes (contacts, deals) recebem ALTER TABLE ADD COLUMN -- zero breaking change
- Pipelines genericos do Patch 1 sem deals sao removidos e substituidos pelos 5 reais
- Os scores usarao validation triggers (nao CHECK constraints) conforme guidelines
- Nenhuma dependencia npm nova necessaria (usa shadcn/ui existente)
- Os hooks existentes (usePipelines, useDeals, useContacts) continuam funcionando -- os novos campos sao opcionais

