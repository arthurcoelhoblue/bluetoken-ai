

## Correcao da regex de validacao de email no sanitizador de leads

### Problema
A funcao `isValidEmailFormat` em `supabase/functions/sgt-webhook/normalization.ts` usa uma regex com escape incorreto:

```typescript
// ATUAL (bugado)
const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
```

Dentro de uma regex literal (`/.../`), `\\s` nao representa whitespace — representa o caractere literal `\` seguido de `s`. Isso faz emails perfeitamente validos como `coutinhoquiter@gmail.com` falharem na validacao, gerando issues `EMAIL_INVALIDO` falso-positivas.

### Solucao
Corrigir a regex para usar escape simples, que e o correto em regex literal do JavaScript/TypeScript:

```typescript
// CORRIGIDO
const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Impacto
- Leads futuros nao receberao mais a tag `EMAIL_INVALIDO` por falso positivo.
- Issues ja criadas incorretamente permanecem no banco (as resolvidas, como a do Coutinho, ja estao ok; as pendentes de outros leads podem ser limpas).

### Arquivos
- `supabase/functions/sgt-webhook/normalization.ts` — corrigir linha 65, trocar `\\s` por `\s` e `\\.` por `\.`

### Opcional (limpeza de dados)
- Resolver automaticamente issues `EMAIL_INVALIDO` pendentes que tenham email valido no `lead_contacts`, para nao deixar lixo historico.
