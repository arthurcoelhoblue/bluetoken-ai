# Auditoria Completa: Pontas Soltas do Blue CRM

## Resumo

Apos analise profunda de todo o codebase, organizei os achados em 4 categorias: **Paginas Shell (vazias)**, **UI desconectada do backend**, **Features com TODO/incompletas**, e **Oportunidades de ativacao rapida**.

---

## 1. PAGINAS SHELL (so exibem PageShell, sem funcionalidade)

Estas paginas mostram apenas um icone, titulo e descricao. Nao tem logica nem dados.


| Pagina                | Arquivo                         | Descricao                                                                      |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| **Cockpit Executivo** | `src/pages/CockpitPage.tsx`     | Apenas shell. "Patch 7 - Cockpit & Dashboards"                                 |
| **Renovacao & Churn** | `src/pages/RenovacaoPage.tsx`   | Apenas shell. "Patch 8 - Renovacao & Churn"                                    |
| **Templates**         | `src/pages/TemplatesPage.tsx`   | Apenas shell. "Incluso no Patch 3"                                             |
| **Integracoes**       | `src/pages/IntegracoesPage.tsx` | Apenas shell. Ja existe `/admin/settings` com configuracao funcional de canais |


### Acao recomendada

- **Integracoes**: Redirecionar para `/admin/settings` (tab Canais) ou mover o conteudo de IntegrationsTab para esta pagina.
- **Templates**: Criar CRUD basico de templates (a tabela pode ja existir no banco).
- **Cockpit**: Reaproveitar dados dos hooks `useAnalytics` + `useWorkbench` para montar um dashboard executivo.
- **Renovacao**: Depende de regras de negocio especificas. Pode ser implementado como um filtro de pipeline com alertas pre-vencimento.

---

## 2. UI DESCONECTADA DO BACKEND

### 2.1 Busca Global (TopBar)

- **Arquivo**: `src/components/layout/TopBar.tsx` (linhas 72-76)
- **Estado**: Placeholder visual apenas (div estatica com "Buscar..."). Nao tem `onClick`, nao tem `CommandDialog`, nao tem atalho `Cmd+K`.
- **Dependencia**: `cmdk` ja esta instalado no projeto.

### 2.2 Notificacoes (TopBar)

- **Arquivo**: `src/components/layout/TopBar.tsx` (linhas 78-82)
- **Estado**: Botao com icone de sino e bolinha vermelha fixa. Sem dropdown, sem contagem real, sem backend. Badge vermelho sempre visivel (falso positivo).

### 2.3 Filtros de Leads Quentes (nao funcionais)

- **Arquivo**: `src/pages/admin/LeadsQuentes.tsx` (linhas 191-210)
- **Estado**: Badges de filtro ("Quentes", "TOKENIZA", "BLUE", etc.) sao renderizados mas nao tem `onClick` funcional nem estado de filtro. Sao puramente visuais.

### 2.4 Pagina de Perfil (Me) - Provider hardcoded

- **Arquivo**: `src/pages/Me.tsx` (linha 146)
- **Estado**: O campo "Provider" mostra `Google OAuth` hardcoded. Deveria ler `user.app_metadata.provider` ou similar.

---

## 3. FEATURES COM TODO / INCOMPLETAS

### 3.1 Patch 12 - Envio real de mensagens em massa

- **Arquivo**: `src/hooks/usePatch12.ts` (linha 162)
- **Estado**: Contem `// TODO: trigger actual message sending via edge function`. A funcao de confirmar job de envio em massa atualiza o status no banco mas nao dispara efetivamente o envio.

### 3.2 Amelia Page - Central vazia

- **Arquivo**: `src/pages/AmeliaPage.tsx`
- **Estado**: Usa PageShell + um card de "Acao em Massa". Deveria ser a central de operacoes da SDR IA com metricas, conversas ativas, etc. O DashboardContent (`src/components/dashboard/DashboardContent.tsx`) ja tem essas metricas mas e acessado apenas pela rota `/` quando logado (que redireciona para `/meu-dia`). Esse dashboard antigo do SDR IA ficou orfao.

### 3.3 DashboardContent - Componente orfao

