
# Exibir o ID completo da oferta no card de Pendências

## Problema
No componente `OfertaSemNomeCard` em `src/pages/admin/PendenciasPerda.tsx`, linha 268, o `oferta_id` é truncado propositalmente para exibição visual:

```tsx
ID: {oferta.oferta_id.slice(0, 8)}…
```

Isso impossibilita localizar a oferta na plataforma da Tokeniza, pois o UUID completo é necessário para fazer a correspondência.

## Alteração

Apenas **um arquivo**, **uma linha**:

**`src/pages/admin/PendenciasPerda.tsx` — linha 268**

- Antes: `ID: {oferta.oferta_id.slice(0, 8)}…`
- Depois: `ID: {oferta.oferta_id}`

O ID completo tem 36 caracteres (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) e cabe perfeitamente no `CardTitle` com a classe `font-mono text-sm` já aplicada. Nenhuma outra alteração é necessária.
