

# Corrigir lead_id inválido na cadence run

## Problema

A cadence run `b75c272a-58cd-4e53-82aa-bae5bd6eea32` possui `lead_id = 'lead_arthur_blue'`, que nao e um UUID valido. Isso causa erro de validacao quando o `cadence-runner` tenta enviar o email.

## Correcao

Executar um UPDATE na tabela `lead_cadence_runs` para substituir o valor invalido pelo UUID correto do lead Arthur Coelho (empresa BLUE):

```sql
UPDATE lead_cadence_runs
SET lead_id = '108b3896-8744-4cf5-9ed9-caed387177e6'
WHERE id = 'b75c272a-58cd-4e53-82aa-bae5bd6eea32';
```

Apos a correcao, o proximo ciclo do `cadence-runner` (a cada 15 min) processara o step normalmente e enviara o email.

## Arquivos alterados

Nenhum arquivo de codigo sera alterado. Apenas um UPDATE de dados no banco.