- **Arquivo**: `src/components/dashboard/DashboardContent.tsx`
- **Estado**: Dashboard completo com stats de eventos SGT, cadencias, leads quentes, graficos de intent, etc. Nao e referenciado por nenhuma rota ativa. Era o dashboard original da rota `/` mas foi substituido pelo WorkbenchPage.

---

## 4. OPORTUNIDADES DE ATIVACAO RAPIDA

### 4.1 Rota duplicada de Cadencias

- Existem **duas** entradas no menu para cadencias:
  - "Cadencias" (`/cadences`) - lista de cadencias SDR com steps
  - "Cadencias CRM" (`/cadencias-crm`) - cadencias vinculadas a deals com triggers
- Ambas funcionam, mas a UX pode confundir. Considerar unificar.

### 4.2 Rota de Atendimentos redireciona

- `src/App.tsx` linha 95: `/atendimentos` faz `Navigate to="/conversas"` - OK, mas a TopBar ainda lista "Atendimentos" como titulo (linha 24 da TopBar). Pode ser removido do mapa.

### 4.3 Rotas faltando na TopBar

As seguintes rotas nao tem titulo no `ROUTE_TITLES` da TopBar:

- `/meu-dia` (Workbench)
- `/organizacoes`
- `/pendencias`
- `/relatorios`
- `/cadencias-crm`
- `/capture-forms`
- `/importacao`
- `/admin/zadarma`
- `/settings/pipelines`
- `/settings/custom-fields`

Isso faz o titulo cair no fallback "Blue CRM" para essas paginas.

---

## Plano de Implementacao

### Fase 1 - Quick Fixes (sem mudanca de backend)

1. **TopBar - Busca Global**: Implementar `CommandDialog` com busca em leads, deals e contatos usando `cmdk` (ja instalado).
2. **TopBar - Notificacoes**: Esconder badge vermelho (nao ha backend). Adicionar dropdown vazio com "Nenhuma notificacao".
3. **TopBar - Rotas faltantes**: Adicionar todos os titulos que estao faltando no `ROUTE_TITLES`.
4. **Leads Quentes - Filtros**: Conectar os badges de filtro a estado real.
5. **Me - Provider**: Ler provider do auth metadata em vez de hardcode.

### Fase 2 - Ativar conteudo existente

6. **Amelia Page**: Mover o conteudo do `DashboardContent` (orfao) para a pagina Amelia, que e a central de operacoes da SDR IA.
7. **Integracoes Page**: Redirecionar `/integracoes` para `/admin/settings` (tab Canais), eliminando a shell.

### Fase 3 - Construir conteudo novo

8. **Cockpit Executivo**: Construir dashboard executivo usando os hooks `useAnalytics` e `useWorkbench` existentes.
9. **Templates**: Criar CRUD de templates de mensagem.
10. **Renovacao**: Implementar logica de renovacao/churn.
11. **Patch 12 TODO**: Conectar o envio em massa ao edge function real.

---

## Detalhes Tecnicos

### Busca Global (TopBar)

- Usar `CommandDialog` do `cmdk` (ja em `src/components/ui/command.tsx`)
- Buscar nas tabelas: `contacts`, `deals`, `lead_contacts`
- Atalho `Cmd+K` / `Ctrl+K`
- Debounce de 300ms na busca

### Notificacoes

- Trocar o botao por um `Popover` com mensagem "Nenhuma notificacao"
- Remover badge vermelho fixo (causa falso positivo)
- Backend de notificacoes pode ser implementado futuramente

### DashboardContent para Amelia

- Mover imports de `SdrIaMetricsCard`, `IntentChartCard`, `MessagesChartCard`, `CadenceStatusCard`, `ActionsBreakdownCard`, `LeadsQuentesCard` para `AmeliaPage.tsx`
- Remover `DashboardContent.tsx` apos migracao

### TopBar ROUTE_TITLES adicionais

```text
'/meu-dia': 'Meu Dia'
'/organizacoes': 'Organizacoes'
'/pendencias': 'Pendencias'
'/relatorios': 'Relatorios'
'/cadencias-crm': 'Cadencias CRM'
'/capture-forms': 'Formularios de Captura'
'/importacao': 'Importacao'
'/admin/zadarma': 'Telefonia'
'/settings/pipelines': 'Configuracao de Funis'
'/settings/custom-fields': 'Campos Customizaveis'
```