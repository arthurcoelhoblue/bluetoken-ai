

## Diagnóstico

A Edge Function `import-lista-axia` foi criada mas **nunca foi executada**. Dois problemas:

1. **Não registrada no `config.toml`** — sem `verify_jwt = false`, o gateway rejeita a chamada
2. **Nunca foi invocada** — ninguém chamou o endpoint POST

## Plano

1. **Registrar a função no `supabase/config.toml`** adicionando:
   ```toml
   [functions.import-lista-axia]
   verify_jwt = false
   ```

2. **Invocar a função** via `curl_edge_functions` (POST para `/import-lista-axia`) para executar a importação dos ~306 leads

3. **Validar** com query de contagem em `contacts` e `deals` para confirmar que os registros foram criados

Resultado esperado: ~306 contatos + ~306 deals criados na empresa `BLUE_LABS`, pipeline Funil Comercial, etapa MQL, owner Rodrigo Oliveira, com tag "Lista Axia".

