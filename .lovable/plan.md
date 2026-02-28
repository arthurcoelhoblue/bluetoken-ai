

# Diagnóstico: Transcrição, Gravação e Coaching ao Vivo

## Problemas Encontrados

### 1. Estado `active` nunca é atingido — Coaching nunca dispara

Os logs mostram claramente a sequência do Zadarma v9:
```
accepted    ← palavra solta
confirmed   ← palavra solta
```

Mas o interceptor de console.log exige padrões compostos como `call confirmed` ou `call accepted`. A palavra solta `confirmed` e `accepted` NÃO matcham. Resultado: o status WebRTC fica em `ringing` para sempre, nunca vai para `active`, e `showCoaching` (que depende de `phoneState === 'active'`) nunca é true. O `call-coach` nunca é invocado (confirmado: zero logs na edge function).

### 2. Webhook não recebeu NOTIFY_OUT_END — sem gravação nem transcrição

Os registros no banco mostram dois call records para o mesmo `pbx_call_id`:
- Leg 1 (para ramal 108): status `ANSWERED`, `ended_at: null`, `duracao_segundos: 0`
- Leg 2 (para destino): status `RINGING`, `ended_at: null`

Nenhum evento `NOTIFY_OUT_END` ou `NOTIFY_RECORD` foi recebido. Sem `NOTIFY_RECORD`, a transcrição automática nunca é disparada. Isso é um problema do lado Zadarma (webhook config ou a chamada foi curta demais para gerar gravação).

## Correções

### A. `src/hooks/useZadarmaWebRTC.ts` — Reconhecer palavras soltas do Zadarma v9

Na seção de detecção de `ACTIVE` (linha 377-385), adicionar match para as palavras soltas `confirmed` e `accepted` quando o estado atual permite transição (state guard já existe):

```typescript
// Antes: só matchava "call confirmed", "call accepted"
// Depois: também aceita "confirmed" e "accepted" soltos
(combined === 'confirmed' || combined === 'accepted' || 
 combined.includes('call confirmed') || combined.includes('call accepted') || 
 combined.includes('in_call') || combined.includes('session confirmed'))
```

Usar `combined === 'confirmed'` (igualdade exata no combined) para evitar falsos positivos. O `canTransitionToActive` já bloqueia transições de `ready`/`idle`.

Aplicar a mesma lógica no handler de postMessage (linha 448-453).

### B. Verificar configuração de webhook do Zadarma

Consultar a config atual para garantir que as notificações de fim de chamada (`NOTIFY_END`, `NOTIFY_OUT_END`, `NOTIFY_RECORD`) estão habilitadas. Verificar a URL do webhook registrada via `zadarma-proxy`.

### C. Fechar calls sem NOTIFY_END (resiliência)

O call record `7192de6d` tem status `ANSWERED` mas nunca recebeu fim. Adicionar lógica no frontend para, ao detectar hangup via console.log (`terminated`), fazer um PATCH no call record via edge function para fechar a chamada com `ended_at` e `duracao_segundos` calculado localmente. Isso garante que mesmo sem webhook, o registro fica consistente.

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useZadarmaWebRTC.ts` | Aceitar `confirmed`/`accepted` soltos como trigger de `active` (com state guard) |
| `src/hooks/useZadarmaWebRTC.ts` | No handler de `terminated`, chamar endpoint para fechar call record |
| Verificação manual | Checar config webhook Zadarma para NOTIFY_END/NOTIFY_RECORD |

