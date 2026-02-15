
# Correção: Prioridade não Acompanha Sinais de Urgência da Amélia

## Problema
Quando a Amélia detecta intents de alta confiança (INTERESSE_COMPRA, INTERESSE_IR, AGENDAMENTO_REUNIAO), ela ajusta corretamente a **temperatura** para QUENTE, mas a **prioridade** permanece no valor original (3 = Baixa). Isso acontece porque o bloco `AJUSTAR_TEMPERATURA` no `sdr-ia-interpret` só faz `update({ temperatura })` sem tocar em prioridade, ICP ou score.

O caso do Marcos Bertoldi ilustra: confiança 1.0 em INTERESSE_COMPRA, escalado para humano, mas continua como P3/NAO_CLASSIFICADO no painel.

## Solução

### 1. Ampliar a ação AJUSTAR_TEMPERATURA para incluir prioridade e ICP comportamental

No `supabase/functions/sdr-ia-interpret/index.ts`, modificar o case `AJUSTAR_TEMPERATURA` (linhas ~3362-3415):

- Quando `nova_temperatura === 'QUENTE'` E os detalhes contêm um intent de alta confiança (`INTERESSE_COMPRA`, `INTERESSE_IR`, `AGENDAMENTO_REUNIAO`, `SOLICITACAO_CONTATO`):
  - Atualizar `prioridade` para **1**
  - Se ICP atual é `*_NAO_CLASSIFICADO`, promover para ICP comportamental:
    - BLUE: `BLUE_ALTO_TICKET_IR` (indica interesse ativo em IR)
    - TOKENIZA: `TOKENIZA_EMERGENTE` (baseline para interesse ativo)
  - Recalcular `score_interno` com bonus de intent (+30 pontos)

- Quando `nova_temperatura === 'MORNO'`:
  - Se prioridade atual > 2, atualizar para **2**

- Quando `nova_temperatura === 'FRIO'`:
  - Manter prioridade atual (não degradar automaticamente)

### 2. Criar funcao auxiliar `computeClassificationUpgrade`

Nova funcao pura que recebe o estado atual (temperatura, prioridade, ICP, intent, confiança) e retorna os campos a atualizar. Isso mantém a logica testavel e separada do I/O.

```text
computeClassificationUpgrade(
  novaTemp, intentAtual, confianca, icpAtual, prioridadeAtual, empresa
) => { prioridade?, icp?, score_interno? }
```

Regras:
- Intent INTERESSE_COMPRA/INTERESSE_IR/AGENDAMENTO_REUNIAO com confiança >= 0.8 E temp QUENTE => P1
- Intent DUVIDA_PRECO/DUVIDA_PRODUTO com confiança >= 0.7 E temp MORNO => P2
- ICP *_NAO_CLASSIFICADO + intent de compra => promover para ICP comportamental
- Score: base_temperatura(QUENTE=30) + bonus_intent(alta_confianca=30) + bonus_icp(promovido=10)

### 3. Corrigir o lead do Marcos Bertoldi imediatamente

Executar uma migracao pontual para corrigir o registro atual:

```sql
UPDATE lead_classifications
SET prioridade = 1,
    icp = 'BLUE_ALTO_TICKET_IR',
    score_interno = 65,
    updated_at = now()
WHERE lead_id = '202f5ba6-2ced-4dc0-b6de-693b00f4ee8a'
  AND empresa = 'BLUE';
```

Isso corrige o caso imediato enquanto o fix sistêmico previne recorrência.

## Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Adicionar `computeClassificationUpgrade()`, ampliar case AJUSTAR_TEMPERATURA |

## Migracao de Dados

Uma migracao SQL para corrigir o lead do Marcos Bertoldi (caso pontual).

## Impacto

- Todos os leads futuros com intent de compra de alta confiança terão prioridade promovida automaticamente
- Leads existentes NAO_CLASSIFICADO que demonstram interesse ativo ganham ICP comportamental
- Score interno refletirá sinais de intent, não apenas dados estáticos do SGT
- Zero impacto em leads que já possuem classificação manual (origem = MANUAL não será sobrescrita)
