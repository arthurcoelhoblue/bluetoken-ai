# ÉPICO 5 – Mensageria & SDR IA Conversacional

**Status:** 🟡 EM PROGRESSO  
**Início:** 2024-01-XX  
**Dependências:** PATCH 4 (Motor de Cadências) ✅

---

## Objetivo Macro

1. **Mensageria transacional estruturada**
   - WhatsApp (via mensageria própria + API oficial)
   - Email (via Mautic)
   - Log centralizado, rastreável, por lead e por run

2. **Camada de interpretação de respostas (SDR IA)**
   - Entender se a resposta é: interesse / objeção / pedido de agendamento / opt-out etc.
   - Disparar ações no funil/cadência

3. **Camada de segurança / anti-alucinação**
   - IA só fala onde tem base
   - Casos críticos: manda pro humano, não inventa

---

## Estrutura de Patches

| Patch | Nome | Status | Descrição |
|-------|------|--------|-----------|
| 5A | Infraestrutura de Mensagens | ✅ FEITO | Templates + Contacts + Mock dispatch |
| 5B | Log Centralizado de Mensagens | 🔲 PENDENTE | Tabela `lead_messages` + wrappers |
| 5C | WhatsApp Outbound | 🔲 PENDENTE | Integração real com mensageria |
| 5D | Email Outbound (Mautic) | 🔲 PENDENTE | Integração com Mautic API |
| 5E | UI de Mensagens | 🔲 PENDENTE | Histórico no Lead e Run |
| 5F | Webhook Inbound WhatsApp | 🔲 PENDENTE | Receber respostas do lead |
| 5G | Motor SDR IA | 🔲 PENDENTE | Interpretação de intenções |
| 5H | Hand-off + Anti-alucinação | 🔲 PENDENTE | Regras de segurança |
| 5I | Testes E2E | 🔲 PENDENTE | Cenários ponta a ponta |

---

## PATCH 5A – Infraestrutura de Mensagens ✅

**Status:** CONCLUÍDO

### O que foi implementado

1. **Tabela `message_templates`**
   - Templates de mensagem por empresa/canal
   - Campos: `codigo`, `nome`, `conteudo`, `empresa`, `canal`, `ativo`
   - RLS configurado

2. **Tabela `lead_contacts`**
   - Cache de contatos do lead
   - Campos: `lead_id`, `empresa`, `nome`, `email`, `telefone`, `primeiro_nome`
   - IDs externos: `tokeniza_investor_id`, `blue_client_id`, `pipedrive_deal_id`, `pipedrive_person_id`

3. **Tipos TypeScript** (`src/types/messaging.ts`)
   - `MessageTemplate`
   - `LeadContact`
   - `TemplateContext`
   - `ResolvedMessage`
   - `CadenceProcessResult`
   - `CadenceRunnerResult`

4. **Edge Function `cadence-runner`**
   - Busca runs vencidas
   - Resolve templates com placeholders
   - **Mock dispatch** (não envia de verdade ainda)
   - Locking otimista
   - Progressão de steps

### Arquivos

- `supabase/migrations/[timestamp]_patch5a_messaging.sql`
- `supabase/functions/cadence-runner/index.ts`
- `src/types/messaging.ts`

---

## PATCH 5B – Log Centralizado de Mensagens 🔲

**Objetivo:** Criar estrutura para logar todas as mensagens (enviadas e recebidas) de forma centralizada.

### Escopo

#### 1. Tabela `lead_messages`

```sql
CREATE TABLE public.lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  run_id UUID REFERENCES lead_cadence_runs(id),
  step_ordem INTEGER,
  
  -- Direção e canal
  canal canal_tipo NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('OUTBOUND', 'INBOUND')),
  
  -- Conteúdo
  template_codigo TEXT,
  conteudo TEXT NOT NULL,
  
  -- Estado
  estado TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (estado IN (
    'PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'ERRO', 'RECEBIDO'
  )),
  erro_detalhe TEXT,
  
  -- IDs externos
  whatsapp_message_id TEXT,
  email_message_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_lead_messages_lead ON lead_messages(lead_id, empresa);
CREATE INDEX idx_lead_messages_run ON lead_messages(run_id);
CREATE INDEX idx_lead_messages_estado ON lead_messages(estado);
```

#### 2. Tipos TypeScript

Adicionar em `src/types/messaging.ts`:

