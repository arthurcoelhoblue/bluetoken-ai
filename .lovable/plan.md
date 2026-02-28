

# Separação de Transcrição por Canal + Talk Ratio

## Contexto

A API Zadarma (`GET /v1/pbx/record/transcript/`) retorna dados separados por canal:
- `phrases[].result` = texto da frase, `phrases[].channel` = 1 (vendedor) ou 2 (cliente)
- `words[].result[]` = palavras com `s` (início) e `e` (fim), `words[].channel`

Atualmente o `call-transcribe` trata a transcrição como texto plano único.

## Plano de Implementação

### 1. Atualizar `fetchZadarmaTranscript` no edge function `call-transcribe`

- Alterar para solicitar `return=words,phrases` na chamada ao proxy
- Parsear a resposta estruturada (phrases por canal) em vez de texto plano
- Retornar objeto `{ plainText, dialogue, talkRatio }` em vez de string
  - `dialogue`: array `[{ speaker: 'VENDEDOR'|'CLIENTE', text, startTime, endTime }]`
  - `talkRatio`: `{ seller_pct, client_pct, seller_words, client_words }`
- Calcular talk ratio baseado no tempo total de fala por canal (soma dos `e - s` de cada word)

### 2. Atualizar proxy `get_transcript` action

- Passar parâmetros `return: 'words,phrases'` para a API Zadarma para obter dados completos por canal

### 3. Atualizar tabela `calls` — migração DB

- Adicionar coluna `transcription_channels` (JSONB, nullable) — armazena o diálogo formatado
- Adicionar coluna `talk_ratio` (JSONB, nullable) — `{ seller_pct, client_pct, seller_words, client_words }`

### 4. Atualizar lógica de salvamento no `call-transcribe`

- Salvar `transcription_channels` e `talk_ratio` no update da call
- Incluir `talk_ratio` no metadata da deal_activity
- Manter `transcription` (texto plano) como fallback para backward compat

### 5. Atualizar tipo `Call` em `src/types/telephony.ts`

- Adicionar campos `transcription_channels` e `talk_ratio`

### 6. Atualizar `DealCallsPanel.tsx` — UI de diálogo

- No dialog de transcrição, se `transcription_channels` existir, renderizar como diálogo formatado:
  - Vendedor: bolhas alinhadas à direita (cor primária)
  - Cliente: bolhas alinhadas à esquerda (cor neutra)
- Mostrar badge de talk ratio na lista de chamadas (ex: "🎙 65/35")
- Fallback para texto plano se só tiver `transcription`

### 7. Atualizar query em `useDealCalls`

- Incluir `transcription_channels, talk_ratio` no select

## Arquitetura de Dados

```text
calls table (new columns):
├─ transcription_channels: JSONB
│  [{ speaker: "VENDEDOR"|"CLIENTE", text: "...", start: 0.02, end: 3.5 }]
└─ talk_ratio: JSONB
   { seller_pct: 65, client_pct: 35, seller_words: 120, client_words: 64 }
```

