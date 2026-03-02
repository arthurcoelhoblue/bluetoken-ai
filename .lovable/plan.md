

## Correção: Mensagens inbound roteadas para empresa errada + sem contact_id

### Causa Raiz (atualizada)

Dois problemas identificados:

1. **Empresa errada**: `findLeadByPhone` encontrava o lead em qualquer empresa (fallback sem filtro). Quando um contato existia na TOKENIZA, mensagens vindas do número da BLUE eram salvas como TOKENIZA porque `lead.empresa` sobrescrevia `resolvedEmpresa`.

2. **Sem contact_id**: Mensagens inbound eram salvas sem `contact_id`, tornando-as invisíveis na UI para contatos sem `legacy_lead_id`.

### Correção aplicada

**Arquivo**: `supabase/functions/meta-webhook/index.ts`

1. **Prioridade do `resolvedEmpresa`**: Quando o lead encontrado está em empresa diferente da resolvida via `phone_number_id`, re-busca exclusivamente na empresa correta. Se não encontrar, auto-cria.

2. **`const empresa = resolvedEmpresa`**: O `phone_number_id` é sempre a fonte de verdade, nunca mais sobrescrito pelo `lead.empresa`.

3. **Lookup de `contact_id`**: Após encontrar o lead, busca o contato correspondente em `contacts` (por `telefone_e164` ou `legacy_lead_id` + empresa) e inclui no insert.

### Deploy

Redeployado `meta-webhook`.
