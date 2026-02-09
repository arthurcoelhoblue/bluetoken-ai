

# Limpeza para Produção - Soft Launch Amélia

## Situação Atual

| Tabela | Registros | Observação |
|--------|-----------|------------|
| lead_cadence_runs | 368 ATIVAS | 269 Blue + 99 Tokeniza - todas pendentes de disparo |
| lead_cadence_events | 391 | Logs de eventos das cadencias |
| lead_messages | 449 | 51 ERRO, 75 ENVIADO, 208 UNMATCHED, 115 RECEBIDO |
| lead_message_intents | 100 | Interpretacoes da IA |
| lead_contacts | 1.523 | Cadastro de contatos (MANTER) |
| lead_classifications | 1.522 | Classificacoes (MANTER) |
| sgt_events | 790.249 | Eventos historicos do SGT (MANTER) |
| closer_notifications | 0 | Vazio |

## O que sera limpo

Dados operacionais que poderiam disparar mensagens indesejadas:

1. **lead_message_intents** - 100 registros (interpretacoes antigas)
2. **lead_cadence_events** - 391 registros (logs de steps)
3. **lead_cadence_runs** - 368 runs ATIVAS (evita disparos do cadence-runner)
4. **lead_messages** - 449 mensagens (historico de teste)

## O que sera mantido

Dados cadastrais que nao disparam acoes:

- **lead_contacts** (1.523) - cadastro dos leads
- **lead_classifications** (1.522) - classificacoes comerciais
- **sgt_events** (790.249) - historico de ingestao
- **cadences** e **cadence_steps** - moldes das cadencias (nao disparam nada sozinhos)

## Ordem de execucao (respeitando foreign keys)

```text
1. DELETE lead_message_intents
2. DELETE lead_cadence_events
3. DELETE lead_cadence_runs
4. DELETE lead_messages
```

## Resultado esperado

Apos a limpeza, o sistema estara com:
- Zero cadencias pendentes (cadence-runner nao tera nada para disparar)
- Zero mensagens no historico
- Leads cadastrados e classificados prontos para novos fluxos
- Novos leads que entrarem via SGT webhook iniciarao cadencias limpas

## Secao Tecnica

Uma unica migration SQL executara os 4 DELETEs na ordem correta. Nao ha risco de perda de dados cadastrais - apenas dados operacionais de teste serao removidos.

