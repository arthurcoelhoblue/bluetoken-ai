
# Analise de Prontidao para Migracao do Pipedrive

## Resumo Executivo

O Blue CRM ja possui a maior parte da infraestrutura necessaria para substituir o Pipedrive. Os 5 pipelines estao configurados com stages reais, o Kanban funciona, o detalhe do deal e completo, e os relatorios estao robustos. Porem, existem lacunas operacionais que impediriam o uso diario pela equipe.

---

## O que ja esta pronto (Paridade com Pipedrive)

| Funcionalidade Pipedrive | Status no CRM | Observacao |
|--------------------------|---------------|------------|
| Kanban de Deals | PRONTO | Com drag-and-drop, SLA, progresso |
| Detalhe do Deal | PRONTO | Timeline, atividades, campos custom, scores |
| Contatos / Pessoas | PRONTO | Busca, filtros, paginacao, detalhe |
| Organizacoes | PRONTO | CRUD completo com stats |
| Funis (Pipelines) | PRONTO | 5 funis reais configurados |
| Motivos de Perda | PRONTO | 7 categorias + CRUD para admin |
| Campos Personalizados | PRONTO | 55 campos configurados (EAV) |
| Relatorios / Analytics | PRONTO | Funil, conversao, vendedores, LTV, esforco |
| Templates de Mensagem | PRONTO | 19 templates |
| Cadencias Automatizadas | PRONTO | WhatsApp + Email, 5 cadencias ativas |
| WhatsApp Integrado | PRONTO | Inbound + Outbound + SDR IA |
| Telefonia (Zadarma) | PRONTO | Click-to-call, historico no deal |
| Email SMTP | PRONTO | Envio via cadencias |
| Importacao Pipedrive | PRONTO | Wizard JSON com mapeamento |
| Controle de Acesso | PRONTO | RBAC granular por tela |
| Metas e Comissoes | PRONTO | Ranking, sazonalidade, meta anual |

---

## O que falta (Gaps Criticos para Migracao)

### Gap 1: Dados Reais Nao Importados
**Impacto: BLOQUEANTE**

O wizard de importacao nunca foi executado. Ha apenas 105 contatos (provavelmente de teste), 0 organizacoes e 1 deal. Para migrar a equipe, e necessario:

- Exportar deals, persons e organizations do Pipedrive (JSON)
- Executar o wizard de importacao mapeando pipelines e stages
- Validar integridade dos dados pos-importacao

**Acao:** Nao requer desenvolvimento. E uma acao operacional usando a ferramenta ja existente em /importacao.

---

### Gap 2: Roles dos Vendedores
**Impacto: BLOQUEANTE**

Nenhum usuario tem a role CLOSER, que e necessaria para acessar:
- Conversas
- Metas e Comissoes
- Cockpit Executivo
- Relatorios
- Acao em Massa

Atualmente todos sao ADMIN ou READONLY. Os vendedores precisam receber a role CLOSER.

**Acao:** Configuracao via Settings > Controle de Acesso (ja existe a tela).

---

### Gap 3: Filtro por Vendedor no Pipeline
**Impacto: IMPORTANTE**

O Pipedrive permite filtrar o Kanban por vendedor responsavel. O CRM so filtra por temperatura. Isso dificulta o gestor ver o funil de cada vendedor.

**Acao:** Adicionar select de vendedor nos filtros do Pipeline (componente PipelineFilters.tsx).

---

### Gap 4: Envio de Email Direto do Deal
**Impacto: IMPORTANTE**

No Pipedrive, voce envia email direto do deal. No CRM, email so sai via cadencias automatizadas. Falta:
- Botao "Enviar Email" na timeline do deal
- Dialog com destinatario pre-preenchido, assunto, corpo
- Usar a edge function email-send existente
- Registrar como atividade do tipo EMAIL

**Acao:** Criar componente EmailFromDeal na timeline do DealDetailSheet.

---

### Gap 5: Visao de Agenda / Atividades Pendentes
**Impacto: MODERADO**

