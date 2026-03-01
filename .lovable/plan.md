

# Mostrar transcrição de áudio na conversa

## Problema
A transcrição do áudio existe no banco (`transcricao_audio` na tabela `lead_messages`), mas não é buscada pelo hook nem exibida na UI. O atendente não consegue ver o texto transcrito.

## Mudanças

### 1. Tipo `LeadMessageWithContext` — `src/types/messaging.ts`
Adicionar campo `transcricao_audio?: string | null` na interface `LeadMessage`.

### 2. Hook `useConversationMessages` — `src/hooks/useConversationMessages.ts`
Extrair `transcricao_audio` do resultado da query (mesmo padrão dos outros campos com cast via `Record<string, unknown>`), em todos os 3 blocos de mapeamento de mensagens.

### 3. Componente `MediaContent` — `src/components/messages/MediaContent.tsx`
- Receber nova prop `transcricaoAudio?: string | null`
- No case `audio`: após o player, exibir a transcrição em um bloco estilizado (fundo sutil, ícone de texto, texto da transcrição)
- Se não houver transcrição, mostrar indicador "(sem transcrição)"

### 4. Componente `ConversationView` — `src/components/messages/ConversationView.tsx`
- Passar `transcricaoAudio={message.transcricao_audio}` para o `MediaContent`

### 5. Componente `MessageHistory` — `src/components/messages/MessageHistory.tsx`
- Mesmo ajuste: passar `transcricaoAudio` para `MediaContent` (se esse componente também renderiza mensagens de áudio)

## Resultado
Toda mensagem de áudio (inbound ou outbound) mostrará o player de áudio + a transcrição logo abaixo, sempre visível para o atendente.

