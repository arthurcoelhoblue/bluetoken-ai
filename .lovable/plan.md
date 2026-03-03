

## Avaliacao da PR #3 — 4 Patches Pipeline

### Resumo da PR

A branch `feature/4-patches-pipeline` (PR #3) foi criada pelo Manus AI e contém 4 commits com +804/-258 linhas em 9 arquivos. Avaliacao por patch:

---

### Patch 1: Atividades Obrigatórias no Deal — APROVADO com ajustes

**O que faz:** Ao fechar o DealDetailSheet, se o deal está aberto e nao tem atividade futura pendente, exibe um dialog obrigatório para agendar próximo passo. Permite "Pular desta vez".

**Arquivos:** `ScheduleActivityDialog.tsx` (novo), `DealDetailSheet.tsx` (modificado)

**Problemas identificados (2):**
1. **Bug de tipo no filtro** (P2): O `hasFutureActivity()` só verifica `tipo === 'TAREFA'`, mas o dialog permite agendar LIGACAO, EMAIL, REUNIAO. Se o usuário agendar uma ligação, na próxima vez que fechar o sheet, o dialog reaparece. **Correção**: verificar se o tipo está em `['TAREFA', 'LIGACAO', 'EMAIL', 'REUNIAO']`.
2. **Bug de comparação de data** (P2): Compara `tarefa_prazo` contra `new Date()` (com hora), mas o dialog agenda apenas com `date.toISOString()` (meia-noite). Atividades agendadas "para hoje" são consideradas passadas após 00:00. **Correção**: comparar apenas a data (sem hora).

**Veredito:** Bom conceito, precisa dos 2 ajustes acima.

---

### Patch 2: Cadastro de Produtos no Deal — APROVADO com ajustes críticos

**O que faz:** Novas tabelas `catalog_products` e `deal_products` (com subtotal GENERATED ALWAYS), hook `useDealProducts`, componente `DealProductsTab`, nova aba "Produtos" no DealDetailSheet.

**Arquivos:** `DealProductsTab.tsx` (novo), `useDealProducts.ts` (novo), migration SQL (novo), `DealDetailSheet.tsx` (modificado)

**Problemas identificados (3):**
1. **CRITICO - RLS completamente aberta** (P1): Todas as policies usam `USING (true)` e `WITH CHECK (true)`. Qualquer usuário autenticado pode ler/editar/deletar produtos de qualquer empresa. **Correção**: restringir policies por empresa via join com deals/pipelines, igual ao padrão do restante do sistema.
2. **Type hack no Supabase client**: Usa `from('deal_products' as 'deals')` para contornar tipos. Funciona mas é frágil. **Correção**: após a migration rodar, os tipos serão atualizados automaticamente e o cast não será mais necessário. Vou implementar sem o hack.
3. **`catalog_products.empresa` é TEXT em vez de `empresa_tipo`**: Inconsistente com o restante do schema. **Correção**: usar `empresa_tipo`.

**Veredito:** Funcionalidade excelente, mas a RLS precisa ser corrigida antes de ir para produção.

---

### Patch 3: Mover Ganhar/Perder para Dentro do Card — APROVADO

**O que faz:** Remove os botões Trophy (Ganhar) e XCircle (Perder) do DealCard no Kanban, junto com o dialog de perda e toda a lógica associada (checkMinTime, handleWin, handleLoseClick, handleConfirmLoss). As ações ficam disponíveis apenas dentro do DealDetailSheet.

**Arquivos:** `DealCard.tsx` (modificado, -173 linhas)

**Problemas:** Nenhum. Simplificação limpa. O card fica mais compacto e as ações destrutivas (ganhar/perder) ficam centralizadas no DealDetailSheet onde já existem.

**Veredito:** Aprovado sem ajustes.

---

### Patch 4: Formato de Telefone +55 (DDD) XXXXX-XXXX — APROVADO com ajuste menor

**O que faz:** Nova utility `formatPhoneBR()` em `src/lib/formatPhone.ts`. Aplica no ZadarmaPhoneWidget e ClickToCallButton.

**Arquivos:** `formatPhone.ts` (novo), `ZadarmaPhoneWidget.tsx` (modificado), `ClickToCallButton.tsx` (modificado)

**Problemas identificados (1):**
1. **Bug no input do widget**: O input exibe `formatPhoneBR(number)` como value, mas o onChange faz `setNumber(e.target.value.replace(/\D/g, ''))`. Isso cria um loop onde o usuário digita, o número é formatado para exibição, e depois os não-dígitos são removidos. Pode causar posição do cursor inconsistente. **Correção**: manter o raw value no input e exibir a versão formatada apenas como placeholder ou label.

**Veredito:** Boa utility, ajuste menor no input.

---

### Plano de Execução

Vou implementar os 4 patches nesta ordem, já com todas as correções:

**Passo 1 — Migration SQL (Patch 2)**
- Criar tabelas `catalog_products` (com `empresa_tipo`) e `deal_products`
- RLS restritiva: policies scoped por empresa via join com deals/pipelines
- Subtotal como GENERATED ALWAYS

**Passo 2 — Novos arquivos (Patches 1, 2, 4)**
- `src/lib/formatPhone.ts` — utility de formatação BR
- `src/hooks/useDealProducts.ts` — hook sem type hacks
- `src/components/deals/ScheduleActivityDialog.tsx` — com reset correto
- `src/components/deals/DealProductsTab.tsx` — aba de produtos

**Passo 3 — Modificações em arquivos existentes (Patches 1, 2, 3, 4)**
- `DealDetailSheet.tsx` — interceptação de fechamento (com fix de tipo e data), nova aba Produtos
- `DealCard.tsx` — remoção dos botões Ganhar/Perder e lógica associada
- `ZadarmaPhoneWidget.tsx` — formatação de telefone (com fix no input)
- `ClickToCallButton.tsx` — formatação de telefone no tooltip

