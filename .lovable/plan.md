

# Correcao dos Testes do PO + Analise Final da Auditoria

## Contexto

O PO encomendou uma auditoria externa (Manus AI) que produziu 3 relatorios e criou testes. Os relatorios identificaram problemas que **ja foram corrigidos** nas Fases A-D. Porem, os testes criados pela auditoria tem erros de compilacao porque foram escritos com base em um schema imaginario que nao corresponde ao banco real.

## Status das Recomendacoes do PO vs. Trabalho Ja Feito

| Recomendacao do PO | Status Atual |
|---|---|
| Eliminar `any` explicito (92+ ocorrencias) | FEITO (Fase B) — ~60 removidos no backend |
| Validacao Zod em endpoints criticos | JA EXISTIA — sgt-webhook, bluechat-inbound, capture-form-submit |
| Rate Limiting em webhooks publicos | JA EXISTIA — 3 webhooks protegidos |
| Logging estruturado (substituir console.log) | FEITO (Fase C) — 46/46 funcoes migradas |
| Validacao centralizada de ENV vars | FEITO (Fase A) — 46/46 funcoes migradas |
| Decompor arquivos >500 linhas (sgt-webhook, bluechat-inbound) | FEITO (Fase D) — ambos decompostos em modulos |
| Cobertura de testes | PARCIAL — testes existem mas os do PO estao quebrados |
| TypeScript strict mode | NAO VERIFICADO — precisa confirmar tsconfig |

## Erros de Build a Corrigir

### 1. `src/test/fixtures/deals.ts`
Os testes usam campos que NAO existem na tabela `deals`:
- `empresa` — nao existe (deals nao tem empresa diretamente)
- `probabilidade` — nao existe (o campo real e `score_probabilidade`)
- `data_fechamento` — nao existe (o campo real e `fechado_em`)

**Acao**: Reescrever as fixtures para usar os campos reais do schema (`score_probabilidade`, `fechado_em`, sem `empresa`)

### 2. `src/test/fixtures/leads.ts`
Referencia `Database['public']['Tables']['leads']` mas a tabela `leads` NAO existe no schema. Os dados de leads estao em `lead_contacts`.

**Acao**: Reescrever para usar `lead_contacts` ou definir tipos inline independentes do schema

### 3. `src/test/hooks/useDeals.test.ts`
Usa `empresa`, `probabilidade` e `data_fechamento` extensivamente — todos inexistentes.

**Acao**: Atualizar todos os testes para usar os campos corretos do schema real

## Plano de Execucao

1. Reescrever `src/test/fixtures/deals.ts` — usar campos reais (`score_probabilidade`, `fechado_em`, remover `empresa`)
2. Reescrever `src/test/fixtures/leads.ts` — usar `lead_contacts` em vez de `leads`
3. Atualizar `src/test/hooks/useDeals.test.ts` — corrigir todas as referencias a campos inexistentes
4. Verificar se ha outros arquivos de teste com o mesmo problema
5. Confirmar build limpo sem erros

## Detalhes Tecnicos

### Mapeamento de campos errados para corretos (deals)

| Campo no teste (errado) | Campo real no schema |
|---|---|
| `empresa` | Nao existe — remover ou buscar via `contact_id -> lead_contacts.empresa` |
| `probabilidade` | `score_probabilidade` |
| `data_fechamento` | `fechado_em` |

### Mapeamento de tabela (leads)

| Referencia no teste (errada) | Tabela real |
|---|---|
| `Database['public']['Tables']['leads']` | `Database['public']['Tables']['lead_contacts']` |

## Risco
Baixo. Correcao de fixtures de teste para alinhar com o schema real. Nenhuma logica de negocio ou codigo de producao e alterado.

