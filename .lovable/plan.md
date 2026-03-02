

## Correção: Template sem parâmetros na chamada Meta API

### Problema

Os templates da Blue têm variáveis (ex: `{{1}}` para o nome do contato), mas ao enviar via Meta API, os `components` passados são o formato de **definição** do template (com `example`), não o formato de **envio** (com `parameters`). A Meta rejeita com erro 132000: "number of localizable_params (0) does not match expected (1)".

O `amelia-mass-action` já faz essa conversão corretamente (linhas 154-177), mas o `cadence-runner` e envios manuais via `whatsapp-send` não fazem.

### Solução

Centralizar a conversão no `whatsapp-send/index.ts` — antes de chamar `sendTemplateViaMetaCloud`, detectar se os `metaComponents` recebidos estão no formato de definição (têm `example`/`text` mas não `parameters`) e convertê-los automaticamente para o formato de envio.

**Arquivo**: `supabase/functions/whatsapp-send/index.ts`

Lógica a adicionar antes da chamada `sendTemplateViaMetaCloud`:

1. Verificar se `metaComponents` contém componentes no formato de definição (campo `example` presente ou ausência de `parameters`)
2. Para cada componente BODY com placeholders `{{N}}`:
   - Contar os placeholders
   - Mapear `{{1}}` → nome do contato (buscar do `contacts` via `contactId`)
   - Demais parâmetros: usar valores do `example.body_text` como fallback
3. Montar o array no formato correto: `[{ type: "body", parameters: [{ type: "text", text: "João" }] }]`
4. Se `metaComponents` é `undefined`/vazio mas o template tem parâmetros, buscar `meta_components` do banco e aplicar a mesma conversão

**Busca do nome do contato**: já temos `contactId` disponível no fluxo — fazer um `select nome from contacts where id = contactId` se necessário.

### Deploy

Redeployar `whatsapp-send` após a alteração.

