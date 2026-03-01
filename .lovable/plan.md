

# Corrigir: Áudio inbound não é transcrito nem processado pela Amélia

## Problema

Quando o lead envia um áudio via WhatsApp:
1. O `meta-webhook` salva a mensagem com `conteudo: "[Áudio]"` e o arquivo `.ogg` no storage
2. **Linha 610**: `if (lead && mediaInfo.tipo_midia === "text")` — o `sdr-ia-interpret` só é chamado para mensagens de texto
3. Resultado: áudio é ignorado, nenhuma transcrição, nenhuma resposta

O áudio do Arthur Coelho está salvo em `whatsapp-media/inbound/2026-02-28/1467805894958387.ogg` mas nunca foi processado.

## Solução

### 1. Migração: adicionar coluna `transcricao_audio` na tabela `lead_messages`

```sql
ALTER TABLE lead_messages ADD COLUMN transcricao_audio TEXT;
```

### 2. Modificar `meta-webhook/index.ts`

**Após salvar a mensagem de áudio**, antes de chamar o `sdr-ia-interpret`:

- Baixar o arquivo `.ogg` do storage
- Enviar para transcrição via Gemini 2.5 Flash multimodal (mesmo approach usado no `call-transcribe`) através do Lovable AI Gateway
- Atualizar `lead_messages.conteudo` com o texto transcrito (e salvar original em `transcricao_audio`)
- Chamar `sdr-ia-interpret` com o messageId normalmente (removendo o filtro `tipo_midia === "text"`)

**Mudança na linha 610**: remover a condição `mediaInfo.tipo_midia === "text"` e substituir por lógica que:
- Para `text`: chamar sdr-ia-interpret diretamente (como hoje)
- Para `audio`: transcrever primeiro, atualizar conteudo, depois chamar sdr-ia-interpret
- Para outros tipos (image, video, sticker): não chamar sdr-ia-interpret (manter comportamento atual)

### 3. Lógica de transcrição no meta-webhook

Reutilizar o padrão já existente no `call-transcribe`:
```
POST https://ai.gateway.lovable.dev/v1/chat/completions
model: google/gemini-2.5-flash
content: [{ type: "input_audio", input_audio: { data: base64, format: "ogg" } }, { type: "text", text: "Transcreva..." }]
```

O `LOVABLE_API_KEY` já está disponível como secret.

### 4. Timeout

O edge function tem limite de 30s. A transcrição de áudio curto (< 2min, típico de WhatsApp) leva ~3-5s no Gemini Flash. Cabe no budget de tempo.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/meta-webhook/index.ts` | Adicionar função de transcrição de áudio + expandir condição da linha 610 para processar áudios |

## Migração necessária

| Tabela | Coluna | Tipo |
|--------|--------|------|
| `lead_messages` | `transcricao_audio` | `TEXT` (nullable) |

