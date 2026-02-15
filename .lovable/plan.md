

# Plano de Acao - Auditoria BlueToken AI

Relatorio recebido com nota de maturidade **6.5/10**. Abaixo, o plano para atacar os problemas identificados em ordem de prioridade, focando no que gera impacto real em estabilidade e seguranca.

---

## RESUMO DA AUDITORIA

| Area | Nota | Status |
|------|------|--------|
| Funcionalidade | 8/10 | OK |
| Qualidade de Codigo | 5/10 | Precisa melhorar |
| Testes | 2/10 | Critico |
| Seguranca | 5/10 | Precisa melhorar |
| Performance | 6/10 | Atencao |
| Documentacao | 6/10 | Atencao |

---

## FASE 1 - CRITICO (Seguranca + Validacao)

### 1.1 Validacao de entrada nas Edge Functions publicas
Adicionar validacao Zod no body de todas as Edge Functions que recebem dados externos (webhooks e endpoints publicos). Funcoes prioritarias:
- `sgt-webhook`
- `bluechat-inbound`
- `whatsapp-inbound`
- `capture-form-submit`
- `zadarma-webhook`

Para cada uma: parsear o body com um schema Zod e retornar 400 se invalido, antes de processar qualquer logica.

### 1.2 Rate Limiting basico nos webhooks
Implementar rate limiting via tabela `rate_limits` no banco, com verificacao nas Edge Functions publicas. Logica simples: contar requests por IP/minuto e rejeitar com 429 acima do threshold.

### 1.3 CORS restritivo
Substituir `Access-Control-Allow-Origin: '*'` por whitelist com os dominios reais do projeto:
- `https://sdrgrupobue.lovable.app` (producao)
- Dominio de preview (desenvolvimento)

Criar constante compartilhada em `supabase/functions/_shared/cors.ts` e importar em todas as 46 funcoes.

---

## FASE 2 - ALTA (Qualidade de Codigo)

### 2.1 Eliminar `any` nos arquivos mais criticos
A auditoria encontrou 92 ocorrencias de `any`. Priorizar os que tocam operacoes de banco:
- Hooks de deals, contacts, cadences
- Edge Functions que fazem insert/update

Substituir por tipos especificos do `src/integrations/supabase/types.ts` ou criar interfaces dedicadas.

### 2.2 Quebrar hooks grandes
Os hooks mais criticos para dividir:
- `useCadences.ts` (752 linhas) -> dividir em `useCadenceList`, `useCadenceActions`, `useCadenceRuns`
- `useLeadClassification.ts` (293 linhas) -> dividir em `useClassification`, `useClassificationUpdate`
- `useDeals.ts` (289 linhas) -> dividir em `useDealList`, `useDealMutations`

### 2.3 Quebrar Edge Functions grandes
- `sgt-webhook` (2.255 linhas) -> extrair handlers por tipo de evento em arquivos separados dentro de `_shared/`
- `bluechat-inbound` (1.552 linhas) -> extrair parser, classifier e responder em modulos
- `cadence-runner` (987 linhas) -> extrair executor de step por canal

### 2.4 Quebrar componentes grandes
- `sidebar.tsx` (637 linhas) -> extrair `SidebarNav`, `SidebarHeader`, `SidebarFooter`
- `DealDetailSheet.tsx` (484 linhas) -> extrair tabs em subcomponentes
- `ConversationView.tsx` (384 linhas) -> extrair `MessageBubble`, `ConversationHeader`

---

## FASE 3 - MEDIA (Testes + Performance)

### 3.1 Testes para fluxos criticos
Adicionar testes unitarios para:
- Autenticacao (login, roles, permissoes)
- SDR IA pipeline (parser, classifier, generator)
- Cadence runner (logica de proximo step)
- Deal scoring (calculo de probabilidade)

Meta: sair de 6 arquivos de teste para pelo menos 20, cobrindo os fluxos que quebram o negocio.

### 3.2 Paginacao nas listas
Adicionar paginacao nas queries de:
- Leads (LeadsList)
- Contacts (ContatosPage)
- Deals (PipelinePage - modo lista)
- Organizations
- CS Customers

Usar `range()` do Supabase com controle de pagina no frontend.

### 3.3 Otimizar queries N+1
Revisar hooks que fazem queries sequenciais e consolidar com joins ou `select` com relacoes do Supabase (ex: `select('*, contact:contacts(*)')`).

---

## FASE 4 - BAIXA (Documentacao + Governanca)

### 4.1 README customizado
Reescrever o README.md com:
- Descricao real do projeto
- Arquitetura (frontend, backend, edge functions)
- Variaveis de ambiente necessarias
- Como rodar localmente

### 4.2 Versionamento
Atualizar `package.json` de `0.0.0` para `1.0.0` e adotar semver.

### 4.3 Logger estruturado
Criar `supabase/functions/_shared/logger.ts` com niveis (info, warn, error) e metadata padronizada. Substituir `console.log/error` nas Edge Functions.

---

## SOBRE PONTOS QUE NAO SAO PROBLEMAS REAIS

Alguns itens da auditoria merecem contexto:

- **VITE_SUPABASE_URL e PUBLISHABLE_KEY expostas**: Isso e **por design**. Sao chaves publicas (anon key) e o Supabase depende delas no frontend. A seguranca esta no RLS, que ja esta implementado.
- **CORS aberto**: Concordo que precisa restringir, mas nao e uma vulnerabilidade critica porque o RLS protege os dados. E uma boa pratica, nao um bloqueador.
- **84 migracoes**: Normal para um projeto com 70k linhas. Os nomes hash sao padrao do Supabase e nao afetam operacao.

---

## SEQUENCIA DE IMPLEMENTACAO

| Ordem | Item | Estimativa |
|-------|------|-----------|
| 1 | CORS restritivo (1.3) | 1 sessao |
| 2 | Validacao Zod nos webhooks (1.1) | 2 sessoes |
| 3 | Eliminar `any` criticos (2.1) | 2-3 sessoes |
| 4 | Quebrar hooks grandes (2.2) | 2-3 sessoes |
| 5 | Testes fluxos criticos (3.1) | 3-4 sessoes |
| 6 | Quebrar Edge Functions (2.3) | 2-3 sessoes |
| 7 | Paginacao (3.2) | 2 sessoes |
| 8 | README + versao (4.1, 4.2) | 1 sessao |
| 9 | Logger estruturado (4.3) | 1 sessao |
| 10 | Rate limiting (1.2) | 1-2 sessoes |

Recomendo comecar pela **Fase 1** (seguranca) e depois ir para **Fase 2** (qualidade), que sao os itens que mais impactam a nota de maturidade.

