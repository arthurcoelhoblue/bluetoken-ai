

# Abordagem Proativa da Amelia via Blue Chat para Arthur Coelho

## Resumo

Criar um fluxo de "outreach proativo" onde a Amelia inicia uma conversa com um lead no Blue Chat, gerando uma mensagem de saudacao personalizada via SDR IA e enviando automaticamente. Isso envolve criar uma nova edge function que orquestra todo o fluxo: abrir conversa no Blue Chat, gerar mensagem de abordagem, enviar e registrar no sistema.

---

## Contexto atual

- Lead Arthur Coelho existe no sistema: `lead_id = 'lead_arthur_blue'`, empresa BLUE, telefone `5561998317422`
- Canal ativo para BLUE: **bluechat** (confirmado em `integration_company_config`)
- Conversation state atual: `estado_funil = QUALIFICACAO`, `modo = SDR_IA`
- O `bluechat-proxy` ja suporta as acoes `open-conversation` e `send-message`
- O `sdr-ia-interpret` e reativo (precisa de um `messageId` existente em `lead_messages`)

## Problema

Nao existe hoje um fluxo de "primeiro contato proativo" via Blue Chat. A Amelia so responde a mensagens recebidas. Para abordar o Arthur, precisamos:

1. Gerar uma mensagem de saudacao sem ter uma mensagem inbound
2. Abrir uma conversa no Blue Chat
3. Enviar a mensagem
4. Registrar tudo no banco

---

## Plano de implementacao

### 1. Nova Edge Function: `sdr-proactive-outreach`

Cria uma edge function que orquestra o fluxo completo de abordagem proativa:

**Entrada (body):**
```json
{
  "lead_id": "lead_arthur_blue",
  "empresa": "BLUE",
  "motivo": "MQL cadastrado - primeiro contato",
  "canal": "BLUECHAT"
}
```

**Fluxo interno:**

```
1. Buscar dados do lead (nome, telefone, classificacao, empresa)
   |
2. Verificar se ja existe conversa ativa (evitar duplicatas)
   |
3. Resetar conversation_state para SAUDACAO (novo ciclo)
   |
4. Gerar mensagem de saudacao via IA (usando contexto do lead)
   |
5. Abrir conversa no Blue Chat (POST /conversations via API)
   |
6. Enviar mensagem via Blue Chat (POST /conversations/:id/messages)
   |
7. Registrar mensagem em lead_messages (direcao: OUTBOUND)
   |
8. Atualizar conversation_state com bluechat_conversation_id
   |
9. Atualizar deal com etiqueta "Atendimento IA" e owner_id = Amelia
```

### 2. Geracao da mensagem de saudacao

Usar a IA (via `ai-provider`) para gerar uma mensagem personalizada baseada em:
- Nome do lead
- Empresa (Blue Consult)
- Origem (MQL - cadastro)
- Personalidade da Amelia (informal, profissional, 0-2 emojis)

Exemplo de mensagem esperada:
> "Oi Arthur! Aqui e a Amelia, do comercial da Blue Consult. Vi que voce se cadastrou e queria entender melhor como posso te ajudar. Voce tem alguma demanda especifica em mente?"

### 3. Chamada de teste

Apos criar a function, invocar diretamente para iniciar a conversa com Arthur:

```json
POST /functions/v1/sdr-proactive-outreach
{
  "lead_id": "lead_arthur_blue",
  "empresa": "BLUE",
  "motivo": "MQL cadastrado - primeiro contato"
}
```

---

## Arquivos a criar/modificar

| Arquivo | Tipo | Descricao |
|---|---|---|
| `supabase/functions/sdr-proactive-outreach/index.ts` | Criar | Edge function de outreach proativo |
| `supabase/config.toml` | Atualizar automaticamente | Registrar nova function |

## Detalhes tecnicos

### Edge Function `sdr-proactive-outreach/index.ts`

A function ira:

1. **Autenticacao**: Aceitar Bearer token (service_role ou usuario autenticado com role ADMIN/SELLER)

2. **Busca de contexto**: Carregar lead_contacts, lead_classifications, lead_conversation_state e contacts (para o deal)

3. **Geracao de mensagem**: Chamar `ai-provider` com prompt de saudacao contextualizado:
   - Dados do lead (nome, origem, temperatura)
   - Regras de personalidade da Amelia
   - Formato curto (max 200 caracteres)

4. **Integracao Blue Chat**: Usar a mesma logica do `bluechat-proxy` para resolver URL e API key da empresa, depois:
   - `POST /conversations` para abrir conversa
   - `POST /conversations/:id/messages` para enviar

5. **Registro no banco**:
   - `INSERT lead_messages` com direcao OUTBOUND, conteudo da mensagem, canal WHATSAPP
   - `UPDATE lead_conversation_state` com estado_funil=SAUDACAO, framework_ativo=SPIN, bluechat_conversation_id
   - `UPDATE deals` com owner_id=amelia_id e etiqueta='Atendimento IA' (se deal existir)

6. **Resposta**:
```json
{
  "success": true,
  "lead_id": "lead_arthur_blue",
  "conversation_id": "bc-xxx",
  "message_sent": "Oi Arthur! ...",
  "deal_updated": true
}
```

### Prompt de saudacao (resumido)

```
Voce e a Amelia, SDR da Blue Consult. 
O lead {nome} se cadastrou como MQL.
Gere uma UNICA mensagem curta de primeiro contato.
Regras: informal, profissional, max 1 emoji, sem elogios genericos.
Objetivo: descobrir a necessidade do lead.
```

### Seguranca

- Autenticacao via Bearer (service_role para chamadas internas, ou usuario autenticado)
- Verificacao de que o lead pertence a empresa informada
- Rate limiting: maximo 1 outreach por lead a cada 24h (verificar ultima mensagem OUTBOUND)