```typescript
export type MensagemDirecao = 'OUTBOUND' | 'INBOUND';

export type MensagemEstado = 
  | 'PENDENTE' 
  | 'ENVIADO' 
  | 'ENTREGUE' 
  | 'LIDO' 
  | 'ERRO' 
  | 'RECEBIDO';

export interface LeadMessage {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  run_id: string | null;
  step_ordem: number | null;
  canal: CanalTipo;
  direcao: MensagemDirecao;
  template_codigo: string | null;
  conteudo: string;
  estado: MensagemEstado;
  erro_detalhe: string | null;
  whatsapp_message_id: string | null;
  email_message_id: string | null;
  created_at: string;
  updated_at: string;
  enviado_em: string | null;
  entregue_em: string | null;
  lido_em: string | null;
}
```

#### 3. Wrappers de Log (Edge Function utils)

```typescript
// Em supabase/functions/_shared/messageLogger.ts

export async function logOutboundMessage(
  supabase: SupabaseClient,
  params: {
    lead_id: string;
    empresa: EmpresaTipo;
    canal: CanalTipo;
    conteudo: string;
    template_codigo?: string;
    run_id?: string;
    step_ordem?: number;
  }
): Promise<{ id: string } | null>

export async function updateMessageStatus(
  supabase: SupabaseClient,
  messageId: string,
  estado: MensagemEstado,
  extras?: {
    erro_detalhe?: string;
    whatsapp_message_id?: string;
    email_message_id?: string;
    enviado_em?: string;
    entregue_em?: string;
    lido_em?: string;
  }
): Promise<boolean>

export async function logInboundMessage(
  supabase: SupabaseClient,
  params: {
    lead_id: string;
    empresa: EmpresaTipo;
    canal: CanalTipo;
    conteudo: string;
    whatsapp_message_id?: string;
  }
): Promise<{ id: string } | null>
```

### Q&A - Critérios de Aceite

- [ ] Tabela `lead_messages` criada com RLS adequado
- [ ] Toda mensagem outbound passa por `logOutboundMessage`
- [ ] Inbound será registrado via `logInboundMessage`
- [ ] IDs externos podem ser guardados para conciliação
- [ ] Tipos TypeScript atualizados

---

## PATCH 5C – WhatsApp Outbound 🔲

**Objetivo:** Conectar o cadence-runner com a mensageria WhatsApp real.

### Dependência Externa

> ⚠️ **AÇÃO NECESSÁRIA:** Definir API da mensageria WhatsApp
> - Endpoint base
> - Método de autenticação (API key, token, etc.)
> - Payload esperado
> - Estrutura de resposta (success, message_id, error)

### Escopo

#### 1. Serviço WhatsApp

```typescript
// supabase/functions/_shared/whatsappService.ts

interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  body: string,
  options?: {
    templateName?: string;
    mediaUrl?: string;
  }
): Promise<WhatsAppSendResult>
```

#### 2. Integração com cadence-runner

No `cadence-runner/index.ts`:

```typescript
// Substituir mock por chamada real
if (step.canal === 'WHATSAPP') {
  // 1. Log pendente
  const msgLog = await logOutboundMessage(supabase, {
    lead_id: run.lead_id,
    empresa: run.empresa,
    canal: 'WHATSAPP',
    conteudo: mensagemResolvida,
    template_codigo: step.template_codigo,
    run_id: run.id,
    step_ordem: step.ordem
  });

  // 2. Enviar
  const result = await sendWhatsAppMessage(contact.telefone, mensagemResolvida);

  // 3. Atualizar status
  if (result.ok) {
    await updateMessageStatus(supabase, msgLog.id, 'ENVIADO', {
      whatsapp_message_id: result.messageId,
      enviado_em: new Date().toISOString()
    });
  } else {
    await updateMessageStatus(supabase, msgLog.id, 'ERRO', {
      erro_detalhe: result.error
    });
  }
}
```

#### 3. Tratamento de Erros

- Erro no envio → `lead_messages.estado = 'ERRO'`
- Registrar `LeadCadenceEvent` tipo `ERRO`
- Retry automático (se configurado)

### Q&A - Critérios de Aceite

- [ ] Step WHATSAPP gera chamada única a `sendWhatsAppMessage`
- [ ] Sucesso → `lead_messages` com ENVIADO + id externo
- [ ] Erro → `lead_messages` com ERRO + detalhe + evento de erro
- [ ] cadence-runner não trava se API indisponível

