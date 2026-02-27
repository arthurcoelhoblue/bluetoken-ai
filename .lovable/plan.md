

## Diagnóstico

O `sdr-proactive-outreach` chama `sendTextViaMetaCloud` diretamente (linha 270), sem verificar a janela de 24h. Quando o canal é `META_CLOUD` e o lead nunca respondeu (ou respondeu há mais de 24h), a Meta rejeita texto livre — exige template aprovado.

**Estado atual dos templates**: Todos os 17+ templates no banco estão com `meta_status: LOCAL`. Nenhum foi submetido/aprovado na Meta, então não há template utilizável para envio fora da janela.

## Plano

### 1. Adicionar verificação de janela 24h no `sdr-proactive-outreach`

No `sendViaActiveChannel`, antes de enviar texto livre via Meta Cloud:
- Consultar `lead_conversation_state.last_inbound_at` para o lead
- Calcular se está dentro da janela de 24h

### 2. Fallback para template quando fora da janela

Se fora da janela de 24h + canal META_CLOUD:
- Buscar template aprovado (`meta_status = 'APPROVED'`) na `message_templates` para a empresa, com código de prospecção (ex: `*_INBOUND_DIA0` ou novo `PROACTIVE_OUTREACH`)
- Usar `sendTemplateViaMetaCloud` do `channel-resolver.ts` com os components do template
- Se nenhum template aprovado existir, retornar erro claro: `"Nenhum template aprovado disponível para envio fora da janela de 24h"`

### 3. Lógica de seleção de template

Ordem de prioridade:
1. Template com código `{EMPRESA}_PROACTIVE_OUTREACH` e `meta_status = 'APPROVED'`
2. Template com código `{EMPRESA}_INBOUND_DIA0` e `meta_status = 'APPROVED'`
3. Qualquer template `APPROVED` da empresa no canal WHATSAPP

### 4. Adaptar o prompt de IA

Quando for enviar via template (fora da janela), a IA não precisa gerar a mensagem — o conteúdo é fixo do template. A resposta deve indicar qual template foi usado.

### 5. Pré-requisito: templates aprovados na Meta

Nenhum template está aprovado atualmente. O usuário precisará:
- Criar templates na plataforma Meta (via interface admin existente ou diretamente no Meta Business)
- Aguardar aprovação
- Atualizar `meta_status` e `meta_template_id` no banco

Sem templates aprovados, o fallback retornará erro informativo.

### Detalhes técnicos

**Arquivo**: `supabase/functions/sdr-proactive-outreach/index.ts`

Mudanças na função `sendViaActiveChannel`:
```
1. Import sendTemplateViaMetaCloud
2. Receber supabase, empresa, leadId como params adicionais
3. Se META_CLOUD:
   a. Consultar last_inbound_at
   b. Se dentro de 24h → sendTextViaMetaCloud (como hoje)
   c. Se fora de 24h → buscar template APPROVED → sendTemplateViaMetaCloud
   d. Se sem template → retornar erro
```

**Arquivo**: `supabase/functions/_shared/channel-resolver.ts` — já tem `sendTemplateViaMetaCloud`, sem alterações necessárias.

