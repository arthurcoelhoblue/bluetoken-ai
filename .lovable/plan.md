

# Fix: "Próximo Passo" Vazio na Tela Meu Dia

## Diagnostico

O problema NAO foi causado pelas mudancas de multi-tenant. A causa raiz e:

1. **Dados faltantes**: Seu usuario (`arthur@tokeniza.com.br`) tem `empresa: NULL` na tabela `user_access_assignments`. Isso faz a funcao `get_user_empresa()` retornar NULL, quebrando todas as policies RLS.
2. **Zero deals atribuidos**: Voce nao tem nenhum deal como `owner_id`, entao todas as queries de contexto (tarefas, SLA, deals parados) retornam vazio.
3. **AI parse falha**: Com contexto vazio, a IA retorna algo que nao parseia corretamente. O fallback tambem nao encontra nada, resultando em `acoes: []`.

### Evidencias (dados do banco)

```text
user_access_assignments:
  user_id: 3eb15a6a-..., empresa: NULL  <-- problema

deals com owner_id = seu_id: 0 registros

workbench_tarefas (BLUE): 0 registros
workbench_sla_alerts (BLUE): 0 registros
```

## Solucao (2 partes)

### Parte 1: Corrigir dados (SQL)

Executar uma migration para atribuir empresa aos usuarios que estao com NULL:

```sql
UPDATE user_access_assignments
SET empresa = 'BLUE'
WHERE empresa IS NULL;
```

Antes de executar, vou confirmar com voce qual empresa atribuir para cada usuario (BLUE ou TOKENIZA). Os usuarios afetados sao:
- `arthur@tokeniza.com.br` (Arthur Coelho)
- 2 outros usuarios com empresa NULL

### Parte 2: Tornar o NBA mais resiliente (codigo)

Mesmo com dados corretos, o card deveria lidar melhor com cenarios vazios. Mudancas:

1. **`next-best-action/index.ts`**: Melhorar o log de erro para incluir o conteudo raw da IA (facilita debug futuro). Adicionar fallback que gera mensagem motivacional mesmo sem dados.

2. **`NextBestActionCard.tsx`**: Quando `acoes` esta vazio e nao ha erro, mostrar uma mensagem contextual diferente (ex: "Nenhum deal atribuido -- comece criando um deal no pipeline") ao inves do generico "Tudo em dia!".

## Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | UPDATE empresa NULL para valor correto |
| `supabase/functions/next-best-action/index.ts` | Melhorar log + fallback vazio |
| `src/components/workbench/NextBestActionCard.tsx` | Mensagem contextual quando sem dados |

## Sequencia

1. Confirmar empresas corretas para usuarios com NULL
2. Executar migration SQL
3. Ajustar edge function e componente
4. Testar chamando a funcao novamente