---

## PATCH 5D – Email Outbound (Mautic) 🔲

**Objetivo:** Permitir steps de Email na cadência usando Mautic.

### Dependência Externa

> ⚠️ **AÇÃO NECESSÁRIA:** Definir integração Mautic
> - Endpoint API Mautic
> - Autenticação
> - Mapeamento template_codigo → template Mautic

### Escopo

#### 1. Serviço Mautic

```typescript
// supabase/functions/_shared/mauticService.ts

interface MauticSendResult {
  ok: boolean;
  emailId?: string;
  error?: string;
}

export async function sendEmailViaMautic(
  to: string,
  templateCodigo: string,
  context: {
    nome: string;
    primeiro_nome: string;
    empresa: string;
    [key: string]: any;
  }
): Promise<MauticSendResult>
```

#### 2. Integração com cadence-runner

Similar ao WhatsApp, mas para canal EMAIL.

### Q&A - Critérios de Aceite

- [ ] Steps EMAIL só executam se lead tem email válido
- [ ] Falha Mautic logada corretamente
- [ ] Logs de email aparecem junto com WhatsApp no histórico

---

## PATCH 5E – UI de Mensagens 🔲

**Objetivo:** Exibir histórico de mensagens para vendedor/suporte.

### Escopo

#### 1. Componente de Histórico

```typescript
// src/components/messages/MessageHistory.tsx
// - Timeline de mensagens
// - Ícone por canal (WhatsApp/Email)
// - Badge de direção (Enviada/Recebida)
// - Status (Enviado/Erro/Lido)
// - Preview do conteúdo
// - Modal para ver mensagem completa
```

#### 2. Integração no Lead Detail

Em `/leads/:id/:empresa`:
- Novo bloco "Histórico de Mensagens"
- Ordenado por data desc
- Paginado

#### 3. Integração no Run Detail

Em `/cadences/runs/:id`:
- Tab "Mensagens" ou inline na timeline
- Associar eventos DISPARADO com mensagens

#### 4. Hook

```typescript
// src/hooks/useLeadMessages.ts
export function useLeadMessages(leadId: string, empresa: EmpresaTipo)
export function useRunMessages(runId: string)
```

### Q&A - Critérios de Aceite

- [ ] Histórico aparece para lead correto
- [ ] Erros de envio identificáveis visualmente
- [ ] Sem duplicidade
- [ ] Performance com paginação

---

## PATCH 5F – Webhook Inbound WhatsApp 🔲

**Objetivo:** Receber respostas do lead no WhatsApp.

### Escopo

#### 1. Edge Function

```typescript
// supabase/functions/whatsapp-inbound/index.ts

// POST /functions/v1/whatsapp-inbound
// Headers: X-Webhook-Secret ou similar

// Payload esperado (definir com mensageria):
interface WhatsAppInboundPayload {
  from: string;        // telefone
  body: string;        // texto
  messageId: string;   // id da mensagem
  timestamp: string;
  replyToMessageId?: string; // se for resposta a msg anterior
}
```

#### 2. Fluxo

1. Validar autenticação do webhook
2. Extrair dados do payload
3. Resolver `lead_id` via `lead_contacts.telefone`
4. Se `replyToMessageId` → tentar associar com run/step
5. Registrar em `lead_messages` (INBOUND)
6. Disparar para motor de interpretação (PATCH 5G)

### Q&A - Critérios de Aceite

- [ ] Mensagem de teste cai no webhook e vira registro
- [ ] Leads sem telefone tratados (erro logado)
- [ ] Associação com run quando possível

---

## PATCH 5G – Motor SDR IA 🔲

**Objetivo:** Interpretar texto livre do lead em intenção estruturada.

### Escopo

#### 1. Modelo de Intenção

```typescript
export type LeadIntencao =
  | 'INTERESSE_AGENDAR'
  | 'INTERESSE_COMPRAR'
  | 'INTERESSE_INVESTIR'
  | 'PEDIDO_INFORMACAO'
  | 'OBJECAO_PRECO'
  | 'OBJECAO_RISCO'
  | 'OBJECAO_TIMING'
  | 'SEM_INTERESSE'
  | 'OPT_OUT'
  | 'OUTRO'
  | 'NAO_ENTENDIDO';

export interface InterpretacaoResultado {
  intencao: LeadIntencao;
  confianca: number; // 0-1
  detalhes: string | null;
  acaoSugerida: 'CONTINUAR_CADENCIA' | 'PAUSAR_CADENCIA' | 'HANDOFF_HUMANO' | 'OPT_OUT';
  respostaSugerida: string | null;
}
```

