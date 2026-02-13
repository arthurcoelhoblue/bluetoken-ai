

# Controle de Perda com IA, Gestor e Tempo Minimo em Dias

## Resumo

Tres mudancas principais:
1. **Tempo minimo passa de minutos para dias** na configuracao de stages e na validacao do DealCard
2. **Analise de IA do motivo de perda** -- quando o closer marca como perdido, a IA analisa o historico da conversa em paralelo. O closer so ve o motivo da IA **depois** de confirmar o seu. Se houver divergencia, o gestor e acionado
3. **Gestor por usuario** -- novo campo `gestor_id` na tabela `profiles`, exibido no dialog de criacao de usuario e editavel na aba de Acesso

---

## 1. Tempo Minimo em Dias (em vez de minutos)

### Banco de Dados
- Renomear coluna `pipeline_stages.tempo_minimo_minutos` para `tempo_minimo_dias` (INTEGER, nullable)
- Migrar dados existentes: `SET tempo_minimo_dias = CEIL(tempo_minimo_minutos / 1440.0)` (1 dia = 1440 min)
- Remover coluna antiga

### Arquivos alterados
- **`src/types/deal.ts`** -- `tempo_minimo_minutos` vira `tempo_minimo_dias`
- **`src/pages/PipelineConfigPage.tsx`** -- label e placeholder mudam para "dias", campo `handleUpdateTempoMinimo` usa `tempo_minimo_dias`
- **`src/components/pipeline/DealCard.tsx`** -- validacao `checkMinTime` calcula em dias: `daysInStage < stage.tempo_minimo_dias`

---

## 2. Gestor por Usuario

### Banco de Dados
- Adicionar `profiles.gestor_id UUID REFERENCES profiles(id)` (nullable)
- Permite hierarquia: cada usuario pode ter um gestor, que e outro usuario do sistema

### Arquivos alterados
- **`src/components/settings/CreateUserDialog.tsx`** -- novo campo Select "Gestor" que lista todos os usuarios do sistema (query a `profiles`)
- **`supabase/functions/admin-create-user/index.ts`** -- aceitar `gestor_id` no body e gravar no `profiles` apos criacao
- **`src/components/settings/UserAccessList.tsx`** -- exibir coluna "Gestor" na tabela de usuarios

---

## 3. Analise de Perda com IA e Resolucao pelo Gestor

### Fluxo completo

```text
1. Closer clica "Perder" no deal card
2. Closer informa seu motivo de perda (texto livre) e confirma
3. Sistema salva o deal como PERDIDO com motivo_perda_closer
4. Em paralelo, edge function chama a IA para analisar o historico de mensagens do deal/contato
5. IA retorna motivo_perda_ia (texto + categoria)
6. Sistema salva motivo_perda_ia no deal
7. Closer pode agora ver o motivo da IA (revelado apos confirmacao)
8. Se motivo_closer != motivo_ia (categorias diferentes), cria uma "pendencia" para o gestor
9. Gestor acessa tela de Pendencias e decide o motivo final (closer, IA, ou terceiro)
```

### Banco de Dados

**Tabela `deals`** -- novas colunas:
- `motivo_perda_closer TEXT` -- motivo informado pelo vendedor
- `motivo_perda_ia TEXT` -- motivo analisado pela IA
- `categoria_perda_closer TEXT` -- categoria padronizada do closer
- `categoria_perda_ia TEXT` -- categoria padronizada da IA
- `motivo_perda_final TEXT` -- motivo definitivo (preenchido automaticamente se concordam, ou pelo gestor)
- `categoria_perda_final TEXT` -- categoria definitiva
- `perda_resolvida BOOLEAN DEFAULT false` -- indica se a divergencia foi resolvida
- `perda_resolvida_por UUID REFERENCES profiles(id)` -- quem resolveu (gestor)
- `perda_resolvida_em TIMESTAMPTZ` -- quando foi resolvido

O campo `motivo_perda` existente sera mantido por retrocompatibilidade e preenchido com o `motivo_perda_final`.

