---
sidebar_position: 5
title: Motor SDR-IA
---

# Motor SDR-IA

O motor SDR-IA é o conjunto de Edge Functions que automatiza a qualificação de leads.

## Fluxo de Processamento

1. **Mensagem recebida** (WhatsApp/BlueChat) → `bluechat-inbound` ou `whatsapp-inbound`
2. **Parsing** → `sdr-message-parser` — Extrai dados estruturados
3. **Classificação de intenção** → `sdr-intent-classifier` — Identifica o que o lead quer
4. **Interpretação** → `sdr-ia-interpret` — Análise contextual com IA
5. **Geração de resposta** → `sdr-response-generator` — Cria resposta personalizada
6. **Execução** → `sdr-action-executor` — Envia resposta e registra ações

## Classificação de Intenção

A IA classifica mensagens em intenções como:
- `pedir_preco` — Interesse em preços
- `agendar_demo` — Quer agendar demonstração
- `tirar_duvida` — Pergunta sobre produto
- `reclamacao` — Insatisfação
- `interesse_compra` — Sinal claro de compra

## Qualificação Conversacional

Usa frameworks como **BANT** e **SPIN** para qualificar leads:
- **Budget** — Tem orçamento?
- **Authority** — É o decisor?
- **Need** — Tem necessidade real?
- **Timeline** — Tem urgência?

## Escalação

A Amélia escala para humano quando:
- Lead é qualificado como SQL
- Conversa se torna muito complexa
- Lead pede explicitamente para falar com humano
