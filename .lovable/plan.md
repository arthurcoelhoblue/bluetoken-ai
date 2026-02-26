

## Plano: Atualizar MENSAGERIA_API_KEY

O secret `MENSAGERIA_API_KEY` já está configurado no backend e já é usado pelas Edge Functions `whatsapp-send` e `integration-health-check`.

### Ação única
Atualizar o valor do secret `MENSAGERIA_API_KEY` para `conn_14320fd834ca3c0dbdca911799f4d43f1e6968df1d14e0b8`.

### Impacto
- **`whatsapp-send`**: Passará a autenticar com a nova chave ao enviar mensagens via Baileys
- **`integration-health-check`**: Health check da mensageria usará a nova chave
- Nenhuma alteração de código necessária — as funções já lêem `MENSAGERIA_API_KEY` via `Deno.env.get()`

