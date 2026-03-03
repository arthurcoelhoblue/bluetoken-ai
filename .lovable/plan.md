

## Diagnóstico: Mensagens enviadas mas não entregues para 556198317422

### O que os dados mostram

| Horário | Direção | from_phone_number_id | Estado | Conteúdo |
|---------|---------|---------------------|--------|----------|
| 11:44 | OUT (template) | **1009376255595711** (antigo) | ENVIADO | tkn_followup_1 |
| 11:45 | IN | — | RECEBIDO | "Oi" (resposta ao template acima) |
| 11:45 | OUT (auto-reply) | **1054747871049688** (Comercial) | ENVIADO | Resposta da Amélia |
| 12:12 | OUT (manual) | **1054747871049688** (Comercial) | ENVIADO | "Ola" |
| 12:14 | OUT (manual) | **1054747871049688** (Comercial) | ENVIADO | "alo" |

As mensagens anteriores (2 de março) do número **1009376255595711** chegaram como **ENTREGUE**. As de hoje do **1054747871049688** ficaram apenas como **ENVIADO**.

### Causa raiz: janela de conversa por número

Na API Cloud da Meta, a **janela de 24h é POR número de telefone comercial**. O Arthur Coelho recebeu o template pelo número antigo (`1009376255595711`) e respondeu a ELE. A conversa aberta é com esse número.

Quando o sistema responde pelo número **diferente** (`1054747871049688` — Comercial Tokeniza BR), a Meta aceita o request (retorna `wamid`), mas **não entrega** a mensagem porque não há janela de conversa aberta entre o Arthur e esse segundo número.

### Isso NÃO é bug de código

O `whatsapp-send` está funcionando corretamente — ele envia pelo número ativo selecionado e a Meta aceita. O problema é de regra de negócio da API Meta: cada phone_number_id tem sua própria janela de conversa independente.

### Solução imediata (manual)

Para o Arthur receber mensagens do número Comercial Tokeniza BR, é preciso enviar um **template** (não mensagem livre) por esse número. Templates podem ser enviados fora da janela de 24h e abrem uma nova conversa.

### Solução sistêmica (código)

Duas melhorias possíveis:

1. **Rastrear `from_phone_number_id` nas mensagens inbound** — quando chega um inbound, gravar de qual número comercial ele veio, e usar esse mesmo número para responder (auto-reply da Amélia e mensagens manuais).

2. **Bloquear envio de texto livre para número sem janela aberta** — no `whatsapp-send`, verificar se existe mensagem INBOUND recente (últimas 24h) vinda do mesmo `phone_number_id` que será usado para enviar. Se não houver, forçar uso de template ou alertar o usuário.

### Arquivos envolvidos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-send/index.ts` | Validar janela de conversa antes de enviar texto livre; sugerir template se não houver janela |
| `supabase/functions/whatsapp-inbound/index.ts` | Gravar `from_phone_number_id` nas mensagens inbound para rastrear qual número comercial recebeu |
| `src/components/conversas/ManualMessageInput.tsx` | Mostrar aviso ao usuário quando não há janela aberta para o número selecionado |

### Recomendação

Implementar a **solução 1** (rastrear inbound phone e responder pelo mesmo número) é a mais importante, pois evita que a Amélia responda automaticamente pelo número errado. A solução 2 (bloquear texto livre sem janela) é um complemento de UX.

Quer que eu implemente essas correções?