#### 2. Função de Interpretação

```typescript
// supabase/functions/interpret-message/index.ts

export async function interpretarMensagem(
  mensagem: string,
  contexto: {
    lead_id: string;
    empresa: EmpresaTipo;
    classificacao?: LeadClassification;
    cadencia_atual?: string;
    historico_recente?: LeadMessage[];
  }
): Promise<InterpretacaoResultado>
```

#### 3. Prompt Engineering

- Contexto claro sobre empresa (Tokeniza vs Blue)
- Exemplos de cada intenção
- Instruções para não inventar
- Threshold de confiança para handoff

#### 4. Persistência

Campos extras em `lead_messages` ou tabela separada `message_intents`:
- `intencao`
- `intencao_confianca`
- `acao_executada`

### Q&A - Critérios de Aceite

- [ ] Toda mensagem inbound passa pelo motor
- [ ] Intenções simples mapeadas corretamente
- [ ] Baixa confiança → handoff humano

---

## PATCH 5H – Hand-off + Anti-alucinação 🔲

**Objetivo:** Garantir que IA não prometa o que não pode.

### Escopo

#### 1. Política Anti-alucinação

A IA só pode:
- Usar templates pré-aprovados
- Responder perguntas dentro de FAQs/blocos de conhecimento definidos
- Dados objetivos Tokeniza/Blue

Fora disso → resposta padrão:
> "Essa é uma dúvida que um especialista humano precisa responder. Vou encaminhar seu caso para o time [Blue/Tokeniza] e eles te retornam."

#### 2. Gatilhos de Hand-off

| Intenção | Ação |
|----------|------|
| INTERESSE_AGENDAR | Criar tarefa + handoff |
| OBJECAO_PRECO/RISCO | Handoff se complexa |
| OPT_OUT | Cancelar cadência + marcar opt-out |
| NAO_ENTENDIDO | Handoff se 2+ tentativas |

#### 3. Tabela `lead_handoffs`

```sql
CREATE TABLE public.lead_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  message_id UUID REFERENCES lead_messages(id),
  intencao TEXT NOT NULL,
  motivo TEXT NOT NULL,
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ATENDIMENTO', 'RESOLVIDO')),
  atribuido_a UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolvido_em TIMESTAMPTZ
);
```

### Q&A - Critérios de Aceite

- [ ] Perguntas fora de escopo → handoff
- [ ] Intenções críticas → handoff automático
- [ ] Handoff visível para Closer/Admin

---

## PATCH 5I – Testes E2E 🔲

**Objetivo:** Validar fluxo completo.

### Cenários

#### Cenário A – Lead novo Tokeniza (MQL quente)

1. SGT → webhook → classificação → cadência `TOKENIZA_MQL_QUENTE`
2. Step 1 dispara WhatsApp → log outbound
3. Lead responde "quero marcar uma call"
4. Inbound → interpretação → `INTERESSE_AGENDAR`
5. Sistema cria handoff + pausa cadência

#### Cenário B – Blue IR opt-out

1. Cadência dispara email → log outbound
2. Lead responde "não quero mais receber mensagens"
3. Inbound → `OPT_OUT`
4. Sistema cancela cadência + marca opt-out

#### Cenário C – Erro de envio

1. API mensageria retorna erro
2. Mensagem logada como ERRO
3. Evento de erro registrado
4. Retry tenta novamente
5. Closer vê erro no histórico

### Q&A - Critérios de Aceite

- [ ] 3 cenários funcionam ponta a ponta
- [ ] Logs consistentes
- [ ] IA não promete fora do escopo

---

## Dependências Externas Pendentes

| Item | Responsável | Status |
|------|-------------|--------|
| API Mensageria WhatsApp (endpoint, auth, payload) | Usuário | 🔲 PENDENTE |
| API Mautic (endpoint, auth, templates) | Usuário | 🔲 PENDENTE |
| FAQs/Blocos de conhecimento para IA | Usuário | 🔲 PENDENTE |

---

## Próximos Passos

1. ✅ Documento criado
2. 🔲 Definir API WhatsApp
3. 🔲 Implementar PATCH 5B (lead_messages)
4. 🔲 Seguir sequência 5C → 5I
