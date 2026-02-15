
# Correções Pre-Auditoria PO -- Inconsistências Detectadas

## Problemas Encontrados

### 1. CRITICO: Rotas quebradas no screenRegistry.ts
O arquivo `screenRegistry.ts` registra URLs que **nao existem** no roteador (`App.tsx`), causando falha na resolucao de permissoes e na funcao `getScreenByUrl()`.

| screenRegistry (ERRADO) | App.tsx (CORRETO) | Sidebar (CORRETO) |
|--------------------------|-------------------|-------------------|
| `/admin/pipeline-config` | `/settings/pipelines` | `/settings/pipelines` |
| `/admin/custom-fields` | `/settings/custom-fields` | `/settings/custom-fields` |

**Impacto**: `getScreenByUrl()` retorna `undefined` nestas paginas. O sistema de permissoes granulares nao consegue identificar a tela ativa.

**Correcao**: Atualizar as URLs no `screenRegistry.ts` para corresponder exatamente as rotas do `App.tsx`.

### 2. CRITICO: `cs_playbooks` ausente do screenRegistry
A sidebar tem o item "Playbooks" com `screenKey: 'cs_playbooks'`, mas esse registro **nao existe** no `SCREEN_REGISTRY`. Isso significa que:
- O sistema de permissoes nao consegue controlar o acesso a esta tela
- Perfis customizados nao listam esta tela para configuracao

**Correcao**: Adicionar entrada `cs_playbooks` ao `SCREEN_REGISTRY`.

### 3. MEDIO: Dashboard de Custos IA sem acesso na sidebar
A rota `/admin/ai-costs` esta registrada no `screenRegistry.ts` e no `App.tsx`, mas **nao aparece** no menu da sidebar (`AppSidebar.tsx`). Usuarios nao conseguem navegar ate la.

**Correcao**: Adicionar item "Custos IA" ao grupo "Configuracao" da sidebar.

### 4. MEDIO: Documentacao desatualizada (docs/)
- `docs/TEST-RESULTS.md`: Refere apenas Patches 1-2 (16 testes). Deveria refletir os 43+ testes atuais.
- `docs/README.md`: Lista PATCH 3 e 4 como "Pendente" quando ja estao implementados ha meses.

**Correcao**: Atualizar ambos os arquivos com o estado atual do sistema.

### 5. BAIXO: follow-up-scheduler com matching cross-lead
A funcao `follow-up-scheduler` compara mensagens OUTBOUND com INBOUND da mesma *empresa*, mas nao filtra por lead/conversa. Isso pode inflar as taxas de resposta.

**Correcao aceita como melhoria futura** -- nao e blocker para auditoria, mas sera documentado.

---

## Plano de Correcao

### Arquivo 1: `src/config/screenRegistry.ts`
- Linha 66: Alterar `url: '/admin/pipeline-config'` para `url: '/settings/pipelines'`
- Linha 67: Alterar `url: '/admin/custom-fields'` para `url: '/settings/custom-fields'`
- Adicionar entrada para `cs_playbooks`:
  ```typescript
  { key: 'cs_playbooks', label: 'Playbooks CS', group: 'Sucesso do Cliente', icon: BookOpen, url: '/cs/playbooks' },
  ```

### Arquivo 2: `src/components/layout/AppSidebar.tsx`
- Adicionar item "Custos IA" no grupo Configuracao, entre "Benchmark IA" e "Funis":
  ```typescript
  { title: 'Custos IA', url: '/admin/ai-costs', icon: DollarSign, screenKey: 'custos_ia' },
  ```
- Importar `DollarSign` do lucide-react

### Arquivo 3: `src/config/__tests__/screenRegistry.test.ts`
- Adicionar teste validando que **todas as URLs do registry existem como rotas validas** (prevencao futura)
- Adicionar teste para `cs_playbooks`
- Atualizar teste de rotas Fase 3

### Arquivo 4: `docs/TEST-RESULTS.md`
- Atualizar tabela resumo para refletir os 43+ testes atuais
- Adicionar secoes para Fase 1, 2 e 3
- Incluir resultados dos testes unitarios (useAICostDashboard, useAdoptionMetrics, etc.)

### Arquivo 5: `docs/README.md`
- Atualizar tabela de patches implementados (PATCH 1 ate Fase 3)
- Remover PATCH 3-4 de "Proximos Patches"

### Arquivo 6: `.lovable/plan.md`
- Substituir pelo status consolidado das 3 Fases + lista de correcoes da auditoria

---

## Detalhes Tecnicos

### Verificacao de consistencia sidebar vs registry vs router
A raiz do problema e que tres fontes de verdade coexistem sem validacao cruzada:
1. `screenRegistry.ts` -- define URLs para o sistema de permissoes
2. `AppSidebar.tsx` -- define URLs para navegacao
3. `App.tsx` -- define as rotas reais

O teste adicionado (`screenRegistry.test.ts`) ira validar que todas as URLs do registry sao alcancaveis, prevenindo regressoes futuras.

### Arquivos a editar
| Arquivo | Mudanca |
|---------|---------|
| `src/config/screenRegistry.ts` | Corrigir 2 URLs + adicionar cs_playbooks |
| `src/components/layout/AppSidebar.tsx` | Adicionar item Custos IA + import DollarSign |
| `src/config/__tests__/screenRegistry.test.ts` | Testes de consistencia de rotas |
| `docs/TEST-RESULTS.md` | Atualizar com 43+ testes |
| `docs/README.md` | Atualizar patches implementados |
| `.lovable/plan.md` | Status consolidado |

### Nenhuma dependencia nova
### Nenhuma migracao de banco necessaria
