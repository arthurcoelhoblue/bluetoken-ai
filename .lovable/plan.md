
# Fix: Classificacao consistente para todos os leads

## Problema identificado

O sistema tem uma lacuna critica: a classificacao de leads so acontece em dois momentos:
1. Quando chega um evento via SGT webhook (dados de entrada do Mautic/Pipedrive)
2. Quando o `sdr-intent-classifier` computa um `classification_upgrade` baseado em intents de conversa

O problema e que o passo 2 **computa** o upgrade mas **nunca persiste** no banco. O `sdr-intent-classifier` retorna `classification_upgrade: { prioridade: 1, icp: 'BLUE_ALTO_TICKET_IR', score_interno: 70 }`, o orchestrator passa esse dado para o `sdr-action-executor`, mas o executor **ignora** esse campo completamente.

### Impacto nos dados

| Metrica | Valor |
|---------|-------|
| Total de classificacoes | 1.816 |
| Leads QUENTES | 475 |
| QUENTES com ICP "NAO_CLASSIFICADO" | 188 (40%) |
| QUENTES com prioridade 3 (baixa) | 166 (35%) |
| QUENTES com score abaixo de 50 | 60 (13%) |
| Sem justificativa | 320 (18%) |

### Exemplo concreto: Marcos Bertoldi (lead atual)

- Temperatura: QUENTE
- ICP: BLUE_NAO_CLASSIFICADO
- Prioridade: 3 (baixa)
- Score: 20/100
- Justificativa diz: "Dados insuficientes"
- Porem: tem intent `INTERESSE_IR` com confianca 1.0 (deveria ser P1, ICP BLUE_ALTO_TICKET_IR)

## Solucao

### Parte 1: Corrigir o `sdr-action-executor` (gap principal)

Adicionar um passo entre o 4 e o 5 no handler principal que aplica o `classification_upgrade` retornado pelo classifier:

```text
// Novo passo no sdr-action-executor:
if (body.classification_upgrade && lead_id) {
  const upgrade = body.classification_upgrade;
  const updateFields = { updated_at: now };
  if (upgrade.prioridade) updateFields.prioridade = upgrade.prioridade;
  if (upgrade.icp) updateFields.icp = upgrade.icp;
  if (upgrade.score_interno) updateFields.score_interno = upgrade.score_interno;
  
  // Nunca sobrescrever classificacoes MANUAL
  await supabase.from('lead_classifications')
    .update(updateFields)
    .eq('lead_id', lead_id)
    .eq('empresa', empresa)
    .neq('origem', 'MANUAL');
}
```

Isso garante que **toda mensagem futura** com intent de alta confianca ira automaticamente promover a classificacao do lead.

### Parte 2: Reclassificacao em batch dos leads existentes

Criar uma edge function `reclassify-leads` que:
1. Busca todos os leads QUENTES com ICP NAO_CLASSIFICADO e/ou score < 50
2. Para cada lead, verifica os intents historicos em `lead_message_intents`
3. Se houver intent de alta confianca (INTERESSE_COMPRA, INTERESSE_IR, etc com confianca >= 0.8), aplica o upgrade
4. Registra as mudancas com origem 'AUTOMATICA'

```text
POST /reclassify-leads { dryRun?: boolean }

[1] SELECT leads com temperatura QUENTE + ICP NAO_CLASSIFICADO
[2] Para cada lead:
    - Buscar melhor intent (maior confianca)
    - Se intent de alta confianca >= 0.8:
      - Blue: ICP = BLUE_ALTO_TICKET_IR, Prioridade = 1, Score = 70+
      - Tokeniza: ICP = TOKENIZA_EMERGENTE (ou SERIAL se dados suficientes)
    - Se intent de media confianca >= 0.7:
      - Prioridade max(atual, 2)
      - Score += bonus
[3] Retornar resumo de mudancas
```

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-action-executor/index.ts` | Adicionar passo de `classification_upgrade` no handler principal (~15 linhas) |
| `supabase/functions/reclassify-leads/index.ts` | **Novo**: Edge function para reclassificacao batch dos leads existentes |

## Ordem de execucao

1. Modificar `sdr-action-executor` para aplicar upgrades de classificacao (corrige o futuro)
2. Criar e executar `reclassify-leads` (corrige o passado)
