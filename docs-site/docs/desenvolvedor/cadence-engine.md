---
sidebar_position: 6
title: Motor de Cadências
---

# Motor de Cadências

## Arquitetura

O motor de cadências é composto por:

- **`cadences`** — Definição da cadência (nome, canal, empresa)
- **`cadence_steps`** — Passos individuais (canal, template, offset em minutos)
- **`cadence_runs`** — Execuções ativas vinculadas a deals
- **`cadence_runner`** — Edge Function que processa os passos

## Fluxo de Execução

```
cadence-runner (CRON a cada 15 min)
  → Busca runs ativas com próximo passo vencido
  → Para cada run:
    1. Verifica se lead respondeu (parar_se_responder)
    2. Busca o template do passo atual
    3. Envia mensagem (WhatsApp/Email) ou cria tarefa
    4. Avança para o próximo passo
    5. Marca run como completa se não há mais passos
```

## Stage Triggers

Cadências podem ser iniciadas automaticamente quando um deal entra em uma etapa específica do pipeline:

```sql
-- Tabela cadence_stage_triggers
-- pipeline_id + stage_id → cadence_id
```

## Lógica de Negócio

A lógica core está em `src/lib/cadence-logic.ts`:
- Cálculo de próximo passo
- Verificação de janela de horário comercial
- Resolução de templates com placeholders