**Tabela `deal_loss_categories`** (nova, seed):
- Categorias padrao: PRECO, CONCORRENCIA, TIMING, SEM_NECESSIDADE, SEM_RESPOSTA, PRODUTO_INADEQUADO, OUTRO

### Edge Function: `deal-loss-analysis`

- Recebe `deal_id`
- Busca o historico de mensagens do contato vinculado ao deal (`lead_messages` via `contact_id`)
- Envia para a IA (Lovable AI Gateway, modelo `google/gemini-3-flash-preview`) com prompt:
  - "Analise o historico de conversa e identifique o motivo real da perda deste negocio. Retorne uma categoria (PRECO, CONCORRENCIA, TIMING, SEM_NECESSIDADE, SEM_RESPOSTA, PRODUTO_INADEQUADO, OUTRO) e uma explicacao em 2-3 frases."
- Usa tool calling para extrair resposta estruturada `{ categoria, explicacao }`
- Grava `motivo_perda_ia` e `categoria_perda_ia` no deal
- Se `categoria_perda_ia == categoria_perda_closer`, auto-resolve: `perda_resolvida = true`, `motivo_perda_final = motivo_perda_closer`
- Se diverge, deal fica pendente para o gestor

### Alteracoes no DealCard

- Apos confirmar perda, chama `supabase.functions.invoke('deal-loss-analysis', { body: { deal_id } })` em background (fire-and-forget com toast de "Analise da IA em andamento...")
- Dialog de perda agora inclui Select de categoria (alem do texto livre)
- Apos IA processar, se o closer voltar ao deal, ve um card comparativo: "Seu motivo vs Motivo da IA"

### Nova Pagina: Pendencias de Perda (`/admin/pendencias-perda`)

- Acessivel apenas para gestores/admins
- Lista deals com `status = 'PERDIDO'` AND `perda_resolvida = false` AND `categoria_perda_ia IS NOT NULL` AND `categoria_perda_closer != categoria_perda_ia`
- Cada card mostra:
  - Deal titulo, contato, pipeline, stage de fechamento
  - Motivo do Closer (categoria + texto)
  - Motivo da IA (categoria + texto)
  - Botoes: "Aceitar Closer", "Aceitar IA", "Informar Outro Motivo"
- Ao resolver, grava `motivo_perda_final`, `perda_resolvida = true`, `perda_resolvida_por`, `perda_resolvida_em`

### Rota e navegacao
- Adicionar rota `/admin/pendencias-perda` no `App.tsx`
- Adicionar item no sidebar (icone AlertTriangle) com badge de contagem de pendencias

---

## Detalhes Tecnicos

### Arquivos novos
1. `supabase/functions/deal-loss-analysis/index.ts` -- edge function de analise com IA
2. `src/pages/admin/PendenciasPerda.tsx` -- tela de resolucao
3. `src/hooks/useLossPendencies.ts` -- hook para listar e resolver pendencias

### Arquivos alterados
1. `src/types/deal.ts` -- novos campos no tipo Deal + tempo_minimo_dias
2. `src/hooks/useDeals.ts` -- useCloseDeal atualizado para gravar campos separados + disparar edge function
3. `src/components/pipeline/DealCard.tsx` -- dialog de perda com select de categoria + validacao em dias + card comparativo pos-IA
4. `src/pages/PipelineConfigPage.tsx` -- campo renomeado para dias
5. `src/components/settings/CreateUserDialog.tsx` -- campo Gestor
6. `supabase/functions/admin-create-user/index.ts` -- aceitar gestor_id
7. `src/components/layout/AppSidebar.tsx` -- novo item de menu Pendencias
8. `src/App.tsx` -- nova rota

### Migracao SQL (resumo)
- Renomear `tempo_minimo_minutos` para `tempo_minimo_dias` com conversao
- Adicionar `gestor_id` em `profiles`
- Adicionar colunas de perda detalhada em `deals`
- Criar tabela `deal_loss_categories` com seed
- RLS: pendencias visiveis para gestores (profiles com gestor_id apontando para eles) e admins

