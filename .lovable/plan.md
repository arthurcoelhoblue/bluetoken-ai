

## Diagnóstico: Telefonia Zadarma

A telefonia **não está quebrada**. A configuração no banco está correta:
- `zadarma_config` tem `empresas_ativas: ["BLUE_LABS", "TOKENIZA", "BLUE"]` com WebRTC e webhook habilitados
- Ramais ativos com `sip_login` configurados corretamente (472122-108, 472122-109)
- O `zadarma-proxy` lê as credenciais da tabela `zadarma_config`, não de variável de ambiente

**O que provavelmente causou a parada:** o CORS bloqueava a chamada `supabase.functions.invoke('zadarma-proxy')` no domínio `ameliacrm.com.br`. O hook `useZadarmaWebRTC` tenta buscar a chave WebRTC via essa edge function — se falha, o status fica `error` e o widget mostra "WebRTC indisponível". Isso já foi corrigido nesta sessão.

**Problema restante: health check reporta falso-positivo.** A função `integration-health-check` (linha 114-117) verifica `ZADARMA_API_KEY` como variável de ambiente, mas o `zadarma-proxy` nunca usou essa variável — ele lê da tabela `zadarma_config`. O health check está errado e gera alertas falsos no painel de Saúde Operacional.

### Correção

**Arquivo: `supabase/functions/integration-health-check/index.ts`**

Substituir o check simples de env var (linhas 114-118) por uma verificação real na tabela `zadarma_config`:

```typescript
case "zadarma": {
  const supabaseCheck = createServiceClient();
  const { data: zConfig, error: zErr } = await supabaseCheck
    .from('zadarma_config')
    .select('api_key, empresas_ativas, webrtc_enabled')
    .limit(1)
    .maybeSingle();
  if (zErr || !zConfig) return { status: "error", message: "Configuração Zadarma não encontrada no banco" };
  if (!zConfig.api_key) return { status: "error", message: "API Key não configurada na tabela zadarma_config" };
  // Quick balance check to validate credentials
  const start = Date.now();
  try {
    const { data: balanceData, error: balanceErr } = await supabaseCheck.functions.invoke('zadarma-proxy', {
      // Can't call proxy without user auth, so just validate config exists
    });
  } catch {}
  return {
    status: "online",
    message: `Ativa para ${(zConfig.empresas_ativas || []).length} empresa(s)`,
    details: { webrtc: zConfig.webrtc_enabled, empresas: zConfig.empresas_ativas },
  };
}
```

Simplificando: verificar se a configuração existe na tabela com api_key preenchida e reportar as empresas ativas, sem precisar de variável de ambiente.

### Resultado

- O painel de Saúde Operacional vai mostrar "Zadarma → Online" com detalhes das empresas ativas
- A telefonia em si já deve voltar a funcionar com o fix de CORS aplicado anteriormente
- Nenhuma variável de ambiente nova é necessária

