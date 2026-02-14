

# Flag "Vendedor" nos Perfis de Usuario

## Justificativa

Hoje o sistema usa roles (`CLOSER`, `ADMIN`) para inferir quem e vendedor, o que gera acoplamento: um ADMIN que vende precisa de role CLOSER, e um CLOSER que muda de funcao continua aparecendo no ranking. A flag `is_vendedor` resolve isso ao separar **identidade comercial** de **permissoes de acesso**.

## Impacto no Sistema

Pontos onde a flag sera usada como filtro:

| Area | Uso atual | Com a flag |
|------|-----------|------------|
| Ranking de Metas (`MetasPage`) | Mostra quem tem meta cadastrada | Filtra apenas `is_vendedor = true` |
| Comissoes (`comissao_lancamentos`) | Qualquer user com deal ganho | Apenas vendedores |
| Filtro "Vendedor" no Kanban | Lista profiles com role ADMIN/CLOSER | Lista profiles com `is_vendedor = true` |
| Cockpit Executivo | KPIs gerais | Metricas focadas em vendedores |
| Analytics de Performance | Todos os usuarios | Apenas vendedores |
| Distribuicao de Metas Anuais (`MetaAnualDialog`) | Lista manual | Lista automatica de vendedores |

## Plano Tecnico

### Passo 1 -- Migracao de Banco

Adicionar coluna `is_vendedor` na tabela `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN is_vendedor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_vendedor
  IS 'Flag que indica se o usuario e vendedor ativo (aparece em metas, comissoes e rankings)';
```

### Passo 2 -- Atualizar o tipo `UserProfile`

Em `src/types/auth.ts`, adicionar `is_vendedor: boolean` na interface `UserProfile`.

### Passo 3 -- Tela de Gestao (Settings)

No componente de gestao de usuarios (`CreateUserDialog` e lista de usuarios), adicionar um toggle/switch "Vendedor" que permite ao ADMIN marcar/desmarcar a flag. Visual: um switch simples com label "Este usuario e vendedor".

### Passo 4 -- Substituir filtros por role nos hooks

**`src/hooks/useDeals.ts`** (filtro de owners no Kanban): trocar a query que busca profiles por role para buscar `is_vendedor = true`.

**`src/hooks/useMetas.ts`**: A view `meta_progresso` ja filtra por quem tem meta. Nenhuma alteracao necessaria aqui, pois a flag vai atuar no cadastro (quem recebe meta = quem e vendedor).

**`src/components/metas/MetaAnualDialog.tsx`**: Ao listar usuarios para distribuir metas, filtrar por `is_vendedor = true`.

### Passo 5 -- Propagar para o AuthContext

O `fetchProfile` no `AuthContext.tsx` ja carrega todo o profile. Como `is_vendedor` sera uma coluna de `profiles`, ele estara automaticamente disponivel via `profile.is_vendedor` em toda a aplicacao.

## Resumo

| Metrica | Valor |
|---------|-------|
| Migracao SQL | 1 (ADD COLUMN) |
| Arquivos editados | ~6 |
| Risco | Baixo (campo com default false, nao quebra nada existente) |
| Acao pos-deploy | ADMIN marca os vendedores atuais via Settings |

