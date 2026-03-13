

## Problema

Meta rejeita o áudio porque os **bytes são WebM** mas o MIME diz `audio/ogg`. Apenas mudar o label não funciona — Meta valida o conteúdo real do arquivo. Não é possível fazer remuxagem WebM→OGG em pure JS de forma confiável sem FFmpeg.

## Solução: Conversão server-side via FFmpeg

A única solução confiável é converter o container WebM→OGG no servidor. Deno edge functions não têm FFmpeg nativo, mas podemos usar uma abordagem alternativa:

**Opção escolhida: Usar a API da Meta com `audio/webm` sem fallback para OGG, e se falhar, enviar como documento.**

Espera — os logs mostram que `audio/webm` é rejeitado pela Meta (erro 100: tipo não suportado). E `audio/ogg` com bytes WebM também falha.

**Solução real: Converter via FFmpeg em um edge function dedicado.**

### Plano

1. **Criar edge function `audio-convert`** que:
   - Recebe a URL do arquivo no storage
   - Baixa o arquivo WebM
   - Usa FFmpeg via WASM (`ffmpeg.wasm` para Deno) para converter WebM→OGG (Opus)
   - Faz upload do arquivo convertido de volta ao storage
   - Retorna a nova URL

   **Problema**: FFmpeg WASM é ~30MB, pesado demais para edge function com limite de memória/tempo.

**Alternativa pragmática**: Converter no **cliente** usando a Web API `AudioEncoder`/`AudioDecoder` (disponível no Chrome) para produzir um OGG real, OU usar uma lib JS leve como `opus-media