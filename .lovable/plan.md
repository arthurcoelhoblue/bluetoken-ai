#  Fechamento dos Gaps: Regras Automaticas + ClickToCall no Deal

## Resumo

Dois gaps identificados na auditoria serao corrigidos:

1. **Tab "Regras Automaticas"** no PipelineConfigPage -- a tabela `pipeline_auto_rules` ja existe no banco mas nao ha UI para gerencia-la
2. **ClickToCallButton** no header do DealDetailSheet -- o botao de ligar esta presente em leads/contatos mas ausente no detalhe do deal

---

## Gap 1: Tab de Regras Automaticas no PipelineConfigPage

### O que sera feito

Transformar o `PipelineConfigPage` em uma pagina com **2 tabs**:

- **Funis e Stages** (conteudo atual, sem alteracoes)
- **Regras Automaticas** (novo, CRUD completo sobre `pipeline_auto_rules`)

### Componente novo: `AutoRulesTab.tsx`

Localizado em `src/components/pipeline/AutoRulesTab.tsx`, contendo:

- Listagem de regras agrupadas por pipeline, mostrando:
  - Stage origem -> Stage destino
  - Tipo de gatilho (com label legivel)
  - Status ativo/inativo (Switch)
  - Botao excluir
- Dialog para criar nova regra com campos:
  - Pipeline (select)
  - Stage origem (select, filtrado pelo pipeline selecionado)
  - Stage destino (select, filtrado pelo pipeline selecionado)
  - Tipo de gatilho (select): `ATIVIDADE_CRIADA`, `SLA_ESTOURADO`, `SCORE_THRESHOLD`
  - Configuracao do gatilho (campo JSON contextual):
    - Para `ATIVIDADE_CRIADA`: select do tipo de atividade
    - Para `SLA_ESTOURADO`: sem config extra
    - Para `SCORE_THRESHOLD`: input numerico para limiar

### Hook novo: `useAutoRules.ts`

Localizado em `src/hooks/useAutoRules.ts`:

- `useAutoRules()` -- query que busca todas as regras com join nos nomes dos stages
- `useCreateAutoRule()` -- mutation insert
- `useUpdateAutoRule()` -- mutation update (toggle ativo)
- `useDeleteAutoRule()` -- mutation delete

### Alteracao no PipelineConfigPage

- Importar `Tabs, TabsList, TabsTrigger, TabsContent`
- Envolver o conteudo existente na tab "Funis e Stages"
- Adicionar tab "Regras Automaticas" renderizando `<AutoRulesTab />`

---

## Gap 2: ClickToCallButton no DealDetailSheet

### O que sera feito

Adicionar o `ClickToCallButton` no header do `DealDetailSheet`, ao lado do botao do Copilot, usando o telefone do contato vinculado ao deal.

### Alteracao no DealDetailSheet.tsx

- Importar `ClickToCallButton` de `@/components/zadarma/ClickToCallButton`
- No header (linha ~199), entre o titulo e o CopilotPanel, inserir:

```text
<ClickToCallButton
  phone={deal.contact_telefone}
  contactName={deal.contact_nome}
  dealId={deal.id}
/>
```

- Verificar se `contact_telefone` ja vem na query do `useDealDetail`; se nao, adicionar ao select

---

## Secao Tecnica

### Arquivos criados


| Arquivo                                    | Descricao                                               |
| ------------------------------------------ | ------------------------------------------------------- |
| `src/hooks/useAutoRules.ts`                | Hook com query + 3 mutations para `pipeline_auto_rules` |
| `src/components/pipeline/AutoRulesTab.tsx` | Componente completo da tab de regras                    |


### Arquivos editados


| Arquivo                                    | Alteracao                                                      |
| ------------------------------------------ | -------------------------------------------------------------- |
| `src/pages/PipelineConfigPage.tsx`         | Adicionar Tabs wrapper com 2 abas                              |
| `src/components/deals/DealDetailSheet.tsx` | Inserir ClickToCallButton no header                            |
| `src/hooks/useDealDetail.ts`               | Garantir que `contact_telefone` esta no select (se necessario) |


### Nenhuma migracao SQL necessaria

A tabela `pipeline_auto_rules` ja existe com todas as colunas necessarias (`id`, `pipeline_id`, `empresa`, `from_stage_id`, `to_stage_id`, `trigger_type`, `trigger_config`, `is_active`, `created_at`, `updated_at`).