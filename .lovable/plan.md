

# Filtrar templates por status Meta nas ações em massa

## Problema
A query de templates em `AmeliaMassActionPage.tsx` (linha 129-145) filtra apenas por `ativo = true`, mas não verifica o `meta_status`. Templates pendentes, rejeitados ou locais aparecem na lista de seleção.

## Correção em `src/pages/AmeliaMassActionPage.tsx`

### Adicionar filtro `meta_status = 'APPROVED'` para canal WhatsApp
Na função `useTemplates` (linha 129), após o filtro `.eq('ativo', true)`, adicionar condição para que templates de WhatsApp só apareçam se `meta_status` for `APPROVED`:

```typescript
// Após .eq('canal', canal)
.eq('meta_status', 'APPROVED')
```

Isso garante que apenas templates aprovados pela Meta apareçam na seleção de ações em massa, independente do canal (para e-mail, `meta_status` seria `LOCAL` ou similar — se necessário, aplicar o filtro apenas quando `canal === 'WHATSAPP'`).

### Verificação
- Se o canal for `WHATSAPP`, filtrar por `meta_status = 'APPROVED'`
- Se for `EMAIL`, manter sem filtro de `meta_status` (ou filtrar apenas `ativo = true`)

