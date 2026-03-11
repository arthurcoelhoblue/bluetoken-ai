

# Notificação sonora + toast para novos deals no pipeline

## O que será feito
Um hook global que escuta em tempo real a criação de novos deals em qualquer pipeline. Quando um deal é inserido, toca um som de notificação e exibe um toast no canto superior direito (3-4s) com empresa, funil e etapa. Ao clicar no toast, navega direto para o deal.

## Implementação

### 1. Adicionar arquivo de som
Criar `public/sounds/new-deal.mp3` — um som curto de notificação. Usaremos um beep gerado via Web Audio API como fallback (sem dependência de arquivo externo).

### 2. Criar hook `useNewDealAlert` (`src/hooks/useNewDealAlert.ts`)
- Assina o canal realtime `deals` filtrando `event: 'INSERT'`
- No callback do INSERT:
  - Busca pipeline name + stage name + empresa via joins (ou cache do queryClient)
  - Toca som via `new Audio()` ou Web Audio API
  - Exibe `toast()` do Sonner com título "🔔 Novo Lead — {empresa}" e descrição "{funil} → {etapa}", com `action` que navega para `/pipeline?pipeline={id}&deal={id}`
  - Duração: 4 segundos

### 3. Montar o hook no `AppLayout.tsx`
- Chamar `useNewDealAlert()` dentro do layout autenticado para que funcione em qualquer página

### Detalhes técnicos

| Arquivo | Mudança |
|:--|:--|
| `src/hooks/useNewDealAlert.ts` | Novo hook: realtime INSERT em deals → som + toast |
| `src/components/layout/AppLayout.tsx` | Importar e chamar `useNewDealAlert()` |

O hook usará o canal realtime já habilitado na tabela `deals`. Para obter empresa/funil/etapa, fará um select rápido em `pipelines` + `pipeline_stages` usando os IDs do payload (`pipeline_id`, `stage_id`). O som será gerado via Web Audio API (um beep curto) para não depender de arquivo externo.

