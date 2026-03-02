

## Plano: Corrigir validação de recording_url no call-transcribe

### Causa raiz

O webhook Zadarma está gravando o timestamp Unix no campo `recording_url` em vez da URL real do áudio. Quando a transcrição Zadarma falha e o fallback GPT multimodal tenta `fetch(recordingUrl)`, ele recebe `"1772454999.9337386"` que não é uma URL válida → `TypeError: Invalid URL`.

### Correção

No `supabase/functions/call-transcribe/index.ts`, adicionar validação na função `transcribeWithGPTMultimodal` antes do `fetch`:

```typescript
// No início de transcribeWithGPTMultimodal, antes do fetch:
if (!recordingUrl.startsWith('http')) {
  log.warn('Invalid recording URL (not HTTP)', { recordingUrl });
  return null;
}
```

Também adicionar a mesma validação no bloco principal (linha ~198) antes de chamar a função:

```typescript
// Fallback: GPT multimodal — validar URL
if (!transcriptResult && call.recording_url && call.recording_url.startsWith('http')) {
```

### Investigação adicional

Verificar o webhook Zadarma (`zadarma-webhook`) para entender por que está salvando timestamp no campo `recording_url`. Pode ser necessário corrigir o mapeamento lá também para evitar dados sujos futuros.

### Arquivos alterados

1. `supabase/functions/call-transcribe/index.ts` — validação de URL

