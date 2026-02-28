

# Web Speech API para Coaching em Tempo Real

## Visão geral
Capturar a fala do vendedor via `webkitSpeechRecognition` (browser, custo zero) e enviar os chunks de texto ao `call-coach` a cada 15s, substituindo o `transcription_chunk: null` atual.

## Arquivos

### 1. Novo: `src/hooks/useSpeechRecognition.ts`
- Hook que encapsula `webkitSpeechRecognition`
- Configuração: `lang: 'pt-BR'`, `continuous: true`, `interimResults: false`
- Acumula `finalTranscript` (texto completo) e expõe `getAndResetChunk()` para consumo periódico
- Reinicia automaticamente em caso de erro/stop inesperado (browsers encerram sessões longas)
- Expõe: `start()`, `stop()`, `getAndResetChunk()`, `isListening`, `isSupported`

### 2. Alterar: `src/components/zadarma/CoachingSidebar.tsx`
- Receber nova prop `transcriptionChunk?: string`
- No `fetchCoaching`, enviar `transcription_chunk: transcriptionChunk` ao invés de `null`
- Incluir no array de dependências do `useCallback`

### 3. Alterar: `src/components/zadarma/ZadarmaPhoneWidget.tsx`
- Importar e usar `useSpeechRecognition`
- Iniciar captura quando `phoneState === 'active'`, parar quando encerrar
- A cada 15s (sincronizado com o polling do coaching), chamar `getAndResetChunk()` e passar o texto como prop `transcriptionChunk` ao `CoachingSidebar`
- Indicador visual discreto (ícone de mic pulsando) quando speech recognition está ativo
- Mostrar mensagem de fallback se browser não suporta (`isSupported === false`)

## Fluxo resultante
```text
Chamada ativa → mic browser captura fala do vendedor
  → acumula texto (interimResults off, só final)
  → a cada 15s, CoachingSidebar consome o chunk
  → envia ao call-coach com transcription_chunk preenchido
  → coach retorna insights contextualizados
```

## Limitações conhecidas
- Só captura o lado do vendedor (microfone do browser), não o cliente
- Chrome/Edge suportam bem; Firefox/Safari têm suporte limitado
- Browser pode encerrar sessões longas (~60s); hook reinicia automaticamente

