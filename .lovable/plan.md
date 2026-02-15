

# Inferência Lógica de Implicação e Necessidade no SPIN

## Objetivo

Quando a IA já coletou S (Situação) e P (Problema) do SPIN, ela deve automaticamente inferir I (Implicação) e N (Necessidade) com base em dedução lógica do contexto do negócio.

## Exemplo Concreto (Marcos Bertoldi)

| Campo | Dado Coletado | Inferência |
|-------|--------------|------------|
| S | Reunião prévia com Michel, quer orçamento para IR cripto, 1 ano | Coletado da conversa |
| P | Precisa declarar impostos sobre operações cripto | Coletado da conversa |
| I | **Risco de multas da Receita Federal, problemas administrativos e fiscais por omissão de declaração** | Inferido logicamente de S+P |
| N | **Contratação imediata do serviço de declaração de IR cripto para regularização fiscal** | Inferido logicamente de S+P |

## Mudanças

### 1. Atualizar prompt no `sdr-ia-interpret/index.ts`

Adicionar regra de inferência lógica nos dois blocos de prompt (QUICK_PROMPT e SYSTEM_PROMPT), logo após a regra crítica de framework existente:

```text
## REGRA DE INFERÊNCIA LÓGICA (SPIN/GPCT/BANT)
Quando S (Situação) e P (Problema) já estiverem preenchidos, INFIRA automaticamente:
- I (Implicação): consequências negativas de NÃO resolver o problema (multas, perdas, riscos)
- N (Necessidade): benefício/ação necessária para resolver (contratar serviço, agendar reunião)
Aplique a mesma lógica para GPCT (se G e P preenchidos, infira C e T) e BANT (se N preenchido, infira B e T).
Marque inferências com prefixo "[Inferido]" para diferenciar de dados explícitos do lead.
```

### 2. Migração para corrigir o lead Marcos Bertoldi

Atualizar os campos I e N do SPIN com os dados inferidos:
- `i`: "[Inferido] Risco de multas e penalidades da Receita Federal por omissão de declaração de operações cripto"
- `n`: "[Inferido] Contratação imediata do serviço de declaração de IR cripto para regularização fiscal"

## Detalhes Técnicos

### Arquivo: `supabase/functions/sdr-ia-interpret/index.ts`

Inserir a regra de inferência logo após a "REGRA CRÍTICA DE FRAMEWORK" existente (linhas ~1952 e ~1997), nos dois blocos de prompt (QUICK_PROMPT e SYSTEM_PROMPT).

### Migração SQL

```sql
UPDATE lead_conversation_state
SET framework_data = jsonb_set(
  framework_data::jsonb,
  '{spin}',
  '{"s":"Reunião prévia com Michel, quer orçamento para declaração de IR cripto, 1 ano de declaração","p":"Precisa declarar impostos sobre operações cripto","i":"[Inferido] Risco de multas e penalidades da Receita Federal por omissão de declaração de operações cripto","n":"[Inferido] Contratação imediata do serviço de declaração de IR cripto para regularização fiscal"}'
),
updated_at = now()
WHERE lead_id = '202f5ba6-2ced-4dc0-b6de-693b00f4ee8a' AND empresa = 'BLUE';
```

## Impacto

- O SPIN mostrará 4/4 campos preenchidos (100%) em vez de 2/4 (50%)
- Leads futuros terão frameworks mais completos automaticamente
- O prefixo "[Inferido]" permite distinguir dados explícitos de inferências
- Zero risco de regressão -- a lógica de merge existente preserva dados já coletados

