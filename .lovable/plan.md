

## Problema

O webhook registra chamadas de **todos** os ramais do PBX Zadarma, incluindo ramais que não estão mapeados no CRM. Isso acontece por causa do fallback nas linhas 67-69: quando o ramal não é encontrado na tabela `zadarma_extensions`, o código usa a primeira empresa ativa e registra a chamada mesmo assim.

## Correção

No `supabase/functions/zadarma-webhook/index.ts`, **remover o fallback** e ignorar eventos de ramais não mapeados:

1. **Linhas 66-69**: Remover o bloco `if (!empresa && empresasAtivas.length > 0)` que usa a primeira empresa como fallback
2. **Linhas 71-74**: O bloco `if (!empresa)` já existe — alterar a mensagem de log para indicar que o ramal foi ignorado por não estar no CRM, e retornar `200 OK` (sem registrar chamada)

Resultado: apenas chamadas de ramais cadastrados em `zadarma_extensions` serão registradas no banco.

### Arquivo alterado

1. `supabase/functions/zadarma-webhook/index.ts` — remover fallback de empresa para ramais não mapeados

