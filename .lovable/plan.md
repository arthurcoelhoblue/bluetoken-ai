

# Corrigir integração Blue Chat (Inbound + Outbound)

## Problemas identificados

1. **Inbound (Blue Chat -> Amelia)**: 8 chamadas, 0 sucesso
   - 4x HTTP 401: Blue Chat nao envia token de autenticacao
   - 4x HTTP 400: Payload nao passa na validacao Zod (formato diferente do esperado)

2. **Outbound (Amelia -> Blue Chat)**: Endpoint `/conversations` retorna 404, `/messages` exige `ticketId`

## Plano de correcao

### Etapa 1: Adicionar logging do payload bruto no inbound

Antes da validacao Zod, logar o payload bruto recebido para entender exatamente o formato que o Blue Chat esta enviando. Isso e critico para ajustar o schema.

**Arquivo**: `supabase/functions/bluechat-inbound/index.ts`

- Antes do `blueChatSchema.safeParse(rawPayload)`, adicionar:
```
log.info('Payload bruto recebido', { 
  keys: Object.keys(rawPayload), 
  raw: JSON.stringify(rawPayload).substring(0, 500) 
});
```

- No bloco de erro do Zod, logar o payload que falhou:
```
log.error('Validacao Zod falhou', { 
  errors: parsed.error.errors, 
  payloadKeys: Object.keys(rawPayload),
  rawPreview: JSON.stringify(rawPayload).substring(0, 300)
});
```

### Etapa 2: Flexibilizar autenticacao para debug

As 4 chamadas 401 mostram que o Blue Chat nao envia token. Precisamos verificar se ha um outro header sendo usado (ex: `x-webhook-secret`, query param, etc).

**Arquivo**: `supabase/functions/bluechat-inbound/index.ts`

- Logar todos os headers recebidos quando a autenticacao falha:
```
log.warn('Headers recebidos', { 
  headers: Object.fromEntries(req.headers.entries()),
  hasAuth: !!req.headers.get('Authorization'),
  hasApiKey: !!req.headers.get('X-API-Key'),
});
```

### Etapa 3: Corrigir outbound (Amelia -> Blue Chat)

O endpoint `/api/external-ai/conversations` nao existe no Blue Chat. Conforme a memoria do projeto, o protocolo correto e enviar sempre via `POST /messages` com `phone` obrigatorio e `ticketId` quando disponivel.

**Arquivo**: `supabase/functions/sdr-proactive-outreach/index.ts`

- Remover a tentativa de chamar `/conversations` (retorna 404)
- Enviar direto para `/messages` com `phone` como identificador primario
- Incluir `ticketId` do `framework_data` quando disponivel, mas nao falhar se ausente

### Etapa 4: Deploy e teste

1. Deploy das edge functions corrigidas
2. Disparar um teste manual no `bluechat-inbound` com o token correto para confirmar que o fluxo funciona
3. Verificar logs para capturar o proximo payload real do Blue Chat

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/bluechat-inbound/index.ts` | Adicionar logging de payload bruto e headers |
| `supabase/functions/sdr-proactive-outreach/index.ts` | Remover fallback `/conversations`, enviar direto via `/messages` |

## Resultado esperado

Apos o deploy, os proximos payloads do Blue Chat serao logados com detalhe suficiente para ajustar o schema. O outbound deixara de tentar um endpoint inexistente.