O Pipedrive tem uma visao de calendario/agenda. O CRM tem tarefas pendentes no Workbench (Meu Dia), mas nao uma visao de calendario dedicada. O "Meu Dia" ja mostra tarefas hoje/atrasadas e SLA, o que cobre a necessidade basica.

**Acao:** Pode ser implementado depois. O Workbench ja supre a necessidade minima.

---

### Gap 6: Produtos/Itens no Deal
**Impacto: BAIXO**

Pipedrive permite associar produtos a deals. O CRM so tem valor total. Se a operacao nao depende de detalhamento por produto, isso pode ser adiado.

**Acao:** Adiavel. Pode ser implementado como fase 2.

---

### Gap 7: Metas Nao Configuradas
**Impacto: MODERADO**

A infraestrutura de metas esta pronta (ranking, comissoes, meta anual com sazonalidade), mas nenhuma meta foi cadastrada. Sem metas, o ranking aparece vazio.

**Acao:** Configuracao operacional. Usar o botao "Meta Anual" para definir metas com sazonalidade para 2026.

---

## Plano de Acao Consolidado

### Fase 1: Ajustes de Codigo (o que implementar)

1. **Filtro por vendedor no Pipeline**
   - Adicionar select de owner nos PipelineFilters
   - Passar ownerId para useDeals (ja suporta o parametro)

2. **Envio de email direto do deal**
   - Novo componente `EmailFromDealDialog`
   - Botao na toolbar de atividades do DealDetailSheet
   - Usa edge function email-send existente
   - Registra deal_activity tipo EMAIL

3. **Mapeamento de owner na importacao**
   - Adicionar secao de mapeamento de owners no wizard
   - Mapear user_id do Pipedrive para profile.id do CRM
   - Gravar owner_id nos deals e contacts importados

### Fase 2: Configuracao Operacional (sem codigo)

4. Atribuir role CLOSER aos vendedores via Settings
5. Exportar JSONs do Pipedrive (deals, persons, organizations)
6. Executar importacao via /importacao
7. Cadastrar metas 2026 usando Meta Anual com sazonalidade
8. Configurar regras de comissao
9. Validar dados importados

### Fase 3: Pos-Migracao (melhorias futuras)

10. Visao de calendario/agenda
11. Produtos/itens no deal
12. Sincronizacao bi-direcional em tempo real (pipedrive-sync ja existe mas desativado)

---

## Detalhes Tecnicos da Fase 1

### 1. Filtro por Vendedor no Pipeline

**Arquivo:** `src/components/pipeline/PipelineFilters.tsx`
- Adicionar select com lista de vendedores (query profiles com role CLOSER ou ADMIN)
- Passar selectedOwnerId como prop

**Arquivo:** `src/pages/PipelinePage.tsx`
- Novo estado `ownerId`
- Passar para useDeals (o hook ja aceita o parametro)

### 2. Email Direto do Deal

**Novo componente:** `src/components/deals/EmailFromDealDialog.tsx`
- Props: dealId, contactEmail, contactNome
- Campos: destinatario (pre-preenchido), assunto, corpo (textarea)
- Botao enviar chama supabase.functions.invoke('email-send')
- onSuccess: registra deal_activity tipo EMAIL

**Arquivo:** `src/components/deals/DealDetailSheet.tsx`
- Adicionar botao Mail ao lado dos tipos de atividade
- Ao clicar, abre EmailFromDealDialog

### 3. Mapeamento de Owner na Importacao

**Arquivo:** `src/pages/ImportacaoPage.tsx`
- Nova secao no step "mapping": mapeamento de user_id Pipedrive para profile CRM
- Extrair user_ids unicos dos deals

**Arquivo:** `src/hooks/useImportacao.ts`
- Adicionar `owner_mapping` ao ImportConfig
- Na importacao de deals, usar owner_mapping para definir owner_id
- Na importacao de contacts, usar owner_mapping se disponivel

**Arquivo:** `src/types/importacao.ts`
- owner_mapping ja existe no tipo ImportConfig (ja previsto)
