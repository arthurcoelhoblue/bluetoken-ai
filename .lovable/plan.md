

## Diagnóstico Completo

Dois problemas encontrados:

### 1. Áudio WebM não é entregue pelo WhatsApp
- Chrome grava como `audio/webm` (não suporta OGG nativamente)
- O edge function faz upload para Meta com MIME `audio/ogg`, mas os bytes continuam sendo WebM
- Meta aceita o upload, retorna `wamid`, mas **falha na entrega** (status `failed` no webhook)
- Simplesmente re-rotular o MIME não converte o container

### 2. Status "failed" não é salvo no banco
- O webhook mapeia `failed` → `FALHA`, mas o check constraint só permite `ERRO`
- Resultado: o áudio fica com estado `ENVIADO` eternamente, escondendo a falha

---

## Correção

### A. Remuxar WebM→OGG no edge function (`whatsapp-send`)
Em vez de só mudar o MIME type, fazer remuxagem real do container. WebM com Opus e OGG com Opus usam o mesmo codec — a diferença é só o container (header bytes). 

Implementação: quando o `mediaUrl` for `.webm` e o `mediaType` for `audio`, o edge function vai:
1. Baixar o arquivo do storage
2. Criar um container OGG válido com os dados Opus extraídos do WebM
3. Fazer upload para Meta com o OGG real

Como remuxagem pura WebM→OGG é complexa sem FFmpeg, a abordagem mais prática é: **enviar como documento** (type `document`) quando o áudio é WebM, com fallback. Porém isso muda a UX.

**Abordagem mais robusta**: usar FFmpeg via fetch a um serviço externo ou usar a biblioteca `@aspect-build/rules_ts` — mas é complexo para edge functions.

**Abordagem pragmática escolhida**: No edge function, baixar o WebM, e usar um conversor OGG minimalista em pure JS (escrever os headers OGG+Opus manualmente envolvendo os frames Opus do WebM). Isso é viável porque:
- WebM/Matroska com codec Opus armazena frames Opus puros
- OGG é um container simples (page headers + Opus frames)

Dado a complexidade de parsing WebM em Deno, a melhor alternativa prática:
- **Enviar o áudio como `audio/mp4`** em vez de `audio/ogg` — o WhatsApp suporta `audio/mp4` e o container conversion é mais simples
- OU **usar o Media Upload API sem forçar o MIME type** — enviar como `audio/webm` e deixar Meta tentar processar

Na verdade, a solução **mais simples e confiável**: mudar o `uploadMediaToMeta` para enviar com o MIME real do arquivo (`audio/webm`) em vez de forçar `audio/ogg`. Se Meta rejeitar webm no upload, fazer fallback para enviar como **documento** (que o WhatsApp entrega sem restrição de formato).

### B. Corrigir mapeamento de status (`meta-webhook`)
Alterar `META_STATUS_MAP` de `failed: "FALHA"` para `failed: "ERRO"` para compatibilidade com o check constraint.

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/meta-webhook/index.ts` | `failed` → `"ERRO"` no `META_STATUS_MAP` |
| `supabase/functions/whatsapp-send/index.ts` | Enviar áudio com MIME real; fallback para documento se upload falhar |
| `supabase/functions/_shared/channel-resolver.ts` | `uploadMediaToMeta` aceitar MIME dinâmico; adicionar `sendMediaByIdViaMetaCloud` genérico |

