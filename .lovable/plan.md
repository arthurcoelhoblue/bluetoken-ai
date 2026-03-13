
Objetivo: corrigir definitivamente o auto-atendimento no fluxo click-to-call (PBX liga para o WebRTC, mas não atende sozinho).

### O que está falhando hoje (com base no código)
1. O auto-answer depende de detectar eventos/logs (`console.log`, `postMessage`, `zadarmaWidgetEvent`). Se o widget não emitir esses padrões, o atendimento nunca dispara.  
2. O fallback de clique (Layer 3) está frágil porque o CSS de ocultação usa `!important`; o “enable interaction” atual não garante override real.  
3. `tryAnswerViaSipSession()` tem caminho de iframe que não retorna sucesso corretamente (resposta pode acontecer e o fluxo não saber).  
4. A máquina de estado bloqueia transições em alguns cenários de callback (ex.: confirmação com status fora de `calling/ringing`).

### Plano de implementação

1) **Tornar o auto-answer “proativo”, não reativo a log**
- Ao `setPendingOutbound(true)`, iniciar um watchdog por janela curta (ex.: 20s) que:
  - varre sessão SIP periodicamente (250–500ms),
  - se achar sessão incoming, responde imediatamente (`session.answer()`),
  - encerra ao atender, ao expirar timeout, ou ao hangup.
- Isso remove dependência de logs/eventos do widget.

2) **Corrigir e endurecer Layer 1 (SIP session)**
- Refatorar `tryAnswerViaSipSession` para retornar `boolean` consistente em todos os caminhos (incluindo iframe).
- Cobrir mais estruturas de sessão (sem depender só de `direction === 'incoming'`, também estado de ringing quando disponível).

3) **Consertar Layer 3 (DOM fallback) para realmente funcionar**
- Substituir estratégia de “set style inline” por override com prioridade real:
  - pausar/desabilitar temporariamente o style `#zadarma-hide` durante tentativa,
  - remover `inert` e restabelecer após tentativa.
- Garantir restauração limpa para não deixar widget visível/interativo depois.

4) **Ajustar máquina de estado para callback PBX**
- Permitir transição para `active` quando houver confirmação durante janela `pendingOutbound` (mesmo se status atual não for `calling/ringing`).
- Adicionar timeout explícito para `pendingOutbound` (evitar ficar “armado” indefinidamente).

5) **Melhor observabilidade (para fechar o bug sem tentativa cega)**
- Adicionar logs estruturados por etapa (`pending_on`, `sip_found`, `sip_answer_ok`, `fallback_click`, `pending_timeout`).
- Exibir erro amigável no widget quando timeout ocorrer (“WebRTC tocou mas autoatendimento não concluiu”).

### Arquivos a alterar
- `src/hooks/useZadarmaWebRTC.ts` (principal)
- `src/components/zadarma/ZadarmaPhoneWidget.tsx` (ajuste de sinalização/timeout do pending)

### Critérios de aceite
1. Click-to-call inicia → callback PBX chega → chamada atende automaticamente em até ~3s.  
2. Se não houver sessão atendível, encerra com timeout controlado (sem travar estado).  
3. Inbound normal continua funcionando.  
4. Hangup continua funcional e não reativa auto-answer indevidamente na chamada seguinte.
